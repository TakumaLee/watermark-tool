import { useEffect, useRef } from 'react';
import { useTimelineStore } from '../stores/timelineStore';
import { resolveActiveClip, isMultiSourceTimeline } from './timelineLogic';

/**
 * ViewModel hook: double-buffer clip transitions for multi-source timelines.
 *
 * Preloads the next clip into `secondaryRef` while the current clip plays in
 * `primaryRef`. When the playhead crosses a clip boundary, performs an instant
 * slot-swap (calling `swapSlots`) instead of switching the primary's src — near-zero
 * stall. Falls back to direct src-switch when the secondary isn't ready in time.
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
  const secondaryPreloadRef = useRef<{ clipId: string; ready: boolean } | null>(null);
  const preloadCleanupRef = useRef<(() => void) | null>(null);

  const isMultiSource = isMultiSourceTimeline(clips);

  useEffect(() => {
    if (!isMultiSource || clips.length === 0) {
      setActiveClipIndex(-1);
      prevClipIdRef.current = null;
      return;
    }

    const active = resolveActiveClip(clips, playheadTime);
    if (!active) return;

    setActiveClipIndex(active.index);

    // ── Preload next clip into secondary ──────────────────────────────────────
    const nextClip = clips[active.index + 1];
    const secondary = secondaryRef.current;

    if (nextClip && secondary && nextClip.sourcePath !== active.clip.sourcePath) {
      if (secondaryPreloadRef.current?.clipId !== nextClip.id) {
        // Cancel any pending listeners from the previous preload, then start fresh.
        preloadCleanupRef.current?.();

        secondaryPreloadRef.current = { clipId: nextClip.id, ready: false };
        secondary.src = nextClip.sourceUrl;
        secondary.load();

        // Capture by value so the cleanup can cancel both listeners independently.
        const targetId = nextClip.id;
        const startTime = nextClip.startTime;

        const onSeeked = () => {
          if (secondaryPreloadRef.current?.clipId === targetId) {
            secondaryPreloadRef.current.ready = true;
          }
        };

        const onCanPlay = () => {
          secondary.currentTime = startTime;
          secondary.addEventListener('seeked', onSeeked, { once: true });
        };

        secondary.addEventListener('canplay', onCanPlay, { once: true });

        preloadCleanupRef.current = () => {
          secondary.removeEventListener('canplay', onCanPlay);
          secondary.removeEventListener('seeked', onSeeked);
          preloadCleanupRef.current = null;
        };
      }
    } else if (!nextClip) {
      secondaryPreloadRef.current = null;
    }

    // ── Handle clip identity change ───────────────────────────────────────────
    if (active.clip.id === prevClipIdRef.current) return;
    prevClipIdRef.current = active.clip.id;

    const primary = primaryRef.current;
    if (!primary) return;

    // Cancel any pending canplay handler from a previous fallback switch
    cleanupRef.current?.();
    cleanupRef.current = null;

    const preload = secondaryPreloadRef.current;
    if (preload?.clipId === active.clip.id && preload.ready && secondary) {
      // ── Double-buffer swap ────────────────────────────────────────────────
      const wasPlaying = !primary.paused || primary.ended;
      secondaryPreloadRef.current = null;

      // Unmute before play — secondary was muted while buffering; VideoPlayer's
      // useLayoutEffect will confirm muted=false after the React re-render.
      secondary.muted = false;
      swapSlots(); // VideoPlayer toggles activeSlot → updates primaryRef/secondaryRef
      if (wasPlaying) secondary.play().catch(() => {});
    } else {
      // ── Fallback: switch primary's src directly ───────────────────────────
      const wasPlaying = !primary.paused || primary.ended;
      const seekTarget = active.seekTarget;

      primary.src = active.clip.sourceUrl;
      primary.load();

      const handleCanPlay = () => {
        primary.currentTime = seekTarget;
        if (wasPlaying) primary.play().catch(() => {});
      };

      primary.addEventListener('canplay', handleCanPlay, { once: true });
      cleanupRef.current = () => primary.removeEventListener('canplay', handleCanPlay);

      return () => {
        cleanupRef.current?.();
      };
    }
  }, [isMultiSource, clips, playheadTime, activeSlot, primaryRef, secondaryRef, swapSlots, setActiveClipIndex]);
}
