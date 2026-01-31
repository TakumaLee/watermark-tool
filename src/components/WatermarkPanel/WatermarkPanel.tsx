import { useVideoStore } from '../../stores/videoStore';
import { formatFileSize } from '../../utils/formatTime';
import { getAspectRatioLabel } from '../../utils/aspectRatio';

export function WatermarkPanel() {
  const { videoInfo, videoPath } = useVideoStore();

  return (
    <div className="w-[320px] flex-shrink-0 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-text-primary">浮水印</h2>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4">
        {videoInfo ? (
          <div className="space-y-4">
            {/* Video info card */}
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

            {/* Watermark slots - placeholder for Phase 2 */}
            <div className="space-y-3">
              <button
                className="w-full py-2.5 border border-dashed border-border rounded-lg
                           text-text-secondary text-sm hover:border-accent hover:text-accent
                           transition-colors duration-150"
                disabled
                title="Phase 2 — 浮水印匯入"
              >
                + 匯入浮水印
              </button>

              {/* Empty watermark slots */}
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="border border-border/50 rounded-lg p-3 opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-bg-component rounded flex items-center justify-center text-xs text-text-secondary">
                      #{n}
                    </div>
                    <span className="text-xs text-text-secondary">空欄位</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary text-sm opacity-60">
            <p>請先匯入影片</p>
          </div>
        )}
      </div>
    </div>
  );
}
