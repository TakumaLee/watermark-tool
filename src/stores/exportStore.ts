import { create } from 'zustand';
import type {
  ExportPlatformId,
  ExportTask,
  ExportTaskStatus,
  GifExportSettings,
  AspectRatioMode,
  ExportQualityLevel,
  ExportVideoFormat,
  ThumbnailFormat,
} from '../types';
import { DEFAULT_GIF_SETTINGS, PLATFORM_PRESETS } from '../types';

interface ExportStoreState {
  // === Panel State ===
  /** Currently selected platform preset */
  selectedPlatformId: ExportPlatformId;
  /** Aspect ratio mode for scaling */
  aspectMode: AspectRatioMode;
  /** Custom width (for custom preset) */
  customWidth: number;
  /** Custom height (for custom preset) */
  customHeight: number;
  /** Custom format */
  customFormat: ExportVideoFormat;
  /** Custom quality */
  customQuality: ExportQualityLevel;
  /** GIF export settings */
  gifSettings: GifExportSettings;

  // === Thumbnail ===
  /** Thumbnail time position */
  thumbnailTime: number;
  /** Thumbnail format */
  thumbnailFormat: ThumbnailFormat;
  /** Thumbnail preview data URL */
  thumbnailPreview: string | null;

  // === Export Queue ===
  /** All export tasks */
  queue: ExportTask[];
  /** Whether the queue is currently processing */
  isQueueProcessing: boolean;

  // === Panel Actions ===
  selectPlatform: (id: ExportPlatformId) => void;
  setAspectMode: (mode: AspectRatioMode) => void;
  setCustomWidth: (width: number) => void;
  setCustomHeight: (height: number) => void;
  setCustomFormat: (format: ExportVideoFormat) => void;
  setCustomQuality: (quality: ExportQualityLevel) => void;
  setGifSettings: (settings: Partial<GifExportSettings>) => void;
  resetGifSettings: () => void;

  // === Thumbnail Actions ===
  setThumbnailTime: (time: number) => void;
  setThumbnailFormat: (format: ThumbnailFormat) => void;
  setThumbnailPreview: (dataUrl: string | null) => void;

  // === Queue Actions ===
  addTask: (task: ExportTask) => void;
  addBatchTasks: (tasks: ExportTask[]) => void;
  updateTaskStatus: (taskId: string, status: ExportTaskStatus, errorMessage?: string) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  setTaskProcessId: (taskId: string, processId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  clearAllTasks: () => void;
  setQueueProcessing: (processing: boolean) => void;

  // === Helpers ===
  getActivePreset: () => {
    width: number;
    height: number;
    quality: ExportQualityLevel;
    format: ExportVideoFormat;
    maxDuration: number;
  };

  // === General ===
  clearAll: () => void;
}

let taskIdCounter = 0;
export function generateTaskId(): string {
  taskIdCounter += 1;
  return `export_${Date.now()}_${taskIdCounter}`;
}

export const useExportStore = create<ExportStoreState>((set, get) => ({
  // === Panel State ===
  selectedPlatformId: 'youtube',
  aspectMode: 'pad',
  customWidth: 1920,
  customHeight: 1080,
  customFormat: 'mp4',
  customQuality: 'high',
  gifSettings: { ...DEFAULT_GIF_SETTINGS },

  // === Thumbnail ===
  thumbnailTime: 0,
  thumbnailFormat: 'jpg',
  thumbnailPreview: null,

  // === Export Queue ===
  queue: [],
  isQueueProcessing: false,

  // === Panel Actions ===
  selectPlatform: (id) => {
    set({ selectedPlatformId: id });
  },

  setAspectMode: (mode) => {
    set({ aspectMode: mode });
  },

  setCustomWidth: (width) => {
    set({ customWidth: Math.max(1, Math.round(width)) });
  },

  setCustomHeight: (height) => {
    set({ customHeight: Math.max(1, Math.round(height)) });
  },

  setCustomFormat: (format) => {
    set({ customFormat: format });
  },

  setCustomQuality: (quality) => {
    set({ customQuality: quality });
  },

  setGifSettings: (settings) => {
    set({ gifSettings: { ...get().gifSettings, ...settings } });
  },

  resetGifSettings: () => {
    set({ gifSettings: { ...DEFAULT_GIF_SETTINGS } });
  },

  // === Thumbnail Actions ===
  setThumbnailTime: (time) => {
    set({ thumbnailTime: Math.max(0, time) });
  },

  setThumbnailFormat: (format) => {
    set({ thumbnailFormat: format });
  },

  setThumbnailPreview: (dataUrl) => {
    set({ thumbnailPreview: dataUrl });
  },

  // === Queue Actions ===
  addTask: (task) => {
    set({ queue: [...get().queue, task] });
  },

  addBatchTasks: (tasks) => {
    set({ queue: [...get().queue, ...tasks] });
  },

  updateTaskStatus: (taskId, status, errorMessage) => {
    set({
      queue: get().queue.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              errorMessage,
              progress: status === 'complete' ? 1.0 : t.progress,
            }
          : t
      ),
    });
  },

  updateTaskProgress: (taskId, progress) => {
    set({
      queue: get().queue.map((t) =>
        t.id === taskId ? { ...t, progress: Math.min(progress, 0.99) } : t
      ),
    });
  },

  setTaskProcessId: (taskId, processId) => {
    set({
      queue: get().queue.map((t) =>
        t.id === taskId ? { ...t, processId } : t
      ),
    });
  },

  removeTask: (taskId) => {
    set({ queue: get().queue.filter((t) => t.id !== taskId) });
  },

  clearCompletedTasks: () => {
    set({ queue: get().queue.filter((t) => t.status !== 'complete') });
  },

  clearAllTasks: () => {
    // Only clear non-processing tasks
    set({
      queue: get().queue.filter((t) => t.status === 'processing'),
    });
  },

  setQueueProcessing: (processing) => {
    set({ isQueueProcessing: processing });
  },

  // === Helpers ===
  getActivePreset: () => {
    const state = get();
    if (state.selectedPlatformId === 'custom') {
      return {
        width: state.customWidth,
        height: state.customHeight,
        quality: state.customQuality,
        format: state.customFormat,
        maxDuration: 0,
      };
    }
    const preset = PLATFORM_PRESETS.find((p) => p.id === state.selectedPlatformId);
    if (!preset) {
      return { width: 1920, height: 1080, quality: 'high' as ExportQualityLevel, format: 'mp4' as ExportVideoFormat, maxDuration: 0 };
    }
    return {
      width: preset.width,
      height: preset.height,
      quality: preset.quality,
      format: preset.format,
      maxDuration: preset.maxDuration,
    };
  },

  // === General ===
  clearAll: () => {
    set({
      selectedPlatformId: 'youtube',
      aspectMode: 'pad',
      customWidth: 1920,
      customHeight: 1080,
      customFormat: 'mp4',
      customQuality: 'high',
      gifSettings: { ...DEFAULT_GIF_SETTINGS },
      thumbnailTime: 0,
      thumbnailFormat: 'jpg',
      thumbnailPreview: null,
      queue: [],
      isQueueProcessing: false,
    });
  },
}));
