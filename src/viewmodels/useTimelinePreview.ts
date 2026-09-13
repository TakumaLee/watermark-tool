import { useEffect, useRef } from 'react';
import { useTimelineStore } from '../stores/timelineStore';
import { resolveActiveClip, isMultiSourceTimeline } from './timelineLogic';

/**
 * ViewModel hook: double-buffer clip transitions for multi-source timelines.
 *
 * Preloads the next clip into `secondaryRef` while the current clip plays in
 * `primaryRef`. When the playhead crosses a clip boundary, performs an instant
 * slot-swap (calling `swapSlots`) instead of reloading the visible player's src.
 * Falls back to direct src-switch when the secondary isn't ready in time.
 *
 * `activeSlot` in deps ensures effect re-runs after each swap so `primaryRef.current`
 * and `secondaryRef.current` (updated synchronously by VideoPlayer's useLayoutEffect)
 * always refer to the correct physical elements.
 */
export function useTimelinePreview(
  primaryRef: React.RefObject<HTMLVideoElement | null>,
  secondaryRef: React.RefObject<HTMLVideoElement | null>,
  swapSlots: () => void,
  activeSlot: 0 | 1,
) {
  const clips = useTimelineStore((s) => s.clips);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const setActiveClipIndex = useTimelineStore((s) => s.setActiveClipIndex);

  const prevClipIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Tracks what is currently preloaded in the secondary slot
  const secondaryPreloadRef = useRef<{
    clipId: string; sourceUrl: string; startTime: number; ready: boolean;
  } | null>(null);
  const preloadCleanupRef = useRef<(() => void) | null>(null);

  const isMultiSource = isMultiSourceTimeline(clips);

  // Loading can outlive a playhead update. Cancel only on replacement/reset/unmount.
  useEffect(() => () => {
    cleanupRef.current?.();
    preloadCleanupRef.current?.();
    secondaryPreloadRef.current = null;
    prevClipIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!isMultiSource || clips.length === 0) {
      cleanupRef.current?.();
      preloadCleanupRef.current?.();
      secondaryPreloadRef.current = null;
      setActiveClipIndex(-1);
      prevClipIdRef.current = null;
      return;
    }

    const active = resolveActiveClip(clips, playheadTime);
    if (!active) return;

    setActiveClipIndex(active.index);

    const primary = primaryRef.current;
    const secondary = secondaryRef.current;
    if (!primary) return;

    // Consume the prepared clip BEFORE changing the secondary's preload target.
    if (active.clip.id !== prevClipIdRef.current) {
      prevClipIdRef.current = active.clip.id;
      cleanupRef.current?.();

      const preload = secondaryPreloadRef.current;
      const wasPlaying = !primary.paused || primary.ended;
      if (secondary && preload?.ready && preload.clipId === active.clip.id &&
          preload.sourceUrl === active.clip.sourceUrl && preload.startTime === active.clip.startTime) {
        preloadCleanupRef.current?.();
        secondaryPreloadRef.current = null;

        // Keep ordinary boundary drift from causing a new seek; manual jumps must
        // still land at their requested position (same tolerance as Timeline).
        if (Math.abs(secondary.currentTime - active.seekTarget) > 0.05) {
          secondary.currentTime = active.seekTarget;
        }
        secondary.playbackRate = primary.playbackRate;
        primary.muted = true;
        primary.pause();
        secondary.muted = false;
        swapSlots();
        if (wasPlaying) secondary.play().catch(() => {});

        // Refs still identify the OLD roles until VideoPlayer's layout effect.
        // Preload the following clip only after activeSlot updates those refs.
        return;
      }

      // No prepared frame: retain the existing load/seek/resume fallback.
      const seekTarget = active.seekTarget;
      const handleCanPlay = () => {
        cleanupRef.current?.();
        primary.currentTime = seekTarget;
        if (wasPlaying) primary.play().catch(() => {});
      };
      primary.addEventListener('canplay', handleCanPlay, { once: true });
      cleanupRef.current = () => {
        primary.removeEventListener('canplay', handleCanPlay);
        cleanupRef.current = null;
      };
      primary.src = active.clip.sourceUrl;
      primary.load();
    }

    // ── Preload next clip into the now-unused secondary ──────────────────────
    const nextClip = clips[active.index + 1];

    if (nextClip && secondary && nextClip.sourcePath !== active.clip.sourcePath) {
      const existing = secondaryPreloadRef.current;
      if (existing?.clipId !== nextClip.id || existing.sourceUrl !== nextClip.sourceUrl ||
          existing.startTime !== nextClip.startTime) {
        // Cancel any pending listeners from the previous preload, then start fresh.
        preloadCleanupRef.current?.();

        const preload = {
          clipId: nextClip.id, sourceUrl: nextClip.sourceUrl,
          startTime: nextClip.startTime, ready: false,
        };
        secondaryPreloadRef.current = preload;
        let seekRequested = false;

        const onSeeked = () => {
          if (secondaryPreloadRef.current === preload && !secondary.seeking &&
              secondary.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            preload.ready = true;
          }
        };

        const onCanPlay = () => {
          if (!seekRequested) {
            seekRequested = true;
            if (secondary.currentTime !== preload.startTime) {
              secondary.currentTime = preload.startTime;
              return;
            }
          }
          // Seeking to an already-current time may not emit seeked.
          onSeeked();
        };

        secondary.addEventListener('canplay', onCanPlay);
        secondary.addEventListener('seeked', onSeeked);
        preloadCleanupRef.current = () => {
          secondary.removeEventListener('canplay', onCanPlay);
          secondary.removeEventListener('seeked', onSeeked);
          preloadCleanupRef.current = null;
        };
        secondary.pause();
        secondary.muted = true;
        secondary.preload = 'auto';
        secondary.src = nextClip.sourceUrl;
        secondary.load();
      }
    } else {
      preloadCleanupRef.current?.();
      secondaryPreloadRef.current = null;
    }
  }, [isMultiSource, clips, playheadTime, activeSlot, primaryRef, secondaryRef, swapSlots, setActiveClipIndex]);
}
