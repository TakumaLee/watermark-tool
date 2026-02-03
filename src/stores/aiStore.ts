import { create } from 'zustand';
import type {
  WhisperConfig,
  WhisperState,
  WhisperResultEntry,
  SceneDetectConfig,
  SceneDetectState,
  SceneChangePoint,
  ChromakeyConfig,
  ChromakeyState,
  EnhancementConfig,
  EnhancementState,
  SilenceDetectConfig,
  SilenceDetectState,
  SilenceSegment,
  EditSuggestion,
} from '../types';
import {
  DEFAULT_WHISPER_CONFIG,
  DEFAULT_SCENE_DETECT_CONFIG,
  DEFAULT_CHROMAKEY_CONFIG,
  DEFAULT_ENHANCEMENT_CONFIG,
  DEFAULT_SILENCE_DETECT_CONFIG,
} from '../types';

interface AIStoreState {
  // === Whisper Auto-Subtitle ===
  whisperConfig: WhisperConfig;
  whisperState: WhisperState;
  whisperResults: WhisperResultEntry[];
  whisperAvailable: boolean | null; // null = not checked yet

  setWhisperConfig: (updates: Partial<WhisperConfig>) => void;
  setWhisperState: (updates: Partial<WhisperState>) => void;
  setWhisperResults: (results: WhisperResultEntry[]) => void;
  setWhisperAvailable: (available: boolean) => void;
  clearWhisperResults: () => void;

  // === Scene Detection ===
  sceneDetectConfig: SceneDetectConfig;
  sceneDetectState: SceneDetectState;
  sceneChangePoints: SceneChangePoint[];

  setSceneDetectConfig: (updates: Partial<SceneDetectConfig>) => void;
  setSceneDetectState: (updates: Partial<SceneDetectState>) => void;
  setSceneChangePoints: (points: SceneChangePoint[]) => void;
  clearSceneChangePoints: () => void;

  // === Chromakey (Background Removal) ===
  chromakeyConfig: ChromakeyConfig;
  chromakeyState: ChromakeyState;

  setChromakeyConfig: (updates: Partial<ChromakeyConfig>) => void;
  setChromakeyEnabled: (enabled: boolean) => void;

  // === Quality Enhancement ===
  enhancementConfig: EnhancementConfig;
  enhancementState: EnhancementState;

  setEnhancementConfig: (updates: Partial<EnhancementConfig>) => void;
  setSharpenEnabled: (enabled: boolean) => void;
  setDenoiseEnabled: (enabled: boolean) => void;
  setUpscaleEnabled: (enabled: boolean) => void;
  resetEnhancement: () => void;

  // === Silence Detection / Auto-Edit ===
  silenceDetectConfig: SilenceDetectConfig;
  silenceDetectState: SilenceDetectState;
  silenceSegments: SilenceSegment[];
  editSuggestions: EditSuggestion[];

  setSilenceDetectConfig: (updates: Partial<SilenceDetectConfig>) => void;
  setSilenceDetectState: (updates: Partial<SilenceDetectState>) => void;
  setSilenceSegments: (segments: SilenceSegment[]) => void;
  setEditSuggestions: (suggestions: EditSuggestion[]) => void;
  clearSilenceResults: () => void;

  // === General ===
  clearAll: () => void;
}

