import { create } from 'zustand';
import type { WatermarkItem } from '../types';

interface WatermarkState {
  /** All watermark items */
  watermarks: WatermarkItem[];
  /** Currently selected watermark id */
  selectedId: string | null;
  /** Number of visible slots (default 3, grows with "add more") */
  slotCount: number;

  /** Actions */
  addWatermark: (wm: WatermarkItem) => void;
  removeWatermark: (id: string) => void;
  updateWatermark: (id: string, updates: Partial<WatermarkItem>) => void;
  selectWatermark: (id: string | null) => void;
  addSlot: () => void;
  clearAll: () => void;

  /** Apply "same as above" - copy opacity & size from previous watermark */
  applySameAsAbove: (id: string) => void;
}

let idCounter = 0;
export function generateWatermarkId(): string {
  return `wm_${Date.now()}_${++idCounter}`;
}

export const useWatermarkStore = create<WatermarkState>((set, get) => ({
  watermarks: [],
  selectedId: null,
  slotCount: 3,

  addWatermark: (wm) =>
    set((state) => ({
      watermarks: [...state.watermarks, wm],
      selectedId: wm.id,
      // Auto-expand slots if needed
      slotCount: Math.max(state.slotCount, state.watermarks.length + 1),
    })),

  removeWatermark: (id) =>
    set((state) => ({
      watermarks: state.watermarks.filter((w) => w.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  updateWatermark: (id, updates) =>
    set((state) => {
      const watermarks = state.watermarks.map((w) => {
        if (w.id !== id) return w;
        const updated = { ...w, ...updates };
        return updated;
      });

      // If this watermark changed size/opacity, propagate to "sameAsAbove" followers
      const changedIdx = watermarks.findIndex((w) => w.id === id);
      if (changedIdx >= 0 && (updates.width !== undefined || updates.height !== undefined || updates.opacity !== undefined)) {
        for (let i = changedIdx + 1; i < watermarks.length; i++) {
          if (watermarks[i].sameAsAbove && changedIdx === i - 1) {
            watermarks[i] = {
              ...watermarks[i],
              width: watermarks[changedIdx].width,
              height: watermarks[changedIdx].height,
              opacity: watermarks[changedIdx].opacity,
            };
          }
        }
      }

      return { watermarks };
    }),

  selectWatermark: (id) =>
    set({ selectedId: id }),

  addSlot: () =>
    set((state) => ({ slotCount: state.slotCount + 1 })),

  clearAll: () =>
    set({ watermarks: [], selectedId: null, slotCount: 3 }),

  applySameAsAbove: (id) => {
    const state = get();
    const idx = state.watermarks.findIndex((w) => w.id === id);
    if (idx <= 0) return; // No previous watermark

    const prev = state.watermarks[idx - 1];
    set((s) => ({
      watermarks: s.watermarks.map((w) =>
        w.id === id
          ? { ...w, width: prev.width, height: prev.height, opacity: prev.opacity, sameAsAbove: true }
          : w,
      ),
    }));
  },
}));
