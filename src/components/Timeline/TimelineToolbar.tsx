import { useTimelineStore } from '../../stores/timelineStore';
import { useVideoImport } from '../../hooks/useVideoImport';
import { formatTime } from '../../utils/formatTime';

interface TimelineToolbarProps {
  showAddVideo: boolean;
}

export function TimelineToolbar({ showAddVideo }: TimelineToolbarProps) {
  const {
    clips,
    playheadTime,
    totalDuration,
    zoom,
    selectedClipId,
    splitAtPlayhead,
    deleteClip,
    zoomIn,
    zoomOut,
  } = useTimelineStore();

  const { appendToTimeline } = useVideoImport();

  return (
    <div className="h-8 border-b border-border/50 px-3 flex items-center justify-between">
      {/* Left: time display */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">時間軸</span>
        <span className="text-[10px] text-text-secondary/60 font-mono">
          {formatTime(playheadTime)} / {formatTime(totalDuration)}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        {/* Add video */}
        {showAddVideo && (
          <button
            onClick={appendToTimeline}
            className="px-2 py-0.5 text-[11px] text-text-secondary border border-border rounded
                       hover:text-accent hover:border-accent transition-colors"
            title="加入影片到時間軸"
          >
            + 加入影片
          </button>
        )}

        {/* Split */}
        <button
          onClick={splitAtPlayhead}
          disabled={clips.length === 0}
          className="px-2 py-0.5 text-[11px] text-text-secondary border border-border rounded
                     hover:text-accent hover:border-accent transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="在播放頭位置分割 (S)"
        >
          ✂️ 分割
        </button>

        {/* Delete */}
        <button
          onClick={() => selectedClipId && deleteClip(selectedClipId)}
          disabled={!selectedClipId}
          className="px-2 py-0.5 text-[11px] text-text-secondary border border-border rounded
                     hover:text-error hover:border-error transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="刪除選取的片段"
        >
          🗑 刪除
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={zoomOut}
            className="w-5 h-5 flex items-center justify-center text-text-secondary
                       hover:text-text-primary transition-colors text-[11px]"
            title="縮小"
          >
            −
          </button>
          <span className="text-[10px] text-text-secondary/60 w-8 text-center font-mono">
            {Math.round(zoom)}
          </span>
          <button
            onClick={zoomIn}
            className="w-5 h-5 flex items-center justify-center text-text-secondary
                       hover:text-text-primary transition-colors text-[11px]"
            title="放大"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
