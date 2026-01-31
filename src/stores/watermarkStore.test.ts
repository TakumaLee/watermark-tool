import { describe, it, expect, beforeEach } from 'vitest';
import { useWatermarkStore, generateWatermarkId } from './watermarkStore';
import type { WatermarkItem } from '../types';

function createMockWatermark(overrides?: Partial<WatermarkItem>): WatermarkItem {
  return {
    id: generateWatermarkId(),
    name: 'test-logo.png',
    filePath: '/tmp/test-logo.png',
    imageUrl: 'blob:mock-url',
    naturalWidth: 200,
    naturalHeight: 100,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.1,
    opacity: 80,
    lockAspectRatio: true,
    sameAsAbove: false,
    movement: { type: 'Static' },
    ...overrides,
  };
}

describe('watermarkStore', () => {
  beforeEach(() => {
    useWatermarkStore.setState({
      watermarks: [],
      selectedId: null,
      slotCount: 3,
    });
  });

  it('starts with empty state', () => {
    const state = useWatermarkStore.getState();
    expect(state.watermarks).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.slotCount).toBe(3);
  });

  it('adds a watermark and selects it', () => {
    const wm = createMockWatermark();
    useWatermarkStore.getState().addWatermark(wm);

    const state = useWatermarkStore.getState();
    expect(state.watermarks).toHaveLength(1);
    expect(state.watermarks[0].id).toBe(wm.id);
    expect(state.selectedId).toBe(wm.id);
  });

  it('removes a watermark', () => {
    const wm = createMockWatermark();
    useWatermarkStore.getState().addWatermark(wm);
    useWatermarkStore.getState().removeWatermark(wm.id);

    const state = useWatermarkStore.getState();
    expect(state.watermarks).toHaveLength(0);
    expect(state.selectedId).toBeNull();
  });

  it('updates watermark properties', () => {
    const wm = createMockWatermark();
    useWatermarkStore.getState().addWatermark(wm);
    useWatermarkStore.getState().updateWatermark(wm.id, { x: 0.5, y: 0.5 });

    const updated = useWatermarkStore.getState().watermarks[0];
    expect(updated.x).toBe(0.5);
    expect(updated.y).toBe(0.5);
    // Other props unchanged
    expect(updated.width).toBe(0.2);
  });

  it('updates movement mode', () => {
    const wm = createMockWatermark();
    useWatermarkStore.getState().addWatermark(wm);
    useWatermarkStore.getState().updateMovement(wm.id, {
      type: 'Linear',
      speed: 120,
      direction: 'horizontal',
    });

    const updated = useWatermarkStore.getState().watermarks[0];
    expect(updated.movement.type).toBe('Linear');
    if (updated.movement.type === 'Linear') {
      expect(updated.movement.speed).toBe(120);
      expect(updated.movement.direction).toBe('horizontal');
    }
  });

  it('selects and deselects watermarks', () => {
    const wm = createMockWatermark();
    useWatermarkStore.getState().addWatermark(wm);
    useWatermarkStore.getState().selectWatermark(null);

    expect(useWatermarkStore.getState().selectedId).toBeNull();

    useWatermarkStore.getState().selectWatermark(wm.id);
    expect(useWatermarkStore.getState().selectedId).toBe(wm.id);
  });

  it('applies same-as-above from previous watermark', () => {
    const wm1 = createMockWatermark({ opacity: 60, width: 0.3, height: 0.15 });
    const wm2 = createMockWatermark({ opacity: 100, width: 0.1, height: 0.05 });

    useWatermarkStore.getState().addWatermark(wm1);
    useWatermarkStore.getState().addWatermark(wm2);
    useWatermarkStore.getState().applySameAsAbove(wm2.id);

    const updated = useWatermarkStore.getState().watermarks[1];
    expect(updated.opacity).toBe(60);
    expect(updated.width).toBe(0.3);
    expect(updated.height).toBe(0.15);
    expect(updated.sameAsAbove).toBe(true);
  });

  it('same-as-above does nothing for first watermark', () => {
    const wm = createMockWatermark({ opacity: 50 });
    useWatermarkStore.getState().addWatermark(wm);
    useWatermarkStore.getState().applySameAsAbove(wm.id);

    // Should remain unchanged
    expect(useWatermarkStore.getState().watermarks[0].opacity).toBe(50);
  });

  it('adds slots', () => {
    useWatermarkStore.getState().addSlot();
    expect(useWatermarkStore.getState().slotCount).toBe(4);
  });

  it('clears all watermarks', () => {
    useWatermarkStore.getState().addWatermark(createMockWatermark());
    useWatermarkStore.getState().addWatermark(createMockWatermark());
    useWatermarkStore.getState().clearAll();

    const state = useWatermarkStore.getState();
    expect(state.watermarks).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.slotCount).toBe(3);
  });

  it('propagates size/opacity changes to sameAsAbove followers', () => {
    const wm1 = createMockWatermark({ opacity: 80, width: 0.2, height: 0.1 });
    const wm2 = createMockWatermark({ opacity: 80, width: 0.2, height: 0.1, sameAsAbove: true });

    useWatermarkStore.getState().addWatermark(wm1);
    useWatermarkStore.getState().addWatermark(wm2);

    // Update wm1's opacity — wm2 (sameAsAbove) should follow
    useWatermarkStore.getState().updateWatermark(wm1.id, { opacity: 40 });

    const state = useWatermarkStore.getState();
    expect(state.watermarks[0].opacity).toBe(40);
    expect(state.watermarks[1].opacity).toBe(40);
  });

  it('generateWatermarkId produces unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateWatermarkId());
    }
    expect(ids.size).toBe(100);
  });
});
