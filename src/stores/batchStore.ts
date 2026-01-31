import { create } from 'zustand';
import type { BatchFileStatus } from '../types';

export type BatchState =
  | { status: 'idle' }
  | {
      status: 'processing';
      batchId: string;
      files: BatchFileStatus[];
      currentIndex: number;
    }
  | {
      status: 'complete';
      files: BatchFileStatus[];
      successCount: number;
      errorCount: number;
    }
  | { status: 'error'; message: string };

interface BatchStoreState {
  batchState: BatchState;

  startBatch: (batchId: string, files: BatchFileStatus[]) => void;
  updateFileProgress: (index: number, progress: number) => void;
  completeFile: (index: number) => void;
  failFile: (index: number, error: string) => void;
  setCurrentIndex: (index: number) => void;
  completeBatch: () => void;
  resetBatch: () => void;
}

export const useBatchStore = create<BatchStoreState>((set) => ({
  batchState: { status: 'idle' },

  startBatch: (batchId, files) =>
    set({
      batchState: {
        status: 'processing',
        batchId,
        files,
        currentIndex: 0,
      },
    }),

  updateFileProgress: (index, progress) =>
    set((state) => {
      if (state.batchState.status !== 'processing') return state;
      const files = [...state.batchState.files];
      if (files[index]) {
        files[index] = { ...files[index], status: 'processing', progress };
      }
      return { batchState: { ...state.batchState, files, currentIndex: index } };
    }),

  completeFile: (index) =>
    set((state) => {
      if (state.batchState.status !== 'processing') return state;
      const files = [...state.batchState.files];
      if (files[index]) {
        files[index] = { ...files[index], status: 'complete', progress: 1.0 };
      }
      return { batchState: { ...state.batchState, files } };
    }),

  failFile: (index, error) =>
    set((state) => {
      if (state.batchState.status !== 'processing') return state;
      const files = [...state.batchState.files];
      if (files[index]) {
        files[index] = { ...files[index], status: 'error', progress: 0, error };
      }
      return { batchState: { ...state.batchState, files } };
    }),

  setCurrentIndex: (index) =>
    set((state) => {
      if (state.batchState.status !== 'processing') return state;
      return { batchState: { ...state.batchState, currentIndex: index } };
    }),

  completeBatch: () =>
    set((state) => {
      if (state.batchState.status !== 'processing') return state;
      const files = state.batchState.files;
      const successCount = files.filter((f) => f.status === 'complete').length;
      const errorCount = files.filter((f) => f.status === 'error').length;
      return {
        batchState: { status: 'complete', files, successCount, errorCount },
      };
    }),

  resetBatch: () => set({ batchState: { status: 'idle' } }),
}));
