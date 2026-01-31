import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useWatermarkStore, generateWatermarkId } from '../stores/watermarkStore';
import { useVideoStore } from '../stores/videoStore';
import { SUPPORTED_WATERMARK_EXTENSIONS, DEFAULT_WATERMARK_SIZE } from '../types';

/**
 * Hook for importing watermark images.
 * Loads the image to get natural dimensions, then creates a watermark item.
 */
export function useWatermarkImport() {
  const { addWatermark } = useWatermarkStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);

  /**
   * Load image and get natural dimensions
   */
  const loadImage = useCallback((url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('無法載入圖片'));
      img.src = url;
    });
  }, []);

  /**
   * Import watermark from a file path
   */
  const importWatermarkFromPath = useCallback(
    async (filePath: string) => {
      // Validate extension
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_WATERMARK_EXTENSIONS.includes(ext as typeof SUPPORTED_WATERMARK_EXTENSIONS[number])) {
        throw new Error(`不支援的圖片格式: .${ext}`);
      }

      const imageUrl = convertFileSrc(filePath);
      const { width: naturalWidth, height: naturalHeight } = await loadImage(imageUrl);

      // Calculate default size: watermark width = DEFAULT_WATERMARK_SIZE of video width
      const aspectRatio = naturalHeight / naturalWidth;
      let wmWidth = DEFAULT_WATERMARK_SIZE;
      let wmHeight: number;

      if (videoInfo) {
        // Convert to ratio coordinates considering video aspect ratio
        const videoAspect = videoInfo.width / videoInfo.height;
        wmHeight = wmWidth * aspectRatio * videoAspect;
      } else {
        wmHeight = wmWidth * aspectRatio;
      }

      // Center position
      const x = 0.5 - wmWidth / 2;
      const y = 0.5 - wmHeight / 2;

      const name = filePath.split('/').pop()?.split('\\').pop() ?? 'watermark';

      const wm = {
        id: generateWatermarkId(),
        name,
        filePath,
        imageUrl,
        naturalWidth,
        naturalHeight,
        x,
        y,
        width: wmWidth,
        height: wmHeight,
        opacity: 100,
        lockAspectRatio: true,
        sameAsAbove: false,
      };

      addWatermark(wm);
    },
    [addWatermark, videoInfo, loadImage],
  );

  /**
   * Open file dialog to import watermark image
   */
  const importFromDialog = useCallback(async () => {
    const result = await open({
      multiple: false,
      filters: [
        {
          name: '圖片檔案',
          extensions: [...SUPPORTED_WATERMARK_EXTENSIONS],
        },
      ],
    });

    if (result) {
      await importWatermarkFromPath(result);
    }
  }, [importWatermarkFromPath]);

  return { importWatermarkFromPath, importFromDialog };
}
