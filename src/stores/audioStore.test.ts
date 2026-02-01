import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioStore } from './audioStore';

describe('audioStore', () => {
  beforeEach(() => {
    // Reset store
    useAudioStore.getState().clearAll();
  });

  it('should have correct default values', () => {
    const state = useAudioStore.getState();
    expect(state.mainVolume).toBe(100);
    expect(state.mainMuted).toBe(false);
    expect(state.mainFade.fadeInDuration).toBe(0);
    expect(state.mainFade.fadeOutDuration).toBe(0);
    expect(state.mainWaveform).toBeNull();
    expect(state.bgmItems).toHaveLength(0);
    expect(state.clipVolumes).toHaveLength(0);
    expect(state.selectedBgmId).toBeNull();
  });

  it('should set main volume clamped to 0-200', () => {
    const { setMainVolume } = useAudioStore.getState();
    setMainVolume(150);
    expect(useAudioStore.getState().mainVolume).toBe(150);

    setMainVolume(-10);
    expect(useAudioStore.getState().mainVolume).toBe(0);

    setMainVolume(300);
    expect(useAudioStore.getState().mainVolume).toBe(200);
  });

  it('should toggle main mute', () => {
    const { toggleMainMute } = useAudioStore.getState();
    expect(useAudioStore.getState().mainMuted).toBe(false);
    toggleMainMute();
    expect(useAudioStore.getState().mainMuted).toBe(true);
    toggleMainMute();
    expect(useAudioStore.getState().mainMuted).toBe(false);
  });

  it('should set main fade', () => {
    const { setMainFade } = useAudioStore.getState();
    setMainFade({ fadeInDuration: 2 });
    expect(useAudioStore.getState().mainFade.fadeInDuration).toBe(2);
    expect(useAudioStore.getState().mainFade.fadeOutDuration).toBe(0);

    setMainFade({ fadeOutDuration: 3 });
    expect(useAudioStore.getState().mainFade.fadeInDuration).toBe(2);
    expect(useAudioStore.getState().mainFade.fadeOutDuration).toBe(3);
  });

  it('should set main waveform', () => {
    const { setMainWaveform } = useAudioStore.getState();
    const waveform = { peaks: [0.1, 0.5, 0.3], sampleRate: 8000, duration: 10 };
    setMainWaveform(waveform);
    expect(useAudioStore.getState().mainWaveform).toEqual(waveform);

    setMainWaveform(null);
    expect(useAudioStore.getState().mainWaveform).toBeNull();
  });

  it('should add and remove BGM', () => {
    const { addBgm, removeBgm } = useAudioStore.getState();
    const bgm = {
      id: 'bgm_1',
      filePath: '/tmp/bgm.mp3',
      name: 'bgm.mp3',
      duration: 60,
      volume: 100,
      startOffset: 0,
      trimStart: 0,
      trimEnd: -1,
      fadeIn: 0,
      fadeOut: 0,
      isMuted: false,
      waveform: null,
    };

    addBgm(bgm);
    expect(useAudioStore.getState().bgmItems).toHaveLength(1);
    expect(useAudioStore.getState().bgmItems[0].name).toBe('bgm.mp3');

    removeBgm('bgm_1');
    expect(useAudioStore.getState().bgmItems).toHaveLength(0);
  });

  it('should update BGM properties', () => {
    const { addBgm, updateBgm } = useAudioStore.getState();
    const bgm = {
      id: 'bgm_1',
      filePath: '/tmp/bgm.mp3',
      name: 'bgm.mp3',
      duration: 60,
      volume: 100,
      startOffset: 0,
      trimStart: 0,
      trimEnd: -1,
      fadeIn: 0,
      fadeOut: 0,
      isMuted: false,
      waveform: null,
    };

    addBgm(bgm);
    updateBgm('bgm_1', { volume: 50, startOffset: 5, fadeIn: 2 });

    const updated = useAudioStore.getState().bgmItems[0];
    expect(updated.volume).toBe(50);
    expect(updated.startOffset).toBe(5);
    expect(updated.fadeIn).toBe(2);
  });

  it('should select/deselect BGM and clear on remove', () => {
    const { addBgm, selectBgm, removeBgm } = useAudioStore.getState();
    const bgm = {
      id: 'bgm_1', filePath: '/tmp/bgm.mp3', name: 'bgm.mp3', duration: 60,
      volume: 100, startOffset: 0, trimStart: 0, trimEnd: -1,
      fadeIn: 0, fadeOut: 0, isMuted: false, waveform: null,
    };

    addBgm(bgm);
    selectBgm('bgm_1');
    expect(useAudioStore.getState().selectedBgmId).toBe('bgm_1');

    removeBgm('bgm_1');
    expect(useAudioStore.getState().selectedBgmId).toBeNull();
  });

  it('should set BGM waveform', () => {
    const { addBgm, setBgmWaveform } = useAudioStore.getState();
    const bgm = {
      id: 'bgm_1', filePath: '/tmp/bgm.mp3', name: 'bgm.mp3', duration: 60,
      volume: 100, startOffset: 0, trimStart: 0, trimEnd: -1,
      fadeIn: 0, fadeOut: 0, isMuted: false, waveform: null,
    };

    addBgm(bgm);
    const waveform = { peaks: [0.1, 0.5], sampleRate: 8000, duration: 60 };
    setBgmWaveform('bgm_1', waveform);

    expect(useAudioStore.getState().bgmItems[0].waveform).toEqual(waveform);
  });

  it('should set and toggle clip volume', () => {
    const { setClipVolume, toggleClipMute } = useAudioStore.getState();

    setClipVolume('clip_1', 50);
    expect(useAudioStore.getState().clipVolumes).toHaveLength(1);
    expect(useAudioStore.getState().clipVolumes[0].volume).toBe(50);
    expect(useAudioStore.getState().clipVolumes[0].isMuted).toBe(false);

    toggleClipMute('clip_1');
    expect(useAudioStore.getState().clipVolumes[0].isMuted).toBe(true);

    toggleClipMute('clip_1');
    expect(useAudioStore.getState().clipVolumes[0].isMuted).toBe(false);
  });

  it('should toggle clip mute for new clip', () => {
    const { toggleClipMute } = useAudioStore.getState();

    toggleClipMute('clip_new');
    expect(useAudioStore.getState().clipVolumes).toHaveLength(1);
    expect(useAudioStore.getState().clipVolumes[0].clipId).toBe('clip_new');
    expect(useAudioStore.getState().clipVolumes[0].isMuted).toBe(true);
    expect(useAudioStore.getState().clipVolumes[0].volume).toBe(100);
  });

  it('should update existing clip volume', () => {
    const { setClipVolume } = useAudioStore.getState();

    setClipVolume('clip_1', 80);
    setClipVolume('clip_1', 120);
    expect(useAudioStore.getState().clipVolumes).toHaveLength(1);
    expect(useAudioStore.getState().clipVolumes[0].volume).toBe(120);
  });

  it('should remove clip volume', () => {
    const { setClipVolume, removeClipVolume } = useAudioStore.getState();

    setClipVolume('clip_1', 80);
    expect(useAudioStore.getState().clipVolumes).toHaveLength(1);

    removeClipVolume('clip_1');
    expect(useAudioStore.getState().clipVolumes).toHaveLength(0);
  });

  it('should clamp clip volume to 0-200', () => {
    const { setClipVolume } = useAudioStore.getState();

    setClipVolume('clip_1', -50);
    expect(useAudioStore.getState().clipVolumes[0].volume).toBe(0);

    setClipVolume('clip_1', 999);
    expect(useAudioStore.getState().clipVolumes[0].volume).toBe(200);
  });

  it('should clear all state', () => {
    const { setMainVolume, setMainFade, addBgm, setClipVolume, clearAll } = useAudioStore.getState();

    setMainVolume(150);
    setMainFade({ fadeInDuration: 2 });
    addBgm({
      id: 'bgm_1', filePath: '/tmp/bgm.mp3', name: 'bgm.mp3', duration: 60,
      volume: 100, startOffset: 0, trimStart: 0, trimEnd: -1,
      fadeIn: 0, fadeOut: 0, isMuted: false, waveform: null,
    });
    setClipVolume('clip_1', 80);

    clearAll();

    const state = useAudioStore.getState();
    expect(state.mainVolume).toBe(100);
    expect(state.mainFade.fadeInDuration).toBe(0);
    expect(state.bgmItems).toHaveLength(0);
    expect(state.clipVolumes).toHaveLength(0);
  });
});
