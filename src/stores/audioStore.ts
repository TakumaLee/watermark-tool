import { create } from 'zustand';
import type {
  BGMItem,
  AudioFadeSettings,
  ClipVolumeOverride,
  WaveformData,
} from '../types';

interface AudioStoreState {
  /** Main volume (0-200, percentage) */
  mainVolume: number;
  /** Whether main audio is muted */
  mainMuted: boolean;
  /** Main audio fade settings */
  mainFade: AudioFadeSettings;
  /** Main video's waveform data */
  mainWaveform: WaveformData | null;
  /** BGM items */
  bgmItems: BGMItem[];
  /** Per-clip volume overrides */
  clipVolumes: ClipVolumeOverride[];
  /** Selected BGM item ID */
  selectedBgmId: string | null;

  // --- Actions ---
  /** Set main volume */
  setMainVolume: (volume: number) => void;
  /** Toggle main mute */
  toggleMainMute: () => void;
  /** Set main muted state */
  setMainMuted: (muted: boolean) => void;
  /** Set main fade settings */
  setMainFade: (fade: Partial<AudioFadeSettings>) => void;
  /** Set main waveform data */
  setMainWaveform: (waveform: WaveformData | null) => void;

  /** Add a BGM item */
  addBgm: (bgm: BGMItem) => void;
  /** Remove a BGM item */
  removeBgm: (id: string) => void;
  /** Update a BGM item */
  updateBgm: (id: string, updates: Partial<BGMItem>) => void;
  /** Select a BGM item */
  selectBgm: (id: string | null) => void;
  /** Set BGM waveform */
  setBgmWaveform: (id: string, waveform: WaveformData) => void;

  /** Set clip volume override */
  setClipVolume: (clipId: string, volume: number) => void;
  /** Toggle clip mute */
  toggleClipMute: (clipId: string) => void;
  /** Remove clip volume override */
  removeClipVolume: (clipId: string) => void;

  /** Clear all audio state */
  clearAll: () => void;
}

let bgmIdCounter = 0;
export function generateBgmId(): string {
  bgmIdCounter += 1;
  return `bgm_${Date.now()}_${bgmIdCounter}`;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  mainVolume: 100,
  mainMuted: false,
  mainFade: { fadeInDuration: 0, fadeOutDuration: 0 },
  mainWaveform: null,
  bgmItems: [],
  clipVolumes: [],
  selectedBgmId: null,

  setMainVolume: (volume) => {
    set({ mainVolume: Math.max(0, Math.min(200, volume)) });
  },

  toggleMainMute: () => {
    set((s) => ({ mainMuted: !s.mainMuted }));
  },

  setMainMuted: (muted) => {
    set({ mainMuted: muted });
  },

  setMainFade: (fade) => {
    set((s) => ({
      mainFade: { ...s.mainFade, ...fade },
    }));
  },

  setMainWaveform: (waveform) => {
    set({ mainWaveform: waveform });
  },

  addBgm: (bgm) => {
    set((s) => ({ bgmItems: [...s.bgmItems, bgm] }));
  },

  removeBgm: (id) => {
    set((s) => ({
      bgmItems: s.bgmItems.filter((b) => b.id !== id),
      selectedBgmId: s.selectedBgmId === id ? null : s.selectedBgmId,
    }));
  },

  updateBgm: (id, updates) => {
    set((s) => ({
      bgmItems: s.bgmItems.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  },

  selectBgm: (id) => {
    set({ selectedBgmId: id });
  },

  setBgmWaveform: (id, waveform) => {
    set((s) => ({
      bgmItems: s.bgmItems.map((b) =>
        b.id === id ? { ...b, waveform } : b
      ),
    }));
  },

  setClipVolume: (clipId, volume) => {
    set((s) => {
      const existing = s.clipVolumes.find((cv) => cv.clipId === clipId);
      if (existing) {
        return {
          clipVolumes: s.clipVolumes.map((cv) =>
            cv.clipId === clipId ? { ...cv, volume: Math.max(0, Math.min(200, volume)) } : cv
          ),
        };
      }
      return {
        clipVolumes: [
          ...s.clipVolumes,
          { clipId, volume: Math.max(0, Math.min(200, volume)), isMuted: false },
        ],
      };
    });
  },

  toggleClipMute: (clipId) => {
    set((s) => {
      const existing = s.clipVolumes.find((cv) => cv.clipId === clipId);
      if (existing) {
        return {
          clipVolumes: s.clipVolumes.map((cv) =>
            cv.clipId === clipId ? { ...cv, isMuted: !cv.isMuted } : cv
          ),
        };
      }
      return {
        clipVolumes: [
          ...s.clipVolumes,
          { clipId, volume: 100, isMuted: true },
        ],
      };
    });
  },

  removeClipVolume: (clipId) => {
    set((s) => ({
      clipVolumes: s.clipVolumes.filter((cv) => cv.clipId !== clipId),
    }));
  },

  clearAll: () => {
    set({
      mainVolume: 100,
      mainMuted: false,
      mainFade: { fadeInDuration: 0, fadeOutDuration: 0 },
      mainWaveform: null,
      bgmItems: [],
      clipVolumes: [],
      selectedBgmId: null,
    });
  },
}));
