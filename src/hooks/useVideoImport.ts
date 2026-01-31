import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useVideoStore } from '../stores/videoStore';
import type { VideoInfo } from '../types';
import { SUPPORTED_VIDEO_EXTENSIONS } from '../types';

/**
 * Hook for importing videos via file dialog or drag-and-drop.
 * Handles file selection, FFmpeg probing, and store updates.
 */
export function useVideoImport() {
  const { setVideo, setLoading, setError } = useVideoStore();

  /**
   * Import a video from a file path (used by drag-and-drop).
   */
  const importFromPath = useCallback(
    async (filePath: string) => {
      setLoading(true);
      try {
        // Validate extension
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext as typeof SUPPORTED_VIDEO_EXTENSIONS[number])) {
          throw new Error(`不支援的影片格式: .${ext}`);
        }

        // Probe video info via Rust backend
        const info = await invoke<VideoInfo>('probe_video', { path: filePath });

        // Convert native file path to asset URL for <video> src
        const assetUrl = convertFileSrc(filePath);

        setVideo(filePath, assetUrl, info);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [setVideo, setLoading, setError],
  );

  /**
   * Open file dialog and import selected video.
   */
  const importFromDialog = useCallback(async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [
          {
            name: '影片檔案',
            extensions: [...SUPPORTED_VIDEO_EXTENSIONS],
          },
        ],
      });

      if (result) {
        await importFromPath(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [importFromPath, setError]);

  return { importFromPath, importFromDialog };
}