export const useAIStore = create<AIStoreState>((set, _get) => ({
  // === Whisper ===
  whisperConfig: { ...DEFAULT_WHISPER_CONFIG },
  whisperState: { status: 'idle', progress: 0, progressText: '', error: null },
  whisperResults: [],
  whisperAvailable: null,

  setWhisperConfig: (updates) =>
    set((state) => ({
      whisperConfig: { ...state.whisperConfig, ...updates },
    })),

  setWhisperState: (updates) =>
    set((state) => ({
      whisperState: { ...state.whisperState, ...updates },
    })),

  setWhisperResults: (results) =>
    set({ whisperResults: results }),

  setWhisperAvailable: (available) =>
    set({ whisperAvailable: available }),

  clearWhisperResults: () =>
    set({
      whisperResults: [],
      whisperState: { status: 'idle', progress: 0, progressText: '', error: null },
    }),

  // === Scene Detection ===
  sceneDetectConfig: { ...DEFAULT_SCENE_DETECT_CONFIG },
  sceneDetectState: { status: 'idle', progress: 0, error: null },
  sceneChangePoints: [],

  setSceneDetectConfig: (updates) =>
    set((state) => ({
      sceneDetectConfig: { ...state.sceneDetectConfig, ...updates },
    })),

  setSceneDetectState: (updates) =>
    set((state) => ({
      sceneDetectState: { ...state.sceneDetectState, ...updates },
    })),

  setSceneChangePoints: (points) =>
    set({ sceneChangePoints: points }),

  clearSceneChangePoints: () =>
    set({
      sceneChangePoints: [],
      sceneDetectState: { status: 'idle', progress: 0, error: null },
    }),

  // === Chromakey ===
  chromakeyConfig: { ...DEFAULT_CHROMAKEY_CONFIG },
  chromakeyState: { enabled: false },

  setChromakeyConfig: (updates) =>
    set((state) => ({
      chromakeyConfig: { ...state.chromakeyConfig, ...updates },
    })),

  setChromakeyEnabled: (enabled) =>
    set({ chromakeyState: { enabled } }),

  // === Enhancement ===
  enhancementConfig: { ...DEFAULT_ENHANCEMENT_CONFIG },
  enhancementState: { status: 'idle', progress: 0, error: null },

  setEnhancementConfig: (updates) =>
    set((state) => ({
      enhancementConfig: { ...state.enhancementConfig, ...updates },
    })),

  setSharpenEnabled: (enabled) =>
    set((state) => ({
      enhancementConfig: {
        ...state.enhancementConfig,
        sharpen: { ...state.enhancementConfig.sharpen, enabled },
      },
    })),

  setDenoiseEnabled: (enabled) =>
    set((state) => ({
      enhancementConfig: {
        ...state.enhancementConfig,
        denoise: { ...state.enhancementConfig.denoise, enabled },
      },
    })),

  setUpscaleEnabled: (enabled) =>
    set((state) => ({
      enhancementConfig: {
        ...state.enhancementConfig,
        upscale: { ...state.enhancementConfig.upscale, enabled },
      },
    })),

  resetEnhancement: () =>
    set({
      enhancementConfig: { ...DEFAULT_ENHANCEMENT_CONFIG },
      enhancementState: { status: 'idle', progress: 0, error: null },
    }),

  // === Silence Detection ===
  silenceDetectConfig: { ...DEFAULT_SILENCE_DETECT_CONFIG },
  silenceDetectState: { status: 'idle', progress: 0, error: null },
  silenceSegments: [],
  editSuggestions: [],

  setSilenceDetectConfig: (updates) =>
    set((state) => ({
      silenceDetectConfig: { ...state.silenceDetectConfig, ...updates },
    })),

  setSilenceDetectState: (updates) =>
    set((state) => ({
      silenceDetectState: { ...state.silenceDetectState, ...updates },
    })),

  setSilenceSegments: (segments) =>
    set({ silenceSegments: segments }),

  setEditSuggestions: (suggestions) =>
    set({ editSuggestions: suggestions }),

  clearSilenceResults: () =>
    set({
      silenceSegments: [],
      editSuggestions: [],
      silenceDetectState: { status: 'idle', progress: 0, error: null },
    }),

  // === General ===
  clearAll: () =>
    set({
      whisperConfig: { ...DEFAULT_WHISPER_CONFIG },
      whisperState: { status: 'idle', progress: 0, progressText: '', error: null },
      whisperResults: [],
      sceneDetectConfig: { ...DEFAULT_SCENE_DETECT_CONFIG },
      sceneDetectState: { status: 'idle', progress: 0, error: null },
      sceneChangePoints: [],
      chromakeyConfig: { ...DEFAULT_CHROMAKEY_CONFIG },
      chromakeyState: { enabled: false },
      enhancementConfig: { ...DEFAULT_ENHANCEMENT_CONFIG },
      enhancementState: { status: 'idle', progress: 0, error: null },
      silenceDetectConfig: { ...DEFAULT_SILENCE_DETECT_CONFIG },
      silenceDetectState: { status: 'idle', progress: 0, error: null },
      silenceSegments: [],
      editSuggestions: [],
    }),
}));
