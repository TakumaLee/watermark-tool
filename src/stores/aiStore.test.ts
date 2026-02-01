import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from './aiStore';
import {
  DEFAULT_WHISPER_CONFIG,
  DEFAULT_SCENE_DETECT_CONFIG,
  DEFAULT_CHROMAKEY_CONFIG,
  DEFAULT_ENHANCEMENT_CONFIG,
  DEFAULT_SILENCE_DETECT_CONFIG,
} from '../types';

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.getState().clearAll();
  });

  // === Whisper ===

  it('should initialize with default whisper config', () => {
    const state = useAIStore.getState();
    expect(state.whisperConfig).toEqual(DEFAULT_WHISPER_CONFIG);
    expect(state.whisperState.status).toBe('idle');
    expect(state.whisperResults).toEqual([]);
    expect(state.whisperAvailable).toBeNull();
  });

  it('should update whisper config', () => {
    useAIStore.getState().setWhisperConfig({ language: 'ja', model: 'small' });
    const state = useAIStore.getState();
    expect(state.whisperConfig.language).toBe('ja');
    expect(state.whisperConfig.model).toBe('small');
  });

  it('should set whisper state', () => {
    useAIStore.getState().setWhisperState({ status: 'running', progress: 50 });
    expect(useAIStore.getState().whisperState.status).toBe('running');
    expect(useAIStore.getState().whisperState.progress).toBe(50);
  });

  it('should set and clear whisper results', () => {
    const results = [
      { index: 1, startTime: 0, endTime: 2, text: 'Hello' },
      { index: 2, startTime: 3, endTime: 5, text: 'World' },
    ];
    useAIStore.getState().setWhisperResults(results);
    expect(useAIStore.getState().whisperResults.length).toBe(2);

    useAIStore.getState().clearWhisperResults();
    expect(useAIStore.getState().whisperResults.length).toBe(0);
    expect(useAIStore.getState().whisperState.status).toBe('idle');
  });

  it('should set whisper availability', () => {
    useAIStore.getState().setWhisperAvailable(true);
    expect(useAIStore.getState().whisperAvailable).toBe(true);
  });

  // === Scene Detection ===

  it('should initialize with default scene detect config', () => {
    expect(useAIStore.getState().sceneDetectConfig).toEqual(DEFAULT_SCENE_DETECT_CONFIG);
    expect(useAIStore.getState().sceneChangePoints).toEqual([]);
  });

  it('should set scene detect config', () => {
    useAIStore.getState().setSceneDetectConfig({ threshold: 0.5 });
    expect(useAIStore.getState().sceneDetectConfig.threshold).toBe(0.5);
  });

  it('should set and clear scene change points', () => {
    const points = [
      { timestamp: 5.0, score: 0.8 },
      { timestamp: 12.3, score: 0.6 },
    ];
    useAIStore.getState().setSceneChangePoints(points);
    expect(useAIStore.getState().sceneChangePoints.length).toBe(2);

    useAIStore.getState().clearSceneChangePoints();
    expect(useAIStore.getState().sceneChangePoints.length).toBe(0);
  });

  // === Chromakey ===

  it('should initialize with default chromakey config', () => {
    expect(useAIStore.getState().chromakeyConfig).toEqual(DEFAULT_CHROMAKEY_CONFIG);
    expect(useAIStore.getState().chromakeyState.enabled).toBe(false);
  });

  it('should update chromakey config and toggle', () => {
    useAIStore.getState().setChromakeyConfig({ color: '#0000ff', similarity: 0.5 });
    expect(useAIStore.getState().chromakeyConfig.color).toBe('#0000ff');
    expect(useAIStore.getState().chromakeyConfig.similarity).toBe(0.5);

    useAIStore.getState().setChromakeyEnabled(true);
    expect(useAIStore.getState().chromakeyState.enabled).toBe(true);
  });

  // === Enhancement ===

  it('should initialize with default enhancement config', () => {
    expect(useAIStore.getState().enhancementConfig).toEqual(DEFAULT_ENHANCEMENT_CONFIG);
  });

  it('should toggle individual enhancement features', () => {
    useAIStore.getState().setSharpenEnabled(true);
    expect(useAIStore.getState().enhancementConfig.sharpen.enabled).toBe(true);

    useAIStore.getState().setDenoiseEnabled(true);
    expect(useAIStore.getState().enhancementConfig.denoise.enabled).toBe(true);

    useAIStore.getState().setUpscaleEnabled(true);
    expect(useAIStore.getState().enhancementConfig.upscale.enabled).toBe(true);
  });

  it('should update enhancement config partially', () => {
    useAIStore.getState().setEnhancementConfig({
      sharpen: { enabled: true, lumaX: 7, lumaY: 7, lumaAmount: 2.0 },
    });
    expect(useAIStore.getState().enhancementConfig.sharpen.lumaAmount).toBe(2.0);
    // Other fields preserved
    expect(useAIStore.getState().enhancementConfig.denoise).toBeDefined();
  });

  it('should reset enhancement', () => {
    useAIStore.getState().setSharpenEnabled(true);
    useAIStore.getState().setDenoiseEnabled(true);
    useAIStore.getState().resetEnhancement();
    expect(useAIStore.getState().enhancementConfig).toEqual(DEFAULT_ENHANCEMENT_CONFIG);
  });

  // === Silence Detection ===

  it('should initialize with default silence detect config', () => {
    expect(useAIStore.getState().silenceDetectConfig).toEqual(DEFAULT_SILENCE_DETECT_CONFIG);
    expect(useAIStore.getState().silenceSegments).toEqual([]);
    expect(useAIStore.getState().editSuggestions).toEqual([]);
  });

  it('should set silence segments and suggestions', () => {
    const segments = [
      { startTime: 1, endTime: 3, duration: 2 },
      { startTime: 10, endTime: 15, duration: 5 },
    ];
    useAIStore.getState().setSilenceSegments(segments);
    expect(useAIStore.getState().silenceSegments.length).toBe(2);

    const suggestions = [
      { type: 'remove_silence' as const, startTime: 1, endTime: 3, description: 'test' },
    ];
    useAIStore.getState().setEditSuggestions(suggestions);
    expect(useAIStore.getState().editSuggestions.length).toBe(1);
  });

  it('should clear silence results', () => {
    useAIStore.getState().setSilenceSegments([{ startTime: 0, endTime: 1, duration: 1 }]);
    useAIStore.getState().setEditSuggestions([
      { type: 'remove_silence', startTime: 0, endTime: 1, description: 'test' },
    ]);
    useAIStore.getState().clearSilenceResults();
    expect(useAIStore.getState().silenceSegments.length).toBe(0);
    expect(useAIStore.getState().editSuggestions.length).toBe(0);
  });

  it('should update silence detect config', () => {
    useAIStore.getState().setSilenceDetectConfig({ noiseThresholdDb: -40, minDurationSec: 3 });
    expect(useAIStore.getState().silenceDetectConfig.noiseThresholdDb).toBe(-40);
    expect(useAIStore.getState().silenceDetectConfig.minDurationSec).toBe(3);
  });

  // === General ===

  it('should clear all state', () => {
    // Set some state
    useAIStore.getState().setWhisperResults([{ index: 1, startTime: 0, endTime: 1, text: 'hi' }]);
    useAIStore.getState().setSceneChangePoints([{ timestamp: 5, score: 0.8 }]);
    useAIStore.getState().setChromakeyEnabled(true);
    useAIStore.getState().setSharpenEnabled(true);
    useAIStore.getState().setSilenceSegments([{ startTime: 0, endTime: 1, duration: 1 }]);

    useAIStore.getState().clearAll();

    const state = useAIStore.getState();
    expect(state.whisperResults.length).toBe(0);
    expect(state.sceneChangePoints.length).toBe(0);
    expect(state.chromakeyState.enabled).toBe(false);
    expect(state.enhancementConfig.sharpen.enabled).toBe(false);
    expect(state.silenceSegments.length).toBe(0);
  });
});
