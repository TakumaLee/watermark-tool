import { create } from 'zustand';
import type { RenderState } from '../types';

interface RenderStoreState {
  /** Current render state */
  renderState: RenderState;

  /** Actions */
  startRender: (processId: string) => void;
  updateProgress: (progress: number) => void;
  completeRender: (outputPath: string) => void;
  failRender: (message: string) => void;
  resetRender: () => void;
}

export const useRenderStore = create<RenderStoreState>((set) => ({
  renderState: { status: 'idle' },

  startRender: (processId) =>
    set({ renderState: { status: 'rendering', processId, progress: 0 } }),

  updateProgress: (progress) =>
    set((state) => {
      if (state.renderState.status !== 'rendering') return state;
      return { renderState: { ...state.renderState, progress } };
    }),

  completeRender: (outputPath) =>
    set({ renderState: { status: 'complete', outputPath } }),

  failRender: (message) =>
    set({ renderState: { status: 'error', message } }),

  resetRender: () =>
    set({ renderState: { status: 'idle' } }),
}));
