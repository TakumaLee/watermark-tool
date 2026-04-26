import { useEffect } from 'react';
import { useTimelineStore } from '../stores/timelineStore';
import { isMultiSourceTimeline } from './timelineLogic';

/**
 * Handles clip boundary transitions during playback:
 * - `ended` event: advances to the next clip (same-source seeks directly;
 *   different-source lets useTimelinePreview react to the playheadTime change)
 * - `timeupdate` (single-source only): skips gaps between trimmed clips so
 *   deleted source segments don't play through
 * - `timeupdate` (multi-source): enforces trimmed endTime using src-based clip
 *   detection as a fallback when activeClipIndex is stale
 */
export function useClipPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  activeSlot: 0 | 1,
) {
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      const { clips, activeClipIndex } = useTimelineStore.getState();
      if (clips.length === 0) return;

      // Determine which clip just finished
      let currentIdx: number;
      if (activeClipIndex >= 0) {
        currentIdx = activeClipIndex; // multi-source: set by useTimelinePreview
      } else {
        // Single-source: find clip by video.currentTime (near endTime of its clip)
        const t = video.currentTime;
        currentIdx = clips.length - 1;
        for (let i = 0; i < clips.length; i++) {
          if (t <= clips[i].endTime + 0.15) { // small tolerance for rounding
            currentIdx = i;
            break;
          }
        }
      }

      const nextIdx = currentIdx + 1;
      if (nextIdx >= clips.length) return; // end of timeline — stay stopped

      const currentClip = clips[currentIdx];
      const nextClip = clips[nextIdx];
      const nextTimelineStart = clips.slice(0, nextIdx).reduce((s, c) => s + c.duration, 0);

      // Advance playhead into the next clip (useTimelinePreview will react if source changes)
      setPlayheadTime(nextTimelineStart + 0.001);

      if (nextClip.sourcePath === currentClip.sourcePath) {
        // Same source file — seek and resume directly
        video.currentTime = nextClip.startTime;
        video.play().catch(() => {});
      }
      // Different source — useTimelinePreview sees playheadTime in new clip range
      // and switches video.src, then plays (wasPlaying check includes video.ended)
    };

    // Enforce clip boundaries for both single-source and multi-source timelines.
    const handleTimeUpdate = () => {
      if (video.paused) return;
      const { clips: cc, totalDuration, activeClipIndex } = useTimelineStore.getState();
      if (cc.length === 0) return;

      if (isMultiSourceTimeline(cc)) {
        // Multi-source: the active clip's endTime must be enforced because the source
        // video is longer than the trimmed clip — the `ended` event won't fire in time.
        //
        // Use activeClipIndex as primary, but validate it against video.src.
        // If stale (e.g., React effect hasn't run yet after a transition), fall back
        // to matching by sourceUrl so the trimmed endTime is always enforced.
        let effectiveIdx = activeClipIndex;
        if (
          effectiveIdx < 0 ||
          effectiveIdx >= cc.length ||
          cc[effectiveIdx].sourceUrl !== video.src
        ) {
          // Stale or invalid index — find the clip whose source is currently loaded
          effectiveIdx = cc.findIndex((c) => c.sourceUrl === video.src);
        }
        if (effectiveIdx < 0 || effectiveIdx >= cc.length) return;

        const activeClip = cc[effectiveIdx];
        if (video.currentTime < activeClip.endTime) return; // still inside clip

        const nextIdx = effectiveIdx + 1;
        if (nextIdx >= cc.length) {
          // Last clip ended — stop at timeline end
          video.pause();
          setPlayheadTime(totalDuration);
        } else {
          // Advance playhead into next clip; useTimelinePreview reacts and switches src
          const nextTimelineStart = cc.slice(0, nextIdx).reduce((s, c) => s + c.duration, 0);
          setPlayheadTime(nextTimelineStart + 0.001);
        }
        return;
      }

      // Single-source: skip gaps between trimmed clips and stop past the last clip
      const t = video.currentTime;
      let accumulated = 0;

      for (let i = 0; i < cc.length; i++) {
        if (t < cc[i].startTime) {
          // In a gap before this clip — jump to its start
          video.currentTime = cc[i].startTime;
          setPlayheadTime(accumulated);
          return;
        }
        if (t < cc[i].endTime) return; // inside this clip, nothing to do
        accumulated += cc[i].duration;
      }

      // Past all clip end points — stop playback at timeline end
      video.pause();
      setPlayheadTime(totalDuration);
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, setPlayheadTime, activeSlot]);
}
