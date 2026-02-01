import { describe, it, expect, beforeEach } from 'vitest';
import { useEffectsStore, generatePipId } from './effectsStore';
import { DEFAULT_FILTER_ADJUSTMENTS, DEFAULT_TRANSFORM } from '../types';

describe('effectsStore', () => {
  beforeEach(() => {
    useEffectsStore.getState().clearAll();
  });

  // === Transitions ===
  describe('transitions', () => {
    it('should set and get a transition', () => {
      const store = useEffectsStore.getState();
      store.setTransition('a', 'b', { type: 'fade', duration: 1 });
      expect(store.getTransition('a', 'b')).toEqual({ type: 'fade', duration: 1 });
    });

    it('should return null for non-existent transition', () => {
      expect(useEffectsStore.getState().getTransition('x', 'y')).toBeNull();
    });

    it('should remove a transition when set to null', () => {
      const store = useEffectsStore.getState();
      store.setTransition('a', 'b', { type: 'fade', duration: 1 });
      store.setTransition('a', 'b', null);
      expect(useEffectsStore.getState().getTransition('a', 'b')).toBeNull();
    });

    it('should clear all transitions', () => {
      const store = useEffectsStore.getState();
      store.setTransition('a', 'b', { type: 'fade', duration: 1 });
      store.setTransition('c', 'd', { type: 'dissolve', duration: 0.5 });
      store.clearTransitions();
      expect(useEffectsStore.getState().transitions.size).toBe(0);
    });
  });

  // === Filters ===
  describe('filters', () => {
    it('should start with default filter values', () => {
      const { filters } = useEffectsStore.getState();
      expect(filters).toEqual(DEFAULT_FILTER_ADJUSTMENTS);
    });

    it('should set brightness', () => {
      useEffectsStore.getState().setBrightness(0.5);
      expect(useEffectsStore.getState().filters.brightness).toBe(0.5);
      expect(useEffectsStore.getState().activePresetId).toBeNull();
    });

    it('should set contrast', () => {
      useEffectsStore.getState().setContrast(1.5);
      expect(useEffectsStore.getState().filters.contrast).toBe(1.5);
    });

    it('should set saturation', () => {
      useEffectsStore.getState().setSaturation(0.3);
      expect(useEffectsStore.getState().filters.saturation).toBe(0.3);
    });

    it('should set active preset', () => {
      useEffectsStore.getState().setActivePreset('warm');
      expect(useEffectsStore.getState().activePresetId).toBe('warm');
    });

    it('should reset filters to default', () => {
      useEffectsStore.getState().setBrightness(0.5);
      useEffectsStore.getState().setContrast(2.0);
      useEffectsStore.getState().resetFilters();
      expect(useEffectsStore.getState().filters).toEqual(DEFAULT_FILTER_ADJUSTMENTS);
      expect(useEffectsStore.getState().activePresetId).toBe('none');
    });
  });

  // === Speed ===
  describe('speed', () => {
    it('should default to 1x speed', () => {
      expect(useEffectsStore.getState().speed).toBe(1);
    });

    it('should set speed', () => {
      useEffectsStore.getState().setSpeed(2);
      expect(useEffectsStore.getState().speed).toBe(2);
    });

    it('should set reverse', () => {
      useEffectsStore.getState().setReverse(true);
      expect(useEffectsStore.getState().reverse).toBe(true);
    });
  });

  // === PiP ===
  describe('pip', () => {
    const mockPip = {
      id: 'pip_test_1',
      sourcePath: '/tmp/pip.mp4',
      sourceUrl: 'asset://localhost/tmp/pip.mp4',
      name: 'pip.mp4',
      x: 0.7,
      y: 0.7,
      width: 0.25,
      height: 0.25,
      startTime: 0,
      endTime: -1,
      aspectRatio: 16 / 9,
    };

    it('should add a PiP layer', () => {
      useEffectsStore.getState().addPip(mockPip);
      expect(useEffectsStore.getState().pipLayers).toHaveLength(1);
      expect(useEffectsStore.getState().pipLayers[0].id).toBe('pip_test_1');
    });

    it('should update a PiP layer', () => {
      useEffectsStore.getState().addPip(mockPip);
      useEffectsStore.getState().updatePip('pip_test_1', { x: 0.5, y: 0.5 });
      expect(useEffectsStore.getState().pipLayers[0].x).toBe(0.5);
    });

    it('should remove a PiP layer', () => {
      useEffectsStore.getState().addPip(mockPip);
      useEffectsStore.getState().removePip('pip_test_1');
      expect(useEffectsStore.getState().pipLayers).toHaveLength(0);
    });

    it('should deselect PiP when removed', () => {
      useEffectsStore.getState().addPip(mockPip);
      useEffectsStore.getState().selectPip('pip_test_1');
      useEffectsStore.getState().removePip('pip_test_1');
      expect(useEffectsStore.getState().selectedPipId).toBeNull();
    });

    it('should generate unique PiP IDs', () => {
      const id1 = generatePipId();
      const id2 = generatePipId();
      expect(id1).not.toBe(id2);
    });
  });

  // === Transform ===
  describe('transform', () => {
    it('should start with default transform', () => {
      expect(useEffectsStore.getState().transform).toEqual(DEFAULT_TRANSFORM);
    });

    it('should set rotation', () => {
      useEffectsStore.getState().setRotation(90);
      expect(useEffectsStore.getState().transform.rotation).toBe(90);
    });

    it('should set flip', () => {
      useEffectsStore.getState().setFlip('horizontal');
      expect(useEffectsStore.getState().transform.flip).toBe('horizontal');
    });

    it('should set crop', () => {
      useEffectsStore.getState().setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      expect(useEffectsStore.getState().transform.crop).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    });

    it('should clear crop', () => {
      useEffectsStore.getState().setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      useEffectsStore.getState().setCrop(null);
      expect(useEffectsStore.getState().transform.crop).toBeNull();
    });

    it('should reset transform', () => {
      useEffectsStore.getState().setRotation(180);
      useEffectsStore.getState().setFlip('both');
      useEffectsStore.getState().resetTransform();
      expect(useEffectsStore.getState().transform).toEqual(DEFAULT_TRANSFORM);
    });
  });

  // === General ===
  describe('clearAll', () => {
    it('should reset all state', () => {
      const store = useEffectsStore.getState();
      store.setSpeed(2);
      store.setReverse(true);
      store.setBrightness(0.5);
      store.setRotation(90);
      store.setTransition('a', 'b', { type: 'fade', duration: 1 });
      store.clearAll();

      const state = useEffectsStore.getState();
      expect(state.speed).toBe(1);
      expect(state.reverse).toBe(false);
      expect(state.filters).toEqual(DEFAULT_FILTER_ADJUSTMENTS);
      expect(state.transform).toEqual(DEFAULT_TRANSFORM);
      expect(state.transitions.size).toBe(0);
      expect(state.pipLayers).toHaveLength(0);
    });
  });
});
