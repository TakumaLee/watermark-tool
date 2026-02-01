import { useState } from 'react';
import { useVideoImport } from '../../hooks/useVideoImport';
import { useVideoStore } from '../../stores/videoStore';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useRenderStore } from '../../stores/renderStore';
import { useBatchStore } from '../../stores/batchStore';
import { useModuleStore } from '../../stores/moduleStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useTextStore } from '../../stores/textStore';
import { useAudioStore } from '../../stores/audioStore';
import { useEffectsStore } from '../../stores/effectsStore';
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
  const isTextEnabled = useModuleStore((s) => s.isEnabled('text'));
  const isTrimEnabled = useModuleStore((s) => s.isEnabled('trim'));
  const isAudioEnabled = useModuleStore((s) => s.isEnabled('audio'));
  const isFiltersEnabled = useModuleStore((s) => s.isEnabled('filters'));
  const audioHasChanges = useAudioStore((s) =>
    s.mainVolume !== 100 || s.mainMuted || s.bgmItems.length > 0 ||
    s.mainFade.fadeInDuration > 0 || s.mainFade.fadeOutDuration > 0
  );
  const effectsHasChanges = useEffectsStore((s) =>
    s.filters.brightness !== 0 || s.filters.contrast !== 1.0 || s.filters.saturation !== 1.0 ||
    s.speed !== 1 || s.reverse || s.pipLayers.length > 0 ||
    s.transform.rotation !== 0 || s.transform.flip !== 'none' || s.transform.crop !== null
  );
  const clips = useTimelineStore((s) => s.clips);
  const { exportTimeline, isProcessing: isTimelineProcessing, progress: timelineProgress } = useTimeline();
  const { exportWithEffects, isProcessing: isEffectsProcessing, progress: effectsProgress } = useEffectsRender();

  const [showOutputDialog, setShowOutputDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showBatchProgress, setShowBatchProgress] = useState(false);

  const hasVideo = !!videoUrl;
  const hasWatermarks = watermarks.length > 0;
  const canOutput = hasVideo && hasWatermarks && renderState.status !== 'rendering';
  const canExportTimeline = hasVideo && clips.length > 0 && !isTimelineProcessing;
  const isBatchProcessing = batchState.status === 'processing';

  return (
    <>
      {/* Render progress bar (shows above toolbar when rendering) */}
      <RenderProgress />

      {/* Effects export progress */}
      {isEffectsProcessing && (
        <div className="h-1 flex-shrink-0 bg-bg-primary">
          <div
            className="h-full bg-green-500 transition-[width] duration-150"
            style={{ width: `${effectsProgress * 100}%` }}
          />
        </div>
      )}

      {/* Timeline export progress */}
      {isTimelineProcessing && (
        <div className="h-1 flex-shrink-0 bg-bg-primary">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${timelineProgress * 100}%` }}
          />
        </div>
      )}

      <div className="h-14 flex-shrink-0 border-t border-border bg-bg-secondary px-4 flex items-center justify-between">
        {/* Left action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={importFromDialog}
            className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-primary
                       hover:border-accent hover:text-accent transition-colors duration-150"
          >
            📂 匯入影片
          </button>

          {/* Watermark-specific buttons (only when watermark module is enabled) */}
          {isWatermarkEnabled && (
            <>
              <button
                onClick={() => setShowPresetDialog(true)}
                className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                           hover:border-accent hover:text-accent transition-colors duration-150
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
                disabled={!hasWatermarks}
                title="儲存或載入浮水印設定"
              >
                💾 儲存設定
              </button>

              <button
                onClick={() => setShowBatchDialog(true)}
                className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                           hover:border-accent hover:text-accent transition-colors duration-150
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
                disabled={!hasWatermarks || isBatchProcessing}
                title={!hasWatermarks ? '請先新增浮水印' : '批次處理多個影片'}
              >
                📋 批次處理
              </button>
            </>
          )}

          {/* Show batch progress indicator if running */}
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

        {/* Right primary actions */}
        <div className="flex items-center gap-2">
          {/* Effects export button (only when filters module is enabled) */}
          {isFiltersEnabled && (
            <button
              onClick={exportWithEffects}
              className="px-5 py-1.5 border border-green-500/50 hover:bg-green-500/10 text-green-400 rounded-lg text-sm font-medium
                         transition-colors duration-150
                         disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!hasVideo || isEffectsProcessing}
              title={!hasVideo ? '請先匯入影片' : isEffectsProcessing ? '正在輸出...' : '輸出含效果影片'}
            >
              {isEffectsProcessing ? `⚡ 輸出中 ${Math.round(effectsProgress * 100)}%` : '⚡ 效果輸出'}
            </button>
          )}

          {/* Timeline export button (only when trim module is enabled) */}
          {isTrimEnabled && (
            <button
              onClick={exportTimeline}
              className="px-5 py-1.5 border border-accent/50 hover:bg-accent/10 text-accent rounded-lg text-sm font-medium
                         transition-colors duration-150
                         disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!canExportTimeline}
              title={!hasVideo ? '請先匯入影片' : clips.length === 0 ? '時間軸沒有片段' : '匯出時間軸'}
            >
              🎬 匯出剪輯
            </button>
          )}

          {/* Watermark output button (only when watermark module is enabled) */}
          {isWatermarkEnabled && (
            <button
              onClick={() => setShowOutputDialog(true)}
              className="px-6 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                         transition-colors duration-150
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
              disabled={!canOutput}
              title={!hasVideo ? '請先匯入影片' : !hasWatermarks ? '請先新增浮水印' : '開始輸出'}
            >
              ▶ 開始輸出
            </button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <OutputDialog
        isOpen={showOutputDialog}
        onClose={() => setShowOutputDialog(false)}
      />

      <PresetDialog
        isOpen={showPresetDialog}
        onClose={() => setShowPresetDialog(false)}
      />

      <BatchDialog
        isOpen={showBatchDialog}
        onClose={() => setShowBatchDialog(false)}
        onStarted={() => {
          setShowBatchDialog(false);
          setShowBatchProgress(true);
        }}
      />

      <BatchProgressDialog
        isOpen={showBatchProgress}
        onClose={() => setShowBatchProgress(false)}
      />
    </>
  );
}
