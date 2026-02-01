import { create } from 'zustand';
import type { TimelineClip } from '../types';
import { TIMELINE_ZOOM } from '../types';

interface TimelineStoreState {
  /** All clips in order */
  clips: TimelineClip[];
  /** Current playhead position in timeline seconds */
  playheadTime: number;
  /** Selected clip ID */
  selectedClipId: string | null;
  /** Zoom level (pixels per second) */
  zoom: number;
  /** Scroll offset in pixels */
  scrollOffset: number;
  /** Total timeline duration (computed) */
  totalDuration: number;

  // --- Actions ---
  /** Initialize timeline from a single video */
  initFromVideo: (sourcePath: string, sourceUrl: string, duration: number, name: string) => void;
  /** Set playhead time */
  setPlayheadTime: (time: number) => void;
  /** Select a clip */
  selectClip: (clipId: string | null) => void;
  /** Split clip at the current playhead position */
  splitAtPlayhead: () => void;
  /** Split at a specific time (in source timeline) */
  splitAtTime: (time: number) => void;
  /** Trim a clip to new in/out points */
  trimClip: (clipId: string, newStart: number, newEnd: number) => void;
  /** Delete a clip */
  deleteClip: (clipId: string) => void;
  /** Reorder clips by moving a clip to a new index */
  reorderClip: (clipId: string, newIndex: number) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Set scroll offset */
  setScrollOffset: (offset: number) => void;
  /** Clear all clips */
  clearTimeline: () => void;
  /** Update total duration (recompute) */
  _recomputeDuration: () => void;
}

let clipIdCounter = 0;
function generateClipId(): string {
  clipIdCounter += 1;
  return `clip_${Date.now()}_${clipIdCounter}`;
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => ({
  clips: [],
  playheadTime: 0,
  selectedClipId: null,
  zoom: TIMELINE_ZOOM.DEFAULT,
  scrollOffset: 0,
  totalDuration: 0,

  initFromVideo: (sourcePath, sourceUrl, duration, name) => {
    const clip: TimelineClip = {
      id: generateClipId(),
      sourcePath,
      sourceUrl,
      startTime: 0,
      endTime: duration,
      duration,
      name,
    };
    set({
      clips: [clip],
      playheadTime: 0,
      selectedClipId: null,
      scrollOffset: 0,
      totalDuration: duration,
    });
  },

  setPlayheadTime: (time) => {
    set({ playheadTime: Math.max(0, Math.min(time, get().totalDuration)) });
  },

  selectClip: (clipId) => {
    set({ selectedClipId: clipId });
  },

  splitAtPlayhead: () => {
    const { clips, playheadTime } = get();
    if (clips.length === 0) return;

    // Find which clip the playhead is over (in timeline-time)
    let accumulatedTime = 0;
    let targetClipIndex = -1;
    let splitPointInClip = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (playheadTime >= accumulatedTime && playheadTime < accumulatedTime + clip.duration) {
        targetClipIndex = i;
        splitPointInClip = clip.startTime + (playheadTime - accumulatedTime);
        break;
      }
      accumulatedTime += clip.duration;
    }

    if (targetClipIndex === -1) return;

    const clip = clips[targetClipIndex];
    // Don't split if too close to edges (< 0.1s)
    const minDuration = 0.1;
    if (splitPointInClip - clip.startTime < minDuration || clip.endTime - splitPointInClip < minDuration) {
      return;
    }

    const clip1: TimelineClip = {
      id: generateClipId(),
      sourcePath: clip.sourcePath,
      sourceUrl: clip.sourceUrl,
      startTime: clip.startTime,
      endTime: splitPointInClip,
      duration: splitPointInClip - clip.startTime,
      name: `${clip.name} (1)`,
    };

    const clip2: TimelineClip = {
      id: generateClipId(),
      sourcePath: clip.sourcePath,
      sourceUrl: clip.sourceUrl,
      startTime: splitPointInClip,
      endTime: clip.endTime,
      duration: clip.endTime - splitPointInClip,
      name: `${clip.name} (2)`,
    };

    const newClips = [...clips];
    newClips.splice(targetClipIndex, 1, clip1, clip2);
    set({ clips: newClips });
    get()._recomputeDuration();
  },

  splitAtTime: (time: number) => {
    const { clips } = get();
    if (clips.length === 0) return;

    // Find the clip that contains this source time
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (time > clip.startTime && time < clip.endTime) {
        const minDuration = 0.1;
        if (time - clip.startTime < minDuration || clip.endTime - time < minDuration) {
          return;
        }

        const clip1: TimelineClip = {
          id: generateClipId(),
          sourcePath: clip.sourcePath,
          sourceUrl: clip.sourceUrl,
          startTime: clip.startTime,
          endTime: time,
          duration: time - clip.startTime,
          name: `${clip.name} (1)`,
        };

        const clip2: TimelineClip = {
          id: generateClipId(),
          sourcePath: clip.sourcePath,
          sourceUrl: clip.sourceUrl,
          startTime: time,
          endTime: clip.endTime,
          duration: clip.endTime - time,
          name: `${clip.name} (2)`,
        };

        const newClips = [...clips];
        newClips.splice(i, 1, clip1, clip2);
        set({ clips: newClips });
        get()._recomputeDuration();
        return;
      }
    }
  },

  trimClip: (clipId, newStart, newEnd) => {
    const { clips } = get();
    const idx = clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return;

    const clip = clips[idx];
    if (newStart >= newEnd || newStart < clip.startTime || newEnd > clip.endTime) return;

    const newClips = [...clips];
    newClips[idx] = {
      ...clip,
      startTime: newStart,
      endTime: newEnd,
      duration: newEnd - newStart,
    };
    set({ clips: newClips });
    get()._recomputeDuration();
  },

  deleteClip: (clipId) => {
    const { clips, selectedClipId, playheadTime } = get();
    const newClips = clips.filter((c) => c.id !== clipId);
    const newSelected = selectedClipId === clipId ? null : selectedClipId;
    set({ clips: newClips, selectedClipId: newSelected });
    get()._recomputeDuration();
    // Clamp playhead
    const { totalDuration } = get();
    if (playheadTime > totalDuration) {
      set({ playheadTime: totalDuration });
    }
  },

  reorderClip: (clipId, newIndex) => {
    const { clips } = get();
    const currentIndex = clips.findIndex((c) => c.id === clipId);
    if (currentIndex === -1 || newIndex === currentIndex) return;

    const newClips = [...clips];
    const [moved] = newClips.splice(currentIndex, 1);
    newClips.splice(newIndex, 0, moved);
    set({ clips: newClips });
  },

  zoomIn: () => {
    const { zoom } = get();
    set({ zoom: Math.min(zoom * TIMELINE_ZOOM.STEP, TIMELINE_ZOOM.MAX) });
  },

  zoomOut: () => {
    const { zoom } = get();
    set({ zoom: Math.max(zoom / TIMELINE_ZOOM.STEP, TIMELINE_ZOOM.MIN) });
  },

  setZoom: (zoom) => {
    set({ zoom: Math.max(TIMELINE_ZOOM.MIN, Math.min(zoom, TIMELINE_ZOOM.MAX)) });
  },

  setScrollOffset: (offset) => {
    set({ scrollOffset: Math.max(0, offset) });
  },

  clearTimeline: () => {
    set({
      clips: [],
      playheadTime: 0,
      selectedClipId: null,
      scrollOffset: 0,
      totalDuration: 0,
    });
  },

  _recomputeDuration: () => {
    const { clips } = get();
    const total = clips.reduce((sum, c) => sum + c.duration, 0);
    set({ totalDuration: total });
  },
}));
