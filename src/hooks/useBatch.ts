import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { useWatermarkStore } from '../stores/watermarkStore';
import { useBatchStore } from '../stores/batchStore';
import type {
  BatchFileItem,
  BatchFileStatus,
  BatchNamingMode,
  BatchProgressEvent,
  OutputQuality,
} from '../types';
import { SUPPORTED_VIDEO_EXTENSIONS } from '../types';

/** Build output filename based on naming mode */
function buildOutputName(
  originalName: string,
  mode: BatchNamingMode,
  prefix: string,
  suffix: string,
): string {
  const lastDot = originalName.lastIndexOf('.');
  const baseName = lastDot > 0 ? originalName.substring(0, lastDot) : originalName;
  const ext = lastDot > 0 ? originalName.substring(lastDot) : '.mp4';

  switch (mode) {
    case 'auto':
      return `${baseName}_watermarked${ext}`;
    case 'prefix':
      return `${prefix}${baseName}${ext}`;
    case 'suffix':
      return `${baseName}${suffix}${ext}`;
  }
}

/** Build full output path */
function buildOutputPath(
  inputPath: string,
  outputName: string,
  outputMode: 'same' | 'custom',
  customDir: string,
): string {
  const lastSep = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'));
  const inputDir = lastSep > 0 ? inputPath.substring(0, lastSep) : '.';
  const dir = outputMode === 'same' ? inputDir : customDir;
  return `${dir}/${outputName}`;
}

/**
 * Hook for batch processing videos with watermarks.
 */
export function useBatch() {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const {
    startBatch,
    updateFileProgress,
    completeFile,
    failFile,
    setCurrentIndex,
    completeBatch,
    resetBatch,
  } = useBatchStore();

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  /**
   * Open file dialog to select multiple video files
   */
  const selectVideoFiles = useCallback(async (): Promise<BatchFileItem[]> => {
    const result = await open({
      title: '選取影片檔案',
      filters: [
        {
          name: '影片檔案',
          extensions: [...SUPPORTED_VIDEO_EXTENSIONS],
        },
      ],
      multiple: true,
    });

    if (!result) return [];

    const paths = Array.isArray(result) ? result : [result];

    return paths.map((path) => {
      const name = path.split('/').pop() || path.split('\\').pop() || path;
      const ext = name.split('.').pop()?.toLowerCase() || '';
      const supported = (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);

      return {
        path,
        name,
        size: 0, // Size not easily available without probing; UI shows file name
        selected: supported,
        supported,
      };
    });
  }, []);

  /**
   * Open folder dialog to select a folder with videos
   */
  const selectVideoFolder = useCallback(async (): Promise<BatchFileItem[]> => {
    const result = await open({
      title: '選取影片資料夾',
      directory: true,
      multiple: false,
    });

    if (!result) return [];

    // We can't easily list folder contents from frontend with Tauri dialog.
    // Instead, use the file selection approach. The folder selection returns a path.
    // For simplicity, we'll recommend using file selection.
    // But we can invoke a command to list files.
    // For now, return empty and guide user to use file selection.
    console.warn('Folder selection not fully supported; use file selection instead');
    return [];
  }, []);

  /**
   * Start batch processing
   */
  const startBatchProcess = useCallback(
    async (
      files: BatchFileItem[],
      namingMode: BatchNamingMode,
      prefix: string,
      suffix: string,
      outputMode: 'same' | 'custom',
      customDir: string,
      quality: OutputQuality,
    ) => {
      const watermarks = useWatermarkStore.getState().watermarks;

      if (watermarks.length === 0) {
        throw new Error('未新增浮水印');
      }

      const selectedFiles = files.filter((f) => f.selected && f.supported);
      if (selectedFiles.length === 0) {
        throw new Error('未選取任何影片檔案');
      }

      // Build batch items
      const batchItems = selectedFiles.map((f) => {
        const outputName = buildOutputName(f.name, namingMode, prefix, suffix);
        const outputPath = buildOutputPath(f.path, outputName, outputMode, customDir);
        return {
          input_path: f.path,
          output_path: outputPath,
        };
      });

      // Build file status list for UI
      const fileStatuses: BatchFileStatus[] = selectedFiles.map((f, i) => {
        const outputName = buildOutputName(f.name, namingMode, prefix, suffix);
        return {
          path: f.path,
          name: f.name,
          outputName,
          status: 'pending' as const,
          progress: 0,
        };
      });

      // Convert watermarks to Rust format
      const wmConfigs = watermarks.map((wm) => ({
        image_path: wm.filePath,
        x: wm.x,
        y: wm.y,
        width: wm.width,
        height: wm.height,
        opacity: wm.opacity / 100,
        movement: wm.movement,
      }));

      // Listen for batch progress events
      if (unlistenRef.current) {
        unlistenRef.current();
      }

      unlistenRef.current = await listen<BatchProgressEvent>(
        'batch-progress',
        (event) => {
          const data = event.payload;

          if (data.batch_complete) {
            completeBatch();
            sendBatchNotification(fileStatuses.length);
            return;
          }

          setCurrentIndex(data.current_index);

          switch (data.file_status) {
            case 'processing':
              updateFileProgress(data.current_index, data.file_progress);
              break;
            case 'complete':
              completeFile(data.current_index);
              break;
            case 'error':
              failFile(data.current_index, data.error_message || '未知錯誤');
              break;
          }
        },
      );

      // Start batch processing
      const batchId = await invoke<string>('batch_render_video', {
        items: batchItems,
        watermarks: wmConfigs,
        quality,
      });

      startBatch(batchId, fileStatuses);

      return batchId;
    },
    [startBatch, updateFileProgress, completeFile, failFile, setCurrentIndex, completeBatch],
  );

  /**
   * Cancel the current batch
   */
  const cancelBatch = useCallback(async () => {
    const state = useBatchStore.getState().batchState;
    if (state.status === 'processing') {
      await invoke('cancel_render', { processId: state.batchId });
    }
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    resetBatch();
  }, [resetBatch]);

  return {
    selectVideoFiles,
    selectVideoFolder,
    startBatchProcess,
    cancelBatch,
  };
}

/**
 * Send system notification when batch is complete
 */
async function sendBatchNotification(totalFiles: number) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }

    if (granted) {
      sendNotification({
        title: '批次處理完成',
        body: `已成功處理 ${totalFiles} 個影片檔案的浮水印。`,
      });
    }
  } catch (err) {
    console.warn('Failed to send notification:', err);
  }
}
