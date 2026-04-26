import { useVideoStore } from '../../stores/videoStore';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useWatermarkImport } from '../../hooks/useWatermarkImport';
import { formatFileSize } from '../../utils/formatTime';
import { getAspectRatioLabel } from '../../utils/aspectRatio';
import { WatermarkCard } from './WatermarkCard';

export function WatermarkPanel() {
  const { videoInfo, videoPath } = useVideoStore();
  const { watermarks, selectedId, slotCount, addSlot, clearAll } = useWatermarkStore();
  const { importFromDialog } = useWatermarkImport();

  const emptySlotCount = Math.max(0, slotCount - watermarks.length);

  return (
    <div className="w-[320px] flex-shrink-0 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">浮水印</h2>
        {watermarks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-text-secondary hover:text-error transition-colors"
            title="清除全部浮水印"
          >
            清除全部 🗑
          </button>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Video info card — only shown when a video is loaded */}
          {videoInfo && (
            <div className="bg-bg-component/50 rounded-lg p-3 space-y-2">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                影片資訊
              </h3>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-text-secondary">解析度</span>
                <span className="text-text-primary font-mono">
                  {videoInfo.width} × {videoInfo.height}
                </span>
                <span className="text-text-secondary">比例</span>
                <span className="text-text-primary font-mono">
                  {getAspectRatioLabel(videoInfo.width, videoInfo.height)}
                </span>
                <span className="text-text-secondary">FPS</span>
                <span className="text-text-primary font-mono">
                  {videoInfo.fps.toFixed(2)}
                </span>
                <span className="text-text-secondary">編碼</span>
                <span className="text-text-primary font-mono">
                  {videoInfo.codec}
                </span>
                <span className="text-text-secondary">檔案大小</span>
                <span className="text-text-primary font-mono">
                  {formatFileSize(videoInfo.file_size)}
                </span>
              </div>
              {videoPath && (
                <p className="text-[10px] text-text-secondary/60 truncate mt-2" title={videoPath}>
                  {videoPath}
                </p>
              )}
            </div>
          )}

          {/* Import button */}
          <button
            onClick={importFromDialog}
            className="w-full py-2.5 border border-dashed border-border rounded-lg
                       text-text-secondary text-sm hover:border-accent hover:text-accent
                       transition-colors duration-150"
          >
            + 匯入浮水印
          </button>

          {/* Watermark cards */}
          <div className="space-y-3">
            {watermarks.map((wm, idx) => (
              <WatermarkCard
                key={wm.id}
                watermark={wm}
                index={idx}
                isSelected={selectedId === wm.id}
              />
            ))}

            {/* Empty slots */}
            {Array.from({ length: emptySlotCount }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border border-border/50 rounded-lg p-3 opacity-40 cursor-pointer
                           hover:opacity-60 hover:border-accent/30 transition-all"
                onClick={importFromDialog}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-bg-component rounded flex items-center justify-center text-xs text-text-secondary">
                    #{watermarks.length + i + 1}
                  </div>
                  <span className="text-xs text-text-secondary">點擊匯入浮水印</span>
                </div>
              </div>
            ))}
          </div>

          {/* Add more slots button */}
          <button
            onClick={addSlot}
            className="w-full py-2 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            + 新增浮水印欄位
          </button>
        </div>
      </div>
    </div>
  );
}
