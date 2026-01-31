import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useWatermarkStore } from '../stores/watermarkStore';
import { generateWatermarkId } from '../stores/watermarkStore';
import type { PresetConfig, PresetWatermarkConfig, PresetInfo, WatermarkItem } from '../types';
import { PRESET_SCHEMA_VERSION } from '../types';

/**
 * Convert a WatermarkItem to a PresetWatermarkConfig (strip runtime fields)
 */
function toPresetWatermark(wm: WatermarkItem): PresetWatermarkConfig {
  return {
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
}

/**
 * Convert a PresetWatermarkConfig back to a WatermarkItem (restore runtime fields)
 */
async function fromPresetWatermark(pw: PresetWatermarkConfig): Promise<WatermarkItem> {
  // Try to load image dimensions from the file
  let naturalWidth = 100;
  let naturalHeight = 100;

  // Create a convertFileSrc-compatible URL
  // For Tauri, we use asset protocol or read as data URL
  let imageUrl = '';

  try {
    const bytes = await invoke<number[]>('read_file_bytes', { path: pw.filePath });
    const uint8 = new Uint8Array(bytes);
    const blob = new Blob([uint8]);
    imageUrl = URL.createObjectURL(blob);

    // Load image to get natural dimensions
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        naturalWidth = img.naturalWidth;
        naturalHeight = img.naturalHeight;
        resolve();
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  } catch (err) {
    console.warn('Failed to load watermark image:', pw.filePath, err);
  }

  return {
    id: generateWatermarkId(),
    name: pw.name,
    filePath: pw.filePath,
    imageUrl,
    naturalWidth,
    naturalHeight,
    x: pw.x,
    y: pw.y,
    width: pw.width,
    height: pw.height,
    opacity: pw.opacity,
    lockAspectRatio: pw.lockAspectRatio,
    sameAsAbove: pw.sameAsAbove,
    movement: pw.movement,
  };
}

/**
 * Hook for saving and loading watermark presets.
 */
export function usePreset() {
  /**
   * Save current watermark settings to a JSON file
   */
  const savePreset = useCallback(async (presetName?: string): Promise<boolean> => {
    const watermarks = useWatermarkStore.getState().watermarks;

    if (watermarks.length === 0) {
      console.warn('No watermarks to save');
      return false;
    }

    const name = presetName || '未命名設定';
    const config: PresetConfig = {
      version: PRESET_SCHEMA_VERSION,
      name,
      createdAt: new Date().toISOString(),
      watermarks: watermarks.map(toPresetWatermark),
    };

    const json = JSON.stringify(config, null, 2);

    // Open save dialog
    const path = await save({
      title: '儲存浮水印設定',
      filters: [{ name: '浮水印設定檔', extensions: ['json'] }],
      defaultPath: `${name}.json`,
    });

    if (!path) return false;

    await invoke('save_preset', { path, data: json });
    return true;
  }, []);

  /**
   * Save to app data dir (quick save without dialog)
   */
  const quickSavePreset = useCallback(async (name: string): Promise<boolean> => {
    const watermarks = useWatermarkStore.getState().watermarks;

    if (watermarks.length === 0) return false;

    const config: PresetConfig = {
      version: PRESET_SCHEMA_VERSION,
      name,
      createdAt: new Date().toISOString(),
      watermarks: watermarks.map(toPresetWatermark),
    };

    const json = JSON.stringify(config, null, 2);
    const presetsDir = await invoke<string>('get_presets_dir');
    const path = `${presetsDir}/${name}.json`;

    await invoke('save_preset', { path, data: json });
    return true;
  }, []);

  /**
   * Load a preset from a JSON file (via open dialog)
   */
  const loadPresetFromDialog = useCallback(async (): Promise<boolean> => {
    const result = await open({
      title: '載入浮水印設定',
      filters: [{ name: '浮水印設定檔', extensions: ['json'] }],
      multiple: false,
    });

    if (!result) return false;

    const path = typeof result === 'string' ? result : result;
    return await loadPresetFromPath(path);
  }, []);

  /**
   * Load a preset from a specific path
   */
  const loadPresetFromPath = useCallback(async (path: string): Promise<boolean> => {
    const json = await invoke<string>('load_preset', { path });
    const config: PresetConfig = JSON.parse(json);

    // Validate version
    if (!config.version || config.version > PRESET_SCHEMA_VERSION) {
      throw new Error(`不支援的設定檔版本: ${config.version}`);
    }

    // Clear existing watermarks
    const store = useWatermarkStore.getState();
    store.clearAll();

    // Restore watermarks
    for (const pw of config.watermarks) {
      const wm = await fromPresetWatermark(pw);
      store.addWatermark(wm);
    }

    return true;
  }, []);

  /**
   * List saved presets from app data dir
   */
  const listPresets = useCallback(async (): Promise<PresetInfo[]> => {
    return await invoke<PresetInfo[]>('list_presets');
  }, []);

  /**
   * Delete a saved preset
   */
  const deletePreset = useCallback(async (path: string): Promise<void> => {
    await invoke('delete_preset', { path });
  }, []);

  return {
    savePreset,
    quickSavePreset,
    loadPresetFromDialog,
    loadPresetFromPath,
    listPresets,
    deletePreset,
  };
}
