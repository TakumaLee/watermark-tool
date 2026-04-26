import type { TimelineClip } from '../types';

export interface ActiveClipResult {
  clip: TimelineClip;
  /** Index in the clips array */
  index: number;
  /** Seconds elapsed within this clip (relative to its timeline position) */
  offsetInClip: number;
  /** Timeline time at which this clip starts */
  timelineStart: number;
  /** Source video currentTime to seek to */
  seekTarget: number;
}

/**
 * Determine which clip the playhead falls in, and compute seek coordinates.
 * Pure function — no side effects, fully testable.
 */
export function resolveActiveClip(
  clips: TimelineClip[],
  timelineTime: number,
): ActiveClipResult | null {
  if (clips.length === 0) return null;

  let accumulated = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (timelineTime < accumulated + clip.duration) {
      const offsetInClip = timelineTime - accumulated;
      return {
        clip,
        index: i,
        offsetInClip,
        timelineStart: accumulated,
        seekTarget: clip.startTime + offsetInClip,
      };
    }
    accumulated += clip.duration;
  }

  // Past the end: clamp to last clip
  const last = clips[clips.length - 1];
  const timelineStart = accumulated - last.duration;
  return {
    clip: last,
    index: clips.length - 1,
    offsetInClip: last.duration,
    timelineStart,
    seekTarget: last.endTime,
  };
}

/**
 * Reorder a clip by moving it to a new index. Returns a new array (immutable).
 * Returns the same reference if no change would occur.
 */
export function applyReorder(
  clips: TimelineClip[],
  clipId: string,
  newIndex: number,
): TimelineClip[] {
  const currentIndex = clips.findIndex((c) => c.id === clipId);
  if (currentIndex === -1 || newIndex === currentIndex) return clips;
  const result = [...clips];
  const [moved] = result.splice(currentIndex, 1);
  result.splice(newIndex, 0, moved);
  return result;
}

/**
 * Given the mouse x position relative to the timeline scroll origin (in pixels),
 * return the clip index at which to insert the dragged clip.
 * Uses midpoint of each clip as the threshold.
 */
export function computeDropIndex(
  clips: TimelineClip[],
  zoom: number,
  mouseXInTimeline: number,
): number {
  let accumulated = 0;
  for (let i = 0; i < clips.length; i++) {
    const clipMid = accumulated + (clips[i].duration * zoom) / 2;
    if (mouseXInTimeline < clipMid) return i;
    accumulated += clips[i].duration * zoom;
  }
  return clips.length;
}

/** Return true if the clips array contains segments from more than one source video. */
export function isMultiSourceTimeline(clips: TimelineClip[]): boolean {
  if (clips.length <= 1) return false;
  const first = clips[0].sourcePath;
  return clips.some((c) => c.sourcePath !== first);
}
