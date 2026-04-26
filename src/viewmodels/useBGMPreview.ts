import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAudioStore } from '../stores/audioStore';
import { useTimelineStore } from '../stores/timelineStore';

/**
 * Plays BGM audio items in sync with the video element during preview.
 *
 * Key design decisions:
 * - BGM timing is based on TIMELINE time, not source video currentTime.
 *   (When clips are trimmed, source time ≠ timeline time.)
 * - `loadstart`/`canplay` guard: video.load() during clip src-switch can fire
 *   a `pause` event. We suppress BGM pause while a clip switch is in progress.
 * - `seeked` handler only repositions BGM without touching play state, to avoid
 *   a brief silence during clip transitions (video is paused until play() is called).
 *   Large drifts (>1 s, user manual seek) are always corrected immediately.
 */
export function useBGMPreview(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  activeSlot: 0 | 1,
) {
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tracks whether a clip src-switch is loading (video.load() was called).
    // During this window, video may fire `pause` — we must not stop BGM.
    let isSwitchingClip = false;

    /** Convert source video currentTime → timeline time using clip arrangement. */
    const toTimelineTime = (sourceTime: number): number => {
      const { clips, activeClipIndex } = useTimelineStore.getState();
      if (clips.length === 0) return sourceTime;
      if (activeClipIndex >= 0 && activeClipIndex < clips.length) {
        const clip = clips[activeClipIndex];
        const clipStart = clips.slice(0, activeClipIndex).reduce((s, c) => s + c.duration, 0);
        return clipStart + Math.max(0, sourceTime - clip.startTime);
      }
      let t = 0;
      for (const clip of clips) {
        if (sourceTime < clip.startTime) break;
        if (sourceTime < clip.endTime) { t += sourceTime - clip.startTime; break; }
        t += clip.duration;
      }
      return t;
    };

    /** Full sync: position + play/pause state. Called on `play` and `timeupdate`. */
    const syncAll = () => {
      const { bgmItems } = useAudioStore.getState();
      const timelineTime = toTimelineTime(video.currentTime);
      const isPaused = video.paused || video.ended;

      // Clean up audio elements for removed BGMs
      const activeIds = new Set(bgmItems.map((b) => b.id));
      for (const [id, audio] of audioMapRef.current.entries()) {
        if (!activeIds.has(id)) { audio.pause(); audioMapRef.current.delete(id); }
      }

      for (const bgm of bgmItems) {
        if (!audioMapRef.current.has(bgm.id)) {
          const el = new Audio(convertFileSrc(bgm.filePath));
          el.preload = 'auto';
          audioMapRef.current.set(bgm.id, el);
        }
        const audio = audioMapRef.current.get(bgm.id)!;
        const sourceEnd = bgm.trimEnd === -1 ? bgm.duration : bgm.trimEnd;
        const bgmSourceTime = bgm.trimStart + (timelineTime - bgm.startOffset);
        const inRange = timelineTime >= bgm.startOffset && bgmSourceTime < sourceEnd;

        if (bgm.isMuted || !inRange) {
          if (!audio.paused) audio.pause();
          continue;
        }

        audio.volume = Math.min(1, bgm.volume / 100);

        // Seek if drift > 150 ms (avoids micro-seeks during normal playback)
        if (Math.abs(audio.currentTime - bgmSourceTime) > 0.15) {
          audio.currentTime = bgmSourceTime;
        }

        if (isPaused) {
          if (!audio.paused) audio.pause();
        } else {
          if (audio.paused) audio.play().catch(() => {});
        }
      }
    };

    const stopAll = () => {
      for (const audio of audioMapRef.current.values()) {
        if (!audio.paused) audio.pause();
      }
    };

    // Set the switching flag when a new src starts loading.
    const handleLoadStart = () => { isSwitchingClip = true; };
    // Clear when the new clip is ready to play.
    const handleCanPlay = () => { isSwitchingClip = false; };

    // Pause: only stop BGM for user-initiated pause, not for clip src-switches.
    const handlePause = () => {
      if (isSwitchingClip) return;
      stopAll();
    };

    // Seeked: reposition BGM without changing play state.
    // This fires during clip switches (video.currentTime = seekTarget before play()).
    // Suppress corrections for playing audio with small drift (<1 s) to avoid pops;
    // large drifts (user manual seek) are always corrected immediately.
    const handleSeeked = () => {
      const { bgmItems } = useAudioStore.getState();
      const timelineTime = toTimelineTime(video.currentTime);
      for (const bgm of bgmItems) {
        const audio = audioMapRef.current.get(bgm.id);
        if (!audio) continue;
        const sourceEnd = bgm.trimEnd === -1 ? bgm.duration : bgm.trimEnd;
        const bgmSourceTime = bgm.trimStart + (timelineTime - bgm.startOffset);
        const inRange = timelineTime >= bgm.startOffset && bgmSourceTime < sourceEnd;
        if (bgm.isMuted || !inRange) continue;
        audio.volume = Math.min(1, bgm.volume / 100);
        const drift = Math.abs(audio.currentTime - bgmSourceTime);
        // Correct if: large drift (user seek) OR audio is paused (pre-position for next play)
        if (drift > 1.0 || (drift > 0.15 && audio.paused)) {
          audio.currentTime = bgmSourceTime;
        }
      }
    };

    // On natural end: only stop BGM when there is no next clip to play.
    // For multi-clip timelines, the transition handler resumes BGM via `play` → syncAll.
    const handleEnded = () => {
      const { clips: timelineClips, activeClipIndex: ai } = useTimelineStore.getState();
      const hasNext = ai >= 0
        ? ai + 1 < timelineClips.length
        : timelineClips.length > 1;
      if (!hasNext) stopAll();
      // If hasNext: useClipPlayback.handleEnded drives the transition → video.play() → syncAll
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', syncAll);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', syncAll);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', syncAll);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', syncAll);
      // Don't stopAll() here — BGM must continue seamlessly across slot swaps.
      // The unmount effect (empty deps) stops all BGM when the component is destroyed.
    };
  }, [videoRef, activeSlot]);

  // Pause all BGM when component unmounts
  useEffect(() => {
    const map = audioMapRef.current;
    return () => {
      for (const audio of map.values()) audio.pause();
      map.clear();
    };
  }, []);
}
