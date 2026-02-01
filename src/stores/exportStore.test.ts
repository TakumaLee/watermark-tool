import { describe, it, expect, beforeEach } from 'vitest';
import { useExportStore, generateTaskId } from './exportStore';
import type { ExportTask } from '../types';

function makeTask(overrides: Partial<ExportTask> = {}): ExportTask {
  return {
    id: generateTaskId(),
    platformId: 'youtube',
    platformName: 'YouTube',
    platformIcon: '📺',
    outputPath: '/tmp/test.mp4',
    width: 1920,
    height: 1080,
    aspectMode: 'pad',
    quality: 'high',
    format: 'mp4',
    status: 'pending',
    progress: 0,
    ...overrides,
  };
}

describe('exportStore', () => {
  beforeEach(() => {
    useExportStore.getState().clearAll();
  });

  // === Platform selection ===
  it('should have youtube as default platform', () => {
    expect(useExportStore.getState().selectedPlatformId).toBe('youtube');
  });

  it('should select platform', () => {
    useExportStore.getState().selectPlatform('tiktok');
    expect(useExportStore.getState().selectedPlatformId).toBe('tiktok');
  });

  // === Aspect mode ===
  it('should set aspect mode', () => {
    useExportStore.getState().setAspectMode('crop');
    expect(useExportStore.getState().aspectMode).toBe('crop');
  });

  // === Custom settings ===
  it('should set custom width and height', () => {
    useExportStore.getState().setCustomWidth(1280);
    useExportStore.getState().setCustomHeight(720);
    expect(useExportStore.getState().customWidth).toBe(1280);
    expect(useExportStore.getState().customHeight).toBe(720);
  });

  it('should clamp custom width to minimum 1', () => {
    useExportStore.getState().setCustomWidth(-100);
    expect(useExportStore.getState().customWidth).toBe(1);
  });

  // === GIF settings ===
  it('should update GIF settings partially', () => {
    useExportStore.getState().setGifSettings({ fps: 24, width: 320 });
    const settings = useExportStore.getState().gifSettings;
    expect(settings.fps).toBe(24);
    expect(settings.width).toBe(320);
    expect(settings.colors).toBe(256); // Unchanged default
  });

  it('should reset GIF settings', () => {
    useExportStore.getState().setGifSettings({ fps: 24 });
    useExportStore.getState().resetGifSettings();
    expect(useExportStore.getState().gifSettings.fps).toBe(15);
  });

  // === Thumbnail ===
  it('should set thumbnail time', () => {
    useExportStore.getState().setThumbnailTime(30.5);
    expect(useExportStore.getState().thumbnailTime).toBe(30.5);
  });

  it('should clamp thumbnail time to 0', () => {
    useExportStore.getState().setThumbnailTime(-5);
    expect(useExportStore.getState().thumbnailTime).toBe(0);
  });

  it('should set thumbnail format', () => {
    useExportStore.getState().setThumbnailFormat('png');
    expect(useExportStore.getState().thumbnailFormat).toBe('png');
  });

  it('should set thumbnail preview', () => {
    useExportStore.getState().setThumbnailPreview('/tmp/thumb.jpg');
    expect(useExportStore.getState().thumbnailPreview).toBe('/tmp/thumb.jpg');
  });

  // === Queue management ===
  it('should add task to queue', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    expect(useExportStore.getState().queue).toHaveLength(1);
    expect(useExportStore.getState().queue[0].id).toBe(task.id);
  });

  it('should add batch tasks', () => {
    const tasks = [
      makeTask({ platformId: 'youtube' }),
      makeTask({ platformId: 'tiktok' }),
      makeTask({ platformId: 'twitter' }),
    ];
    useExportStore.getState().addBatchTasks(tasks);
    expect(useExportStore.getState().queue).toHaveLength(3);
  });

  it('should update task status', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().updateTaskStatus(task.id, 'processing');
    expect(useExportStore.getState().queue[0].status).toBe('processing');
  });

  it('should set progress to 1.0 on complete', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().updateTaskStatus(task.id, 'complete');
    expect(useExportStore.getState().queue[0].progress).toBe(1.0);
  });

  it('should update task progress', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().updateTaskProgress(task.id, 0.75);
    expect(useExportStore.getState().queue[0].progress).toBe(0.75);
  });

  it('should clamp progress to 0.99', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().updateTaskProgress(task.id, 1.5);
    expect(useExportStore.getState().queue[0].progress).toBe(0.99);
  });

  it('should set task process ID', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().setTaskProcessId(task.id, 'proc_123');
    expect(useExportStore.getState().queue[0].processId).toBe('proc_123');
  });

  it('should remove task', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().removeTask(task.id);
    expect(useExportStore.getState().queue).toHaveLength(0);
  });

  it('should clear completed tasks', () => {
    const t1 = makeTask({ status: 'complete' as const, progress: 1.0 });
    const t2 = makeTask({ status: 'pending' as const });
    const t3 = makeTask({ status: 'failed' as const });
    useExportStore.getState().addBatchTasks([t1, t2, t3]);
    useExportStore.getState().clearCompletedTasks();
    expect(useExportStore.getState().queue).toHaveLength(2);
    expect(useExportStore.getState().queue.every((t) => t.status !== 'complete')).toBe(true);
  });

  it('should clear all non-processing tasks', () => {
    const t1 = makeTask({ status: 'pending' as const });
    const t2 = makeTask({ status: 'processing' as const });
    useExportStore.getState().addBatchTasks([t1, t2]);
    useExportStore.getState().clearAllTasks();
    expect(useExportStore.getState().queue).toHaveLength(1);
    expect(useExportStore.getState().queue[0].status).toBe('processing');
  });

  // === getActivePreset ===
  it('should return youtube preset by default', () => {
    const preset = useExportStore.getState().getActivePreset();
    expect(preset.width).toBe(1920);
    expect(preset.height).toBe(1080);
  });

  it('should return custom preset when selected', () => {
    useExportStore.getState().selectPlatform('custom');
    useExportStore.getState().setCustomWidth(640);
    useExportStore.getState().setCustomHeight(480);
    const preset = useExportStore.getState().getActivePreset();
    expect(preset.width).toBe(640);
    expect(preset.height).toBe(480);
  });

  it('should return tiktok preset', () => {
    useExportStore.getState().selectPlatform('tiktok');
    const preset = useExportStore.getState().getActivePreset();
    expect(preset.width).toBe(1080);
    expect(preset.height).toBe(1920);
  });

  // === clearAll ===
  it('should reset everything', () => {
    useExportStore.getState().selectPlatform('tiktok');
    useExportStore.getState().setAspectMode('crop');
    useExportStore.getState().addTask(makeTask());
    useExportStore.getState().setThumbnailTime(50);
    useExportStore.getState().clearAll();

    const state = useExportStore.getState();
    expect(state.selectedPlatformId).toBe('youtube');
    expect(state.aspectMode).toBe('pad');
    expect(state.queue).toHaveLength(0);
    expect(state.thumbnailTime).toBe(0);
  });

  // === Task ID uniqueness ===
  it('should generate unique task IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTaskId()));
    expect(ids.size).toBe(50);
  });

  // === Queue processing flag ===
  it('should set queue processing state', () => {
    useExportStore.getState().setQueueProcessing(true);
    expect(useExportStore.getState().isQueueProcessing).toBe(true);
    useExportStore.getState().setQueueProcessing(false);
    expect(useExportStore.getState().isQueueProcessing).toBe(false);
  });

  // === Update task with error message ===
  it('should store error message on failure', () => {
    const task = makeTask();
    useExportStore.getState().addTask(task);
    useExportStore.getState().updateTaskStatus(task.id, 'failed', 'FFmpeg crashed');
    expect(useExportStore.getState().queue[0].errorMessage).toBe('FFmpeg crashed');
  });
});
