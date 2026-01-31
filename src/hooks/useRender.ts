import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../stores/videoStore';
import { useWatermarkStore } from '../stores/watermarkStore';
import { useRenderStore } from '../stores/renderStore';
import type { OutputQuality } from '../types';

/** Watermark config matching the Rust WatermarkConfig struct */
interface RustWatermarkConfig {
  image_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  movement: RustMovementMode;
}

type RustMovementMode =
  | { type: 'Static' }
  | { type: 'Linear'; speed: number; direction: string }
  | { type: 'Random'; interval: number; fade_duration: number };

/**
 * Hook for rendering video with watermarks.
 */
export function useRender() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { startRender, updateProgress, completeRender, failRender } = useRenderStore();

  /**
   * Open save dialog and get output path
   */
  const selectOutputPath = useCallback(async (format: string): Promise<string | null> => {
    const result = await save({
      title: '選擇輸出路徑',
      filters: [
        {
          name: '影片檔案',
          extensions: [format],
        },
      ],
      defaultPath: `output_watermarked.${format}`,
    });
    return result ?? null;
  }, []);

  /**
   * Start rendering with specified settings
   */
  const startRenderProcess = useCallback(
    async (outputPath: string, quality: OutputQuality) => {
      const videoPath = useVideoStore.getState().videoPath;
      const watermarks = useWatermarkStore.getState().watermarks;

      if (!videoPath) {
        failRender('未匯入影片');
        return;
      }

      if (watermarks.length === 0) {
        failRender('未新增浮水印');
        return;
      }

      // Convert frontend watermark items to Rust WatermarkConfig
      const wmConfigs: RustWatermarkConfig[] = watermarks.map((wm) => ({
        image_path: wm.filePath,
        x: wm.x,
        y: wm.y,
        width: wm.width,
        height: wm.height,
        opacity: wm.opacity / 100, // Convert 0-100 to 0-1
        movement: wm.movement as RustMovementMode,
      }));

      try {
        // Start the render
        const processId = await invoke<string>('render_video', {
          input: videoPath,
          output: outputPath,
          watermarks: wmConfigs,
          quality,
        });

        startRender(processId);

        // Poll for progress
        pollRef.current = setInterval(async () => {
          try {
            const progress = await invoke<number>('get_render_progress', {
              processId,
            });

            if (progress >= 1.0) {
              // Complete
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              completeRender(outputPath);
            } else if (progress < 0) {
              // Process not found (error or already cleaned up)
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              failRender('渲染程序異常終止');
            } else {
              updateProgress(progress);
            }
          } catch (err) {
            // Keep polling even if a single poll fails
            console.warn('Progress poll error:', err);
          }
        }, 500);
      } catch (err) {
        failRender(String(err));
      }
    },
    [startRender, updateProgress, completeRender, failRender],
  );

  /**
   * Cancel the current render (cleanup polling)
   */
  const cancelRender = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    useRenderStore.getState().resetRender();
  }, []);

  return { selectOutputPath, startRenderProcess, cancelRender };
}
