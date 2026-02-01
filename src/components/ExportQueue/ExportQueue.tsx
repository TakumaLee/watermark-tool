import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVideoStore } from '../../stores/videoStore';
import { useExportStore } from '../../stores/exportStore';
import type { ExportTask, PlatformExportConfig, GifExportConfig } from '../../types';

export function ExportQueue() {
  const { videoPath } = useVideoStore();
  const {
    queue,
    isQueueProcessing,
    updateTaskStatus,
    updateTaskProgress,
    setTaskProcessId,
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    setQueueProcessing,
  } = useExportStore();

  const processingRef = useRef(false);
  const pollIntervalRef = useRef<number | null>(null);

  // Process the queue sequentially
  const processNextTask = useCallback(async () => {
    if (!videoPath || processingRef.current) return;

    const pendingTask = queue.find((t) => t.status === 'pending');
    if (!pendingTask) {
      setQueueProcessing(false);
      return;
    }

    processingRef.current = true;
    setQueueProcessing(true);
    updateTaskStatus(pendingTask.id, 'processing');

    try {
      let processId: string;

      if (pendingTask.format === 'gif' && pendingTask.gifSettings) {
        // GIF export
        processId = await invoke('export_gif', {
          input: videoPath,
          output: pendingTask.outputPath,
          config: {
            width: pendingTask.gifSettings.width,
            fps: pendingTask.gifSettings.fps,
            colors: pendingTask.gifSettings.colors,
            start_time: pendingTask.gifSettings.startTime,
            end_time: pendingTask.gifSettings.endTime,
          } satisfies GifExportConfig,
        });
      } else {
        // Platform video export
        processId = await invoke('export_platform_video', {
          input: videoPath,
          output: pendingTask.outputPath,
          config: {
            width: pendingTask.width,
            height: pendingTask.height,
            aspect_mode: pendingTask.aspectMode,
            quality: pendingTask.quality,
            format: pendingTask.format,
            max_duration: 0, // TODO: get from preset
          } satisfies PlatformExportConfig,
        });
      }

      setTaskProcessId(pendingTask.id, processId);

      // Poll progress
      const taskId = pendingTask.id;
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const progress: number = await invoke('get_render_progress', { processId });
          if (progress >= 1.0) {
            updateTaskStatus(taskId, 'complete');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            processingRef.current = false;
            // Process next task after a small delay
            setTimeout(() => {
              const { queue: currentQueue } = useExportStore.getState();
              if (currentQueue.some((t) => t.status === 'pending')) {
                processNextTask();
              } else {
                setQueueProcessing(false);
              }
            }, 300);
          } else if (progress >= 0) {
            updateTaskProgress(taskId, progress);
          }
        } catch {
          // Ignore transient errors
        }
      }, 500);
    } catch (err) {
      updateTaskStatus(pendingTask.id, 'failed', String(err));
      processingRef.current = false;
      // Try next task
      setTimeout(() => processNextTask(), 300);
    }
  }, [videoPath, queue, updateTaskStatus, updateTaskProgress, setTaskProcessId, setQueueProcessing]);

  // Auto-start processing when tasks are added
  useEffect(() => {
    if (queue.some((t) => t.status === 'pending') && !processingRef.current) {
      processNextTask();
    }
  }, [queue.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (queue.length === 0) return null;

  const pendingCount = queue.filter((t) => t.status === 'pending').length;
  const processingCount = queue.filter((t) => t.status === 'processing').length;
  const completeCount = queue.filter((t) => t.status === 'complete').length;
  const failedCount = queue.filter((t) => t.status === 'failed').length;

  const statusIcon = (task: ExportTask) => {
    switch (task.status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'complete':
        return '✅';
      case 'failed':
        return '❌';
    }
  };

  const statusColor = (task: ExportTask) => {
    switch (task.status) {
      case 'pending':
        return 'text-text-secondary';
      case 'processing':
        return 'text-accent';
      case 'complete':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
    }
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-bg-secondary overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">📋 輸出佇列</h3>
        <div className="flex gap-1.5 text-[10px] text-text-secondary">
          {processingCount > 0 && <span className="text-accent">🔄{processingCount}</span>}
          {pendingCount > 0 && <span>⏳{pendingCount}</span>}
          {completeCount > 0 && <span className="text-green-400">✅{completeCount}</span>}
          {failedCount > 0 && <span className="text-red-400">❌{failedCount}</span>}
        </div>
      </div>

      {/* Task list */}
      <div className="p-2 space-y-1.5">
        {queue.map((task) => (
          <div
            key={task.id}
            className="p-2 bg-bg-component rounded-lg border border-border"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{task.platformIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">
                  {task.platformName}
                </div>
                <div className="text-[10px] text-text-secondary truncate">
                  {task.width}×{task.height || 'auto'} • {task.format.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-xs ${statusColor(task)}`}>
                  {statusIcon(task)}
                </span>
                {(task.status === 'pending' || task.status === 'failed') && (
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-[10px] text-text-secondary hover:text-red-400 transition-colors"
                    title="移除"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {task.status === 'processing' && (
              <div className="mt-1.5">
                <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-[width] duration-200 rounded-full"
                    style={{ width: `${Math.round(task.progress * 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-accent mt-0.5 text-right">
                  {Math.round(task.progress * 100)}%
                </div>
              </div>
            )}

            {/* Error message */}
            {task.status === 'failed' && task.errorMessage && (
              <div className="mt-1 text-[10px] text-red-400 truncate" title={task.errorMessage}>
                {task.errorMessage}
              </div>
            )}

            {/* Output path */}
            {task.status === 'complete' && (
              <div className="mt-1 text-[10px] text-green-400/70 truncate" title={task.outputPath}>
                {task.outputPath.split('/').pop()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="p-2 border-t border-border flex gap-2">
        {completeCount > 0 && (
          <button
            onClick={clearCompletedTasks}
            className="flex-1 px-2 py-1 text-[10px] text-text-secondary border border-border rounded
                       hover:text-text-primary hover:border-accent/50 transition-colors"
          >
            清除已完成
          </button>
        )}
        {queue.length > 0 && !isQueueProcessing && (
          <button
            onClick={clearAllTasks}
            className="flex-1 px-2 py-1 text-[10px] text-text-secondary border border-border rounded
                       hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            清除全部
          </button>
        )}
      </div>
    </div>
  );
}
