import { useRef, useCallback, useEffect, useState } from 'react';
import { useTimelineStore } from '../../stores/timelineStore';
import { useVideoStore } from '../../stores/videoStore';
import { useModuleStore } from '../../stores/moduleStore';
import { TimelineClipItem } from './TimelineClipItem';
import { TimelineRuler } from './TimelineRuler';
import { TransitionIcon } from './TransitionIcon';
import { TimelineToolbar } from './TimelineToolbar';
import { computeDropIndex } from '../../viewmodels/timelineLogic';

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function Timeline({ videoRef }: TimelineProps) {
  const {
    clips,
    playheadTime,
    activeClipIndex,
    zoom,
    scrollOffset,
    totalDuration,
    selectedClipId,
    setPlayheadTime,
    selectClip,
    reorderClip,
    zoomIn,
    zoomOut,
    setScrollOffset,
  } = useTimelineStore();

  const slotVersion = useTimelineStore((s) => s.slotVersion);
  const { videoInfo } = useVideoStore();
  const isFiltersEnabled = useModuleStore((s) => s.isEnabled('filters'));
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const dropIndicatorRef = useRef<number | null>(null);

  const timelineWidth = totalDuration * zoom;
  const playheadX = playheadTime * zoom - scrollOffset;

  // Sync playhead → video currentTime for structural changes (trim/split) while paused.
  // Guard !video.paused prevents feedback loop: during playback, video drives playhead,
  // not the other way around. Direct seeking is handled in track-click / drag handlers.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isDraggingPlayhead || activeClipIndex >= 0) return;
    if (!video.paused) return;
    const clipInfo = getClipAtTime(clips, playheadTime);
    if (clipInfo) {
      const sourceTime = clipInfo.clip.startTime + clipInfo.offsetInClip;
      if (Math.abs(video.currentTime - sourceTime) > 0.05) {
        video.currentTime = sourceTime;
      }
    }
  }, [playheadTime, clips, isDraggingPlayhead, activeClipIndex]);

  // Sync video currentTime → playhead (during playback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isDraggingPlayhead) return;
      const currentVideoTime = video.currentTime;
      const { clips: currentClips, activeClipIndex: activeIdx } = useTimelineStore.getState();

      let timelineTime = 0;
      if (activeIdx >= 0 && activeIdx < currentClips.length) {
        const activeClip = currentClips[activeIdx];
        const clipTimelineStart = currentClips.slice(0, activeIdx).reduce((s, c) => s + c.duration, 0);
        timelineTime = clipTimelineStart + Math.max(0, currentVideoTime - activeClip.startTime);
      } else {
        // Single source: map source time to timeline time.
        // If currentVideoTime falls in a gap between clips, stop accumulating —
        // useClipPlayback will seek past the gap on the next timeupdate.
        for (const clip of currentClips) {
          if (currentVideoTime < clip.startTime) break; // in a gap before this clip
          if (currentVideoTime < clip.endTime) {
            timelineTime += currentVideoTime - clip.startTime;
            break;
          }
          timelineTime += clip.duration;
        }
      }

      const { playheadTime: currentPlayhead, scrollOffset: curScroll, zoom: curZoom } = useTimelineStore.getState();
      if (Math.abs(timelineTime - currentPlayhead) > 0.03) {
        useTimelineStore.getState().setPlayheadTime(timelineTime);
      }

      // Auto-scroll: keep playhead visible (scroll when it reaches the right 10% of viewport)
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const newPlayheadX = timelineTime * curZoom - curScroll;
      if (newPlayheadX > containerWidth - containerWidth * 0.1) {
        useTimelineStore.getState().setScrollOffset(
          Math.max(0, timelineTime * curZoom - containerWidth * 0.7),
        );
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [clips, isDraggingPlayhead, slotVersion]);

  // Playhead drag
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);

    // Seek video directly — can't rely on the sync effect while playing
    const seekVideo = (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const { activeClipIndex: ai, clips: cc } = useTimelineStore.getState();
      if (ai >= 0) return; // multi-source: useTimelinePreview reacts to setPlayheadTime
      const info = getClipAtTime(cc, time);
      if (info) video.currentTime = info.clip.startTime + info.offsetInClip;
    };

    const handleMouseMove = (me: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = me.clientX - rect.left + scrollOffset;
      const time = Math.max(0, Math.min(x / zoom, totalDuration));
      setPlayheadTime(time);
      seekVideo(time);
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
    // Seek video directly — sync effect skips during playback
    const video = videoRef.current;
    if (video) {
      const { activeClipIndex: ai, clips: cc } = useTimelineStore.getState();
      if (ai < 0) {
        const info = getClipAtTime(cc, time);
        if (info) video.currentTime = info.clip.startTime + info.offsetInClip;
      }
    }
  }, [zoom, scrollOffset, totalDuration, setPlayheadTime]);

  // Scroll / zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(); else zoomOut();
    } else {
      setScrollOffset(scrollOffset + e.deltaX + e.deltaY);
    }
  }, [scrollOffset, zoomIn, zoomOut, setScrollOffset]);

  // Mouse-based clip reorder (replaces unreliable HTML5 drag API in Tauri WebKit)
  const handleClipMoveStart = useCallback((clipId: string, startX: number) => {
    let hasDragged = false;

    const handleMouseMove = (me: MouseEvent) => {
      if (!hasDragged && Math.abs(me.clientX - startX) < 4) return;
      hasDragged = true;
      if (!trackRef.current) return;

      const { clips: cc, zoom: z, scrollOffset: so } = useTimelineStore.getState();
      const rect = trackRef.current.getBoundingClientRect();
      const x = me.clientX - rect.left + so;
      const targetIndex = computeDropIndex(cc, z, x);
      dropIndicatorRef.current = targetIndex;
      setDropIndicatorIndex(targetIndex);
    };

    const handleMouseUp = () => {
      if (hasDragged && dropIndicatorRef.current !== null) {
        reorderClip(clipId, dropIndicatorRef.current);
      }
      setDropIndicatorIndex(null);
      dropIndicatorRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [reorderClip]);

  // Compute drop indicator X position on the track
  const dropIndicatorX = dropIndicatorIndex !== null
    ? (dropIndicatorIndex < clips.length
        ? clips.slice(0, dropIndicatorIndex).reduce((s, c) => s + c.duration * zoom, 0)
        : clips.reduce((s, c) => s + c.duration * zoom, 0))
    : null;

  if (clips.length === 0 && !videoInfo) {
    return (
      <div className="h-[140px] flex-shrink-0 border-t border-border bg-bg-secondary flex items-center justify-center">
        <span className="text-xs text-text-secondary">匯入影片後顯示時間軸</span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 border-t border-border bg-bg-secondary select-none">
      <TimelineToolbar showAddVideo={true} />

      <div
        ref={containerRef}
        className="h-[100px] overflow-hidden relative"
        onWheel={handleWheel}
      >
        <TimelineRuler
          zoom={zoom}
          scrollOffset={scrollOffset}
          totalDuration={totalDuration}
          containerWidth={containerRef.current?.clientWidth ?? 800}
        />

        <div
          ref={trackRef}
          className="absolute top-5 left-0 right-0 bottom-0 cursor-pointer"
          onClick={handleTrackClick}
        >
          {/* Clips */}
          <div
            className="absolute top-2 bottom-2"
            style={{ left: -scrollOffset, width: timelineWidth }}
          >
            {clips.map((clip, index) => {
              const clipX = clips.slice(0, index).reduce((sum, c) => sum + c.duration * zoom, 0);
              return (
                <div
                  key={clip.id}
                  style={{ position: 'absolute', left: clipX, width: clip.duration * zoom }}
                >
                  <TimelineClipItem
                    clip={clip}
                    isSelected={selectedClipId === clip.id}
                    zoom={zoom}
                    onSelect={() => selectClip(clip.id)}
                    onMoveStart={handleClipMoveStart}
                  />
                  {isFiltersEnabled && index < clips.length - 1 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 z-30"
                      style={{ right: -12 }}
                    >
                      <TransitionIcon fromClipId={clip.id} toClipId={clips[index + 1].id} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drag-reorder indicator */}
            {dropIndicatorX !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 pointer-events-none"
                style={{ left: dropIndicatorX }}
              />
            )}
          </div>

          {/* Playhead */}
          {playheadX >= -10 && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-auto cursor-col-resize"
              style={{ left: playheadX - 6, width: 12 }}
              onMouseDown={handlePlayheadMouseDown}
            >
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
              <div className="absolute top-1.5 left-1/2 -translate-x-[0.5px] bottom-0 w-px bg-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getClipAtTime(clips: { startTime: number; endTime: number; duration: number }[], timelineTime: number) {
  let accumulated = 0;
  for (const clip of clips) {
    if (timelineTime < accumulated + clip.duration) {
      return { clip, offsetInClip: timelineTime - accumulated };
    }
    accumulated += clip.duration;
  }
  if (clips.length > 0) {
    const last = clips[clips.length - 1];
    return { clip: last, offsetInClip: last.duration };
  }
  return null;
}
