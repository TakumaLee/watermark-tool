import { useState } from 'react';
import { useVideoImport } from '../../hooks/useVideoImport';
import { useVideoStore } from '../../stores/videoStore';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useRenderStore } from '../../stores/renderStore';
import { useBatchStore } from '../../stores/batchStore';
import { useModuleStore } from '../../stores/moduleStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useTimeline } from '../../hooks/useTimeline';
import { useEffectsRender } from '../../hooks/useEffectsRender';
import { OutputDialog } from '../dialogs/OutputDialog';
import { RenderProgress } from '../dialogs/RenderProgress';
import { PresetDialog } from '../dialogs/PresetDialog';
import { BatchDialog } from '../dialogs/BatchDialog';
import { BatchProgressDialog } from '../dialogs/BatchProgressDialog';

export function BottomToolbar() {
  const { importFromDialog } = useVideoImport();
  const { videoUrl } = useVideoStore();
  const watermarks = useWatermarkStore((s) => s.watermarks);
  const renderState = useRenderStore((s) => s.renderState);
  const batchState = useBatchStore((s) => s.batchState);
  const isWatermarkEnabled = useModuleStore((s) => s.isEnabled('watermark'));
  const isTrimEnabled = useModuleStore((s) => s.isEnabled('trim'));
  const isFiltersEnabled = useModuleStore((s) => s.isEnabled('filters'));
  const clips = useTimelineStore((s) => s.clips);
  const { exportTimeline, isProcessing: isTimelineProcessing, progress: timelineProgress } = useTimeline();
  const { exportWithEffects, isProcessing: isEffectsProcessing, progress: effectsProgress } = useEffectsRender();

  const [showOutputDialog, setShowOutputDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showBatchProgress, setShowBatchProgress] = useState(false);

  const hasVideo = !!videoUrl;
  const hasWatermarks = watermarks.length > 0;
  const isBatchProcessing = batchState.status === 'processing';

  // ── Single export button: picks the highest-priority enabled module ──────
  // Priority: trim (剪輯) > watermark (浮水印) > filters (效果)
  const exportConfig = (() => {
    if (isTrimEnabled) {
      const processing = isTimelineProcessing;
      return {
        label: processing
          ? `🎬 匯出中 ${Math.round(timelineProgress * 100)}%`
          : '🎬 匯出剪輯',
        action: exportTimeline,
        disabled: !hasVideo || clips.length === 0 || processing,
        title: !hasVideo ? '請先匯入影片' : clips.length === 0 ? '時間軸沒有片段' : '匯出時間軸剪輯',
      };
    }
    if (isWatermarkEnabled) {
      const canOutput = hasVideo && hasWatermarks && renderState.status !== 'rendering';
      return {
        label: '▶ 開始輸出',
        action: () => setShowOutputDialog(true),
        disabled: !canOutput,
        title: !hasVideo ? '請先匯入影片' : !hasWatermarks ? '請先新增浮水印' : '輸出含浮水印的影片',
      };
    }
    if (isFiltersEnabled) {
      const processing = isEffectsProcessing;
      return {
        label: processing
          ? `⚡ 輸出中 ${Math.round(effectsProgress * 100)}%`
          : '⚡ 效果輸出',
        action: exportWithEffects,
        disabled: !hasVideo || processing,
        title: !hasVideo ? '請先匯入影片' : '輸出含效果影片',
      };
    }
    return null; // no export module enabled
  })();

  // Active progress bar (trim takes priority over effects if both running)
  const activeProgress = isTimelineProcessing
    ? { value: timelineProgress, color: 'bg-accent' }
    : isEffectsProcessing
    ? { value: effectsProgress, color: 'bg-green-500' }
    : null;

  return (
    <>
      <RenderProgress />

      {activeProgress && (
        <div className="h-1 flex-shrink-0 bg-bg-primary">
          <div
            className={`h-full ${activeProgress.color} transition-[width] duration-150`}
            style={{ width: `${activeProgress.value * 100}%` }}
          />
        </div>
      )}

      <div className="h-14 flex-shrink-0 border-t border-border bg-bg-secondary px-4 flex items-center justify-between">
        {/* Left: import + module-specific helpers */}
        <div className="flex items-center gap-3">
          <button
            onClick={importFromDialog}
            className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-primary
                       hover:border-accent hover:text-accent transition-colors duration-150"
          >
            📂 匯入影片
          </button>

          {isWatermarkEnabled && (
            <>
              <button
                onClick={() => setShowPresetDialog(true)}
                disabled={!hasWatermarks}
                className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                           hover:border-accent hover:text-accent transition-colors duration-150
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
                title={!hasWatermarks ? '請先新增浮水印' : '儲存或載入浮水印設定'}
              >
                💾 儲存設定
              </button>

              <button
                onClick={() => setShowBatchDialog(true)}
                disabled={!hasWatermarks || isBatchProcessing}
                className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                           hover:border-accent hover:text-accent transition-colors duration-150
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
                title={!hasWatermarks ? '請先新增浮水印' : '批次處理多個影片'}
              >
                📋 批次處理
              </button>
            </>
          )}

          {(batchState.status === 'processing' || batchState.status === 'complete') && (
            <button
              onClick={() => setShowBatchProgress(true)}
              className="px-3 py-1.5 border border-accent/30 rounded-lg text-xs text-accent
                         hover:bg-accent/10 transition-colors"
            >
              {batchState.status === 'processing' ? '📊 查看批次進度' : '✅ 批次完成'}
            </button>
          )}
        </div>

        {/* Right: single unified export button */}
        <div className="flex items-center">
          {exportConfig ? (
            <button
              onClick={exportConfig.action}
              disabled={exportConfig.disabled}
              title={exportConfig.title}
              className="px-6 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                         transition-colors duration-150
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
            >
              {exportConfig.label}
            </button>
          ) : (
            <button
              disabled
              title="請在設定中啟用至少一個輸出模組"
              className="px-6 py-1.5 bg-accent/30 text-white/50 rounded-lg text-sm font-medium cursor-not-allowed"
            >
              匯出
            </button>
          )}
        </div>
      </div>

      <OutputDialog isOpen={showOutputDialog} onClose={() => setShowOutputDialog(false)} />
      <PresetDialog isOpen={showPresetDialog} onClose={() => setShowPresetDialog(false)} />
      <BatchDialog
        isOpen={showBatchDialog}
        onClose={() => setShowBatchDialog(false)}
        onStarted={() => { setShowBatchDialog(false); setShowBatchProgress(true); }}
      />
      <BatchProgressDialog isOpen={showBatchProgress} onClose={() => setShowBatchProgress(false)} />
    </>
  );
}
