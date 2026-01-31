import { useVideoImport } from '../../hooks/useVideoImport';
import { useVideoStore } from '../../stores/videoStore';

export function BottomToolbar() {
  const { importFromDialog } = useVideoImport();
  const { videoUrl } = useVideoStore();
  const hasVideo = !!videoUrl;

  return (
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

        <button
          className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                     hover:border-accent hover:text-accent transition-colors duration-150
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
          disabled={!hasVideo}
          title="Phase 4 — 儲存設定"
        >
          💾 儲存設定
        </button>

        <button
          className="px-4 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                     hover:border-accent hover:text-accent transition-colors duration-150
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
          disabled={!hasVideo}
          title="Phase 4 — 批次處理"
        >
          📋 批次處理
        </button>
      </div>

      {/* Right primary action */}
      <button
        className="px-6 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                   transition-colors duration-150
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
        disabled={!hasVideo}
        title="Phase 3 — 開始輸出"
      >
        ▶ 開始輸出
      </button>
    </div>
  );
}
