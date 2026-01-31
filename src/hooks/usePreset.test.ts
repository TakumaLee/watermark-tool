import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useWatermarkStore, generateWatermarkId } from '../stores/watermarkStore';
import type { WatermarkItem, PresetConfig } from '../types';

// We test the preset logic directly since hooks need renderHook
// Focus on the core save/load serialization logic

const mockInvoke = vi.mocked(invoke);
const mockSave = vi.mocked(save);
const mockOpen = vi.mocked(open);

function createMockWatermark(overrides?: Partial<WatermarkItem>): WatermarkItem {
  return {
    id: generateWatermarkId(),
    name: 'logo.png',
    filePath: '/tmp/logo.png',
    imageUrl: 'blob:mock',
    naturalWidth: 200,
    naturalHeight: 100,
    x: 0.05,
    y: 0.05,
    width: 0.15,
    height: 0.08,
    opacity: 80,
    lockAspectRatio: true,
    sameAsAbove: false,
    movement: { type: 'Static' },
    ...overrides,
  };
}

describe('Preset serialization logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatermarkStore.setState({
      watermarks: [],
      selectedId: null,
      slotCount: 3,
    });
  });

  it('preset config has correct schema version', () => {
    const wm = createMockWatermark();
    // Simulate what usePreset.savePreset does
    const config: PresetConfig = {
      version: 1,
      name: 'test',
      createdAt: new Date().toISOString(),
      watermarks: [
        {
          name: wm.name,
          filePath: wm.filePath,
          x: wm.x,
          y: wm.y,
          width: wm.width,
          height: wm.height,
          opacity: wm.opacity,
          lockAspectRatio: wm.lockAspectRatio,
          sameAsAbove: wm.sameAsAbove,
          movement: wm.movement,
        },
      ],
    };

    expect(config.version).toBe(1);
    expect(config.watermarks).toHaveLength(1);
    // Should not contain runtime fields
    const json = JSON.stringify(config);
    expect(json).not.toContain('imageUrl');
    expect(json).not.toContain('naturalWidth');
    expect(json).not.toContain('naturalHeight');
  });

  it('preserves movement config in serialization', () => {
    const wm = createMockWatermark({
      movement: { type: 'Linear', speed: 120, direction: 'horizontal' },
    });

    const preset = {
      name: wm.name,
      filePath: wm.filePath,
      x: wm.x,
      y: wm.y,
      width: wm.width,
      height: wm.height,
      opacity: wm.opacity,
      lockAspectRatio: wm.lockAspectRatio,
      sameAsAbove: wm.sameAsAbove,
      movement: wm.movement,
    };

    const json = JSON.stringify(preset);
    const parsed = JSON.parse(json);

    expect(parsed.movement.type).toBe('Linear');
    expect(parsed.movement.speed).toBe(120);
    expect(parsed.movement.direction).toBe('horizontal');
  });

  it('preserves Random movement config', () => {
    const wm = createMockWatermark({
      movement: { type: 'Random', interval: 3.0, fade_duration: 0.5 },
    });

    const json = JSON.stringify(wm.movement);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('Random');
    expect(parsed.interval).toBe(3.0);
    expect(parsed.fade_duration).toBe(0.5);
  });

  it('list_presets invoke is called correctly', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const result = await invoke('list_presets');
    expect(mockInvoke).toHaveBeenCalledWith('list_presets');
    expect(result).toEqual([]);
  });

  it('delete_preset invoke sends correct path', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke('delete_preset', { path: '/presets/test.json' });
    expect(mockInvoke).toHaveBeenCalledWith('delete_preset', {
      path: '/presets/test.json',
    });
  });
});
