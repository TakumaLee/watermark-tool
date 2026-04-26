import { create } from 'zustand';
import type { TimelineClip } from '../types';
import { TIMELINE_ZOOM } from '../types';
import { applyReorder } from '../viewmodels/timelineLogic';

interface TimelineStoreState {
  clips: TimelineClip[];
  playheadTime: number;
  selectedClipId: string | null;
  zoom: number;
  scrollOffset: number;
  totalDuration: number;
  activeClipIndex: number;
  slotVersion: number;

  initFromVideo: (sourcePath: string, sourceUrl: string, duration: number, name: string) => void;
  setPlayheadTime: (time: number) => void;
  selectClip: (clipId: string | null) => void;
  splitAtPlayhead: () => void;
  splitAtTime: (time: number) => void;
  trimClip: (clipId: string, newStart: number, newEnd: number) => void;
  deleteClip: (clipId: string) => void;
  reorderClip: (clipId: string, newIndex: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  setScrollOffset: (offset: number) => void;
  addVideoToTimeline: (sourcePath: string, sourceUrl: string, duration: number, name: string) => void;
  setActiveClipIndex: (index: number) => void;
  bumpSlotVersion: () => void;
  clearTimeline: () => void;
  _recomputeDuration: () => void;
}

let clipIdCounter = 0;
function generateClipId(): string {
  clipIdCounter += 1;
  return `clip_${Date.now()}_${clipIdCounter}`;
}

function makeClip(
  sourcePath: string,
  sourceUrl: string,
  startTime: number,
  endTime: number,
  sourceStart: number,
  sourceEnd: number,
  name: string,
): TimelineClip {
  return {
    id: generateClipId(),
    sourcePath,
    sourceUrl,
    startTime,
    endTime,
    duration: endTime - startTime,
    name,
    sourceStart,
    sourceEnd,
  };
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => ({
  clips: [],
  playheadTime: 0,
  selectedClipId: null,
  zoom: TIMELINE_ZOOM.DEFAULT,
  scrollOffset: 0,
  totalDuration: 0,
  activeClipIndex: -1,
  slotVersion: 0,

  initFromVideo: (sourcePath, sourceUrl, duration, name) => {
    const clip = makeClip(sourcePath, sourceUrl, 0, duration, 0, duration, name);
    set({
      clips: [clip],
      playheadTime: 0,
      selectedClipId: null,
      scrollOffset: 0,
      totalDuration: duration,
      activeClipIndex: -1,
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

    let accumulatedTime = 0;
    let targetIdx = -1;
    let splitSourceTime = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (playheadTime >= accumulatedTime && playheadTime < accumulatedTime + clip.duration) {
        targetIdx = i;
        splitSourceTime = clip.startTime + (playheadTime - accumulatedTime);
        break;
      }
      accumulatedTime += clip.duration;
    }

    if (targetIdx === -1) return;
    const clip = clips[targetIdx];
    const minDuration = 0.1;
    if (splitSourceTime - clip.startTime < minDuration || clip.endTime - splitSourceTime < minDuration) return;

    const clip1 = makeClip(clip.sourcePath, clip.sourceUrl,
      clip.startTime, splitSourceTime, clip.sourceStart, splitSourceTime, `${clip.name} (1)`);
    const clip2 = makeClip(clip.sourcePath, clip.sourceUrl,
      splitSourceTime, clip.endTime, splitSourceTime, clip.sourceEnd, `${clip.name} (2)`);

    const newClips = [...clips];
    newClips.splice(targetIdx, 1, clip1, clip2);
    set({ clips: newClips });
    get()._recomputeDuration();
  },

  splitAtTime: (time: number) => {
    const { clips } = get();
    if (clips.length === 0) return;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (time > clip.startTime && time < clip.endTime) {
        const minDuration = 0.1;
        if (time - clip.startTime < minDuration || clip.endTime - time < minDuration) return;

        const clip1 = makeClip(clip.sourcePath, clip.sourceUrl,
          clip.startTime, time, clip.sourceStart, time, `${clip.name} (1)`);
        const clip2 = makeClip(clip.sourcePath, clip.sourceUrl,
          time, clip.endTime, time, clip.sourceEnd, `${clip.name} (2)`);

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
    // Validate against immutable source bounds (not current startTime/endTime)
    if (newStart >= newEnd || newStart < clip.sourceStart || newEnd > clip.sourceEnd) return;

    const newClips = [...clips];
    newClips[idx] = { ...clip, startTime: newStart, endTime: newEnd, duration: newEnd - newStart };
    set({ clips: newClips });
    get()._recomputeDuration();
  },

  deleteClip: (clipId) => {
    const { clips, selectedClipId, playheadTime } = get();
    const newClips = clips.filter((c) => c.id !== clipId);
    const newSelected = selectedClipId === clipId ? null : selectedClipId;
    set({ clips: newClips, selectedClipId: newSelected });
    get()._recomputeDuration();
    const { totalDuration } = get();
    if (playheadTime > totalDuration) set({ playheadTime: totalDuration });
  },

  reorderClip: (clipId, newIndex) => {
    const newClips = applyReorder(get().clips, clipId, newIndex);
    if (newClips !== get().clips) set({ clips: newClips });
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

  addVideoToTimeline: (sourcePath, sourceUrl, duration, name) => {
    const clip = makeClip(sourcePath, sourceUrl, 0, duration, 0, duration, name);
    set((state) => ({
      clips: [...state.clips, clip],
      totalDuration: state.totalDuration + duration,
    }));
  },

  setActiveClipIndex: (index) => {
    set({ activeClipIndex: index });
  },

  bumpSlotVersion: () => {
    set((s) => ({ slotVersion: s.slotVersion + 1 }));
  },

  clearTimeline: () => {
    set({
      clips: [],
      playheadTime: 0,
      selectedClipId: null,
      scrollOffset: 0,
      totalDuration: 0,
      activeClipIndex: -1,
    });
  },

  _recomputeDuration: () => {
    const total = get().clips.reduce((sum, c) => sum + c.duration, 0);
    set({ totalDuration: total });
  },
}));
