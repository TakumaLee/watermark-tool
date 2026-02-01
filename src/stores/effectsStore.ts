import { create } from 'zustand';
import type {
  ClipTransition,
  FilterAdjustments,
  PiPConfig,
  TransformConfig,
  RotationAngle,
  FlipDirection,
  CropRegion,
  TransitionType,
  TransitionDuration,
  SpeedValue,
} from '../types';
import { DEFAULT_FILTER_ADJUSTMENTS, DEFAULT_TRANSFORM } from '../types';

interface EffectsStoreState {
  // === Transitions ===
  /** Map of "clipId1->clipId2" to transition config */
  transitions: Map<string, ClipTransition>;
  setTransition: (fromClipId: string, toClipId: string, transition: ClipTransition | null) => void;
  getTransition: (fromClipId: string, toClipId: string) => ClipTransition | null;
  clearTransitions: () => void;

  // === Filters ===
  filters: FilterAdjustments;
  activePresetId: string | null;
  setFilters: (filters: FilterAdjustments) => void;
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  setSaturation: (value: number) => void;
  setActivePreset: (presetId: string | null) => void;
  resetFilters: () => void;

  // === Speed ===
  speed: SpeedValue;
  reverse: boolean;
  setSpeed: (speed: SpeedValue) => void;
  setReverse: (reverse: boolean) => void;

  // === PiP ===
  pipLayers: PiPConfig[];
  selectedPipId: string | null;
  addPip: (pip: PiPConfig) => void;
  updatePip: (id: string, updates: Partial<PiPConfig>) => void;
  removePip: (id: string) => void;
  selectPip: (id: string | null) => void;

  // === Transform (Crop/Rotate/Flip) ===
  transform: TransformConfig;
  setRotation: (angle: RotationAngle) => void;
  setFlip: (direction: FlipDirection) => void;
  setCrop: (crop: CropRegion | null) => void;
  resetTransform: () => void;

  // === General ===
  clearAll: () => void;
}

let pipIdCounter = 0;
export function generatePipId(): string {
  pipIdCounter += 1;
  return `pip_${Date.now()}_${pipIdCounter}`;
}

export const useEffectsStore = create<EffectsStoreState>((set, get) => ({
  // === Transitions ===
  transitions: new Map(),

  setTransition: (fromClipId, toClipId, transition) => {
    const key = `${fromClipId}->${toClipId}`;
    const next = new Map(get().transitions);
    if (transition) {
      next.set(key, transition);
    } else {
      next.delete(key);
    }
    set({ transitions: next });
  },

  getTransition: (fromClipId, toClipId) => {
    const key = `${fromClipId}->${toClipId}`;
    return get().transitions.get(key) ?? null;
  },

  clearTransitions: () => {
    set({ transitions: new Map() });
  },

  // === Filters ===
  filters: { ...DEFAULT_FILTER_ADJUSTMENTS },
  activePresetId: null,

  setFilters: (filters) => {
    set({ filters, activePresetId: null });
  },

  setBrightness: (value) => {
    const f = { ...get().filters, brightness: value };
    set({ filters: f, activePresetId: null });
  },

  setContrast: (value) => {
    const f = { ...get().filters, contrast: value };
    set({ filters: f, activePresetId: null });
  },

  setSaturation: (value) => {
    const f = { ...get().filters, saturation: value };
    set({ filters: f, activePresetId: null });
  },

  setActivePreset: (presetId) => {
    set({ activePresetId: presetId });
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTER_ADJUSTMENTS }, activePresetId: 'none' });
  },

  // === Speed ===
  speed: 1,
  reverse: false,

  setSpeed: (speed) => {
    set({ speed });
  },

  setReverse: (reverse) => {
    set({ reverse });
  },

  // === PiP ===
  pipLayers: [],
  selectedPipId: null,

  addPip: (pip) => {
    set({ pipLayers: [...get().pipLayers, pip] });
  },

  updatePip: (id, updates) => {
    set({
      pipLayers: get().pipLayers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
  },

  removePip: (id) => {
    const next = get().pipLayers.filter((p) => p.id !== id);
    const selected = get().selectedPipId === id ? null : get().selectedPipId;
    set({ pipLayers: next, selectedPipId: selected });
  },

  selectPip: (id) => {
    set({ selectedPipId: id });
  },

  // === Transform ===
  transform: { ...DEFAULT_TRANSFORM },

  setRotation: (angle) => {
    set({ transform: { ...get().transform, rotation: angle } });
  },

  setFlip: (direction) => {
    set({ transform: { ...get().transform, flip: direction } });
  },

  setCrop: (crop) => {
    set({ transform: { ...get().transform, crop } });
  },

  resetTransform: () => {
    set({ transform: { ...DEFAULT_TRANSFORM } });
  },

  // === General ===
  clearAll: () => {
    set({
      transitions: new Map(),
      filters: { ...DEFAULT_FILTER_ADJUSTMENTS },
      activePresetId: null,
      speed: 1,
      reverse: false,
      pipLayers: [],
      selectedPipId: null,
      transform: { ...DEFAULT_TRANSFORM },
    });
  },
}));
