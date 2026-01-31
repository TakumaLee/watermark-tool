import { useRef, useCallback, useEffect, useState } from 'react';
import { useTimelineStore } from '../../stores/timelineStore';
import { useVideoStore } from '../../stores/videoStore';
import { formatTime } from '../../utils/formatTime';
import { TimelineClipItem } from './TimelineClipItem';
import { TimelineRuler } from './TimelineRuler';
import { TIMELINE_ZOOM } from '../../types';

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function Timeline({ videoRef }: TimelineProps) {
  const {
    clips,
    playheadTime,
    selectedClipId,
    zoom,
    scrollOffset,
    totalDuration,
    setPlayheadTime,
    selectClip,
    splitAtPlayhead,
    deleteClip,
    reorderClip,
    zoomIn,
    zoomOut,
    setScrollOffset,
  } = useTimelineStore();

  const { videoInfo } = useVideoStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const timelineWidth = totalDuration * zoom;
  const playheadX = playheadTime * zoom - scrollOffset;

  // Sync playhead → video currentTime
  useEffect(() => {
    if (!videoRef.current || isDraggingPlayhead) return;
    // Map timeline playhead to the correct clip's source time
    const clipInfo = getClipAtTime(clips, playheadTime);
    if (clipInfo) {
      const sourceTime = clipInfo.clip.startTime + clipInfo.offsetInClip;
      const video = videoRef.current;
      if (Math.abs(video.currentTime - sourceTime) > 0.05) {
        video.currentTime = sourceTime;
      }
    }
  }, [playheadTime, clips, isDraggingPlayhead]);

  // Sync video currentTime → playhead (during playback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isDraggingPlayhead) return;
      // Find which clip corresponds to the current video time and compute timeline-time
      const currentVideoTime = video.currentTime;
      let timelineTime = 0;
      for (const clip of clips) {
        if (currentVideoTime >= clip.startTime && currentVideoTime < clip.endTime) {
          timelineTime += currentVideoTime - clip.startTime;
          break;
        }
        timelineTime += clip.duration;
      }
      // Only update if different enough to avoid feedback loop
      const { playheadTime: currentPlayhead } = useTimelineStore.getState();
      if (Math.abs(timelineTime - currentPlayhead) > 0.03) {
        useTimelineStore.getState().setPlayheadTime(timelineTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [clips, isDraggingPlayhead]);

  // Playhead drag handler
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);

    const handleMouseMove = (me: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = me.clientX - rect.left + scrollOffset;
      const time = Math.max(0, Math.min(x / zoom, totalDuration));
      setPlayheadTime(time);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [zoom, scrollOffset, totalDuration, setPlayheadTime]);

  // Click on track to seek
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollOffset;
    const time = Math.max(0, Math.min(x / zoom, totalDuration));
    setPlayheadTime(time);
  }, [zoom, scrollOffset, totalDuration, setPlayheadTime]);

  // Scroll handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    } else {
      // Horizontal scroll
      setScrollOffset(scrollOffset + e.deltaX + e.deltaY);
    }
  }, [scrollOffset, zoomIn, zoomOut, setScrollOffset]);

  // Drag & drop reorder
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData('text/plain');
    if (clipId) {
      reorderClip(clipId, dropIndex);
    }
    setDragOverIndex(null);
  }, [reorderClip]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  if (clips.length === 0 && !videoInfo) {
    return (
      <div className="h-[140px] flex-shrink-0 border-t border-border bg-bg-secondary flex items-center justify-center">
        <span className="text-xs text-text-secondary">匯入影片後顯示時間軸</span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 border-t border-border bg-bg-secondary select-none">
      {/* Toolbar */}
      <div className="h-8 border-b border-border/50 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">時間軸</span>
          <span className="text-[10px] text-text-secondary/60 font-mono">
            {formatTime(playheadTime)} / {formatTime(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Split button */}
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
          {/* Delete clip */}
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

      {/* Timeline track area */}
      <div
        ref={containerRef}
        className="h-[100px] overflow-hidden relative"
        onWheel={handleWheel}
      >
        {/* Ruler */}
        <TimelineRuler
          zoom={zoom}
          scrollOffset={scrollOffset}
          totalDuration={totalDuration}
          containerWidth={containerRef.current?.clientWidth ?? 800}
        />

        {/* Track */}
        <div
          ref={trackRef}
          className="absolute top-5 left-0 right-0 bottom-0 cursor-pointer"
          onClick={handleTrackClick}
        >
          {/* Clips */}
          <div
            className="absolute top-2 bottom-2 flex gap-0.5"
            style={{ left: -scrollOffset, width: timelineWidth }}
          >
            {clips.map((clip, index) => {
              const clipX = clips.slice(0, index).reduce((sum, c) => sum + c.duration * zoom, 0);

              return (
                <div
                  key={clip.id}
                  style={{ position: 'absolute', left: clipX, width: clip.duration * zoom }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {dragOverIndex === index && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent z-10" />
                  )}
                  <TimelineClipItem
                    clip={clip}
                    isSelected={selectedClipId === clip.id}
                    zoom={zoom}
                    onSelect={() => selectClip(clip.id)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          {playheadX >= -10 && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-auto cursor-col-resize"
              style={{ left: playheadX - 6, width: 12 }}
              onMouseDown={handlePlayheadMouseDown}
            >
              {/* Playhead head (triangle) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2">
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #e94560',
                  }}
                />
              </div>
              {/* Playhead line */}
              <div className="absolute top-1.5 left-1/2 -translate-x-[0.5px] bottom-0 w-px bg-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Find which clip the playhead is in, given timeline-time */
function getClipAtTime(clips: { startTime: number; endTime: number; duration: number }[], timelineTime: number) {
  let accumulated = 0;
  for (const clip of clips) {
    if (timelineTime < accumulated + clip.duration) {
      return { clip, offsetInClip: timelineTime - accumulated };
    }
    accumulated += clip.duration;
  }
  // If past the end, return last clip at its end
  if (clips.length > 0) {
    const last = clips[clips.length - 1];
    return { clip: last, offsetInClip: last.duration };
  }
  return null;
}
