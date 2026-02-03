import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import { useTimelineStore } from '../stores/timelineStore';
import { useVideoStore } from '../stores/videoStore';

interface TrimProgressEvent {
  process_id: string;
  progress: number;
  status: 'processing' | 'complete' | 'error';
  error_message: string | null;
}

export function useTimeline() {
  const { clips } = useTimelineStore();
  useVideoStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<TrimProgressEvent>('timeline-progress', (event) => {
      const { progress: p, status, error_message } = event.payload;
      setProgress(p);
      if (status === 'complete') {
        setIsProcessing(false);
        setProgress(1);
      } else if (status === 'error') {
        setIsProcessing(false);
        setError(error_message ?? 'Unknown error');
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Export/concat all clips
  const exportTimeline = useCallback(async () => {
    if (clips.length === 0) return;

    try {
      const outputPath = await save({
        title: '輸出影片',
        filters: [{ name: 'MP4', extensions: ['mp4'] }],
      });

      if (!outputPath) return;

      setIsProcessing(true);
      setProgress(0);
      setError(null);

      // Get temp dir
      const dataDir = await appDataDir();
      const tempDir = await join(dataDir, 'temp_timeline');

      // Build segments
      const segments = clips.map((clip) => ({
        source_path: clip.sourcePath,
        start_time: clip.startTime,
        end_time: clip.endTime,
      }));

      await invoke('concat_video_clips', {
        segments,
        output: outputPath,
        quality: 'high',
        tempDir: tempDir,
      });
    } catch (err) {
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [clips]);

  // Trim a single clip (quick export of selected clip)
  const trimAndExport = useCallback(async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    try {
      const outputPath = await save({
        title: '輸出裁切片段',
        filters: [{ name: 'MP4', extensions: ['mp4'] }],
      });

      if (!outputPath) return;

      setIsProcessing(true);
      setProgress(0);
      setError(null);

      await invoke('trim_video_clip', {
        input: clip.sourcePath,
        output: outputPath,
        start: clip.startTime,
        end: clip.endTime,
        quality: 'high',
      });
    } catch (err) {
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [clips]);

  return {
    exportTimeline,
    trimAndExport,
    isProcessing,
    progress,
    error,
    clearError: () => setError(null),
  };
}
