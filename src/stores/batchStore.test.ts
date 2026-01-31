import { describe, it, expect, beforeEach } from 'vitest';
import { useBatchStore } from './batchStore';
import type { BatchFileStatus } from '../types';

function createMockFiles(count: number): BatchFileStatus[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `/tmp/video${i + 1}.mp4`,
    name: `video${i + 1}.mp4`,
    outputName: `video${i + 1}_watermarked.mp4`,
    status: 'pending' as const,
    progress: 0,
  }));
}

describe('batchStore', () => {
  beforeEach(() => {
    useBatchStore.getState().resetBatch();
  });

  it('starts in idle state', () => {
    const state = useBatchStore.getState().batchState;
    expect(state.status).toBe('idle');
  });

  it('starts a batch', () => {
    const files = createMockFiles(3);
    useBatchStore.getState().startBatch('batch-001', files);

    const state = useBatchStore.getState().batchState;
    expect(state.status).toBe('processing');
    if (state.status === 'processing') {
      expect(state.batchId).toBe('batch-001');
      expect(state.files).toHaveLength(3);
      expect(state.currentIndex).toBe(0);
    }
  });

  it('updates file progress', () => {
    const files = createMockFiles(2);
    useBatchStore.getState().startBatch('batch-002', files);
    useBatchStore.getState().updateFileProgress(0, 0.5);

    const state = useBatchStore.getState().batchState;
    if (state.status === 'processing') {
      expect(state.files[0].progress).toBe(0.5);
      expect(state.files[0].status).toBe('processing');
    }
  });

  it('completes a file', () => {
    const files = createMockFiles(2);
    useBatchStore.getState().startBatch('batch-003', files);
    useBatchStore.getState().completeFile(0);

    const state = useBatchStore.getState().batchState;
    if (state.status === 'processing') {
      expect(state.files[0].status).toBe('complete');
      expect(state.files[0].progress).toBe(1.0);
    }
  });

  it('fails a file with error message', () => {
    const files = createMockFiles(2);
    useBatchStore.getState().startBatch('batch-004', files);
    useBatchStore.getState().failFile(1, 'FFmpeg error: codec not found');

    const state = useBatchStore.getState().batchState;
    if (state.status === 'processing') {
      expect(state.files[1].status).toBe('error');
      expect(state.files[1].error).toBe('FFmpeg error: codec not found');
    }
  });

  it('sets current index', () => {
    const files = createMockFiles(3);
    useBatchStore.getState().startBatch('batch-005', files);
    useBatchStore.getState().setCurrentIndex(2);

    const state = useBatchStore.getState().batchState;
    if (state.status === 'processing') {
      expect(state.currentIndex).toBe(2);
    }
  });

  it('completes batch and calculates counts', () => {
    const files = createMockFiles(3);
    useBatchStore.getState().startBatch('batch-006', files);
    useBatchStore.getState().completeFile(0);
    useBatchStore.getState().completeFile(1);
    useBatchStore.getState().failFile(2, 'error');
    useBatchStore.getState().completeBatch();

    const state = useBatchStore.getState().batchState;
    expect(state.status).toBe('complete');
    if (state.status === 'complete') {
      expect(state.successCount).toBe(2);
      expect(state.errorCount).toBe(1);
      expect(state.files).toHaveLength(3);
    }
  });

  it('resets batch to idle', () => {
    const files = createMockFiles(2);
    useBatchStore.getState().startBatch('batch-007', files);
    useBatchStore.getState().resetBatch();

    expect(useBatchStore.getState().batchState.status).toBe('idle');
  });

  it('ignores updates when not in processing state', () => {
    // In idle state, these should be no-ops
    useBatchStore.getState().updateFileProgress(0, 0.5);
    useBatchStore.getState().completeFile(0);
    useBatchStore.getState().failFile(0, 'err');
    useBatchStore.getState().setCurrentIndex(1);
    useBatchStore.getState().completeBatch();

    expect(useBatchStore.getState().batchState.status).toBe('idle');
  });
});
