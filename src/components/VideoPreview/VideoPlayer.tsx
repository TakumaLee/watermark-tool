import { useRef, useState, useCallback, useEffect } from 'react';
import { useVideoStore } from '../../stores/videoStore';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useModuleStore } from '../../stores/moduleStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useEffectsStore } from '../../stores/effectsStore';
import { formatTime } from '../../utils/formatTime';
import { getAspectRatioLabel } from '../../utils/aspectRatio';
import { WatermarkOverlay } from '../WatermarkOverlay';
import { TextOverlay } from '../TextOverlay';
import { PiPOverlay } from '../PiPOverlay';
import { CropOverlay } from '../CropOverlay';

interface VideoPlayerProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export function VideoPlayer({ videoRef: externalVideoRef }: VideoPlayerProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { videoUrl, videoInfo, videoPath } = useVideoStore();
  const isWatermarkEnabled = useModuleStore((s) => s.isEnabled('watermark'));
  const isTextEnabled = useModuleStore((s) => s.isEnabled('text'));
  const isTrimEnabled = useModuleStore((s) => s.isEnabled('trim'));
  const isFiltersEnabled = useModuleStore((s) => s.isEnabled('filters'));

  // Effects store for CSS filter preview + speed
  const filters = useEffectsStore((s) => s.filters);
  const speed = useEffectsStore((s) => s.speed);
  const transform = useEffectsStore((s) => s.transform);
  const pipLayers = useEffectsStore((s) => s.pipLayers);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);

  // Expose elements for overlay after mount
  useEffect(() => {
    setVideoElement(videoRef.current);
    setContainerElement(containerRef.current);
  }, [videoRef]);

  // Initialize timeline when video loads (if trim module is enabled)
  useEffect(() => {
    if (isTrimEnabled && videoInfo && videoPath && duration > 0) {
      const { clips } = useTimelineStore.getState();
      // Only init if timeline is empty or video changed
      if (clips.length === 0 || clips[0].sourcePath !== videoPath) {
        const fileName = videoPath.split('/').pop()?.split('\\').pop() ?? 'Video';
        useTimelineStore.getState().initFromVideo(videoPath, videoUrl ?? '', duration, fileName);
      }
    }
  }, [isTrimEnabled, videoInfo, videoPath, videoUrl, duration]);

  // Deselect watermark when clicking on video
  const handleVideoClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, [videoRef]);

  // Keyboard: space to play/pause, delete to remove watermark, arrows to nudge, S to split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleVideoClick();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        const { selectedId, removeWatermark } = useWatermarkStore.getState();
        if (selectedId && e.target === document.body) {
          e.preventDefault();
          removeWatermark(selectedId);
        }
      } else if (e.code === 'Escape') {
        useWatermarkStore.getState().selectWatermark(null);
        useTimelineStore.getState().selectClip(null);
      } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && isTrimEnabled) {
        // Split at playhead
        e.preventDefault();
        useTimelineStore.getState().splitAtPlayhead();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        const { selectedId, watermarks, updateWatermark } = useWatermarkStore.getState();
        if (!selectedId) return;
        e.preventDefault();

        const wm = watermarks.find((w) => w.id === selectedId);
        if (!wm) return;

        const step = e.shiftKey ? 0.01 : 0.001; // ~10px or ~1px
        let { x, y } = wm;

        switch (e.code) {
          case 'ArrowUp': y = Math.max(0, y - step); break;
          case 'ArrowDown': y = Math.min(1 - wm.height, y + step); break;
          case 'ArrowLeft': x = Math.max(0, x - step); break;
          case 'ArrowRight': x = Math.min(1 - wm.width, x + step); break;
        }

        updateWatermark(selectedId, { x, y });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleVideoClick, isTrimEnabled]);

  // Seek via progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar) return;

      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = ratio * video.duration;
    },
    [videoRef],
  );

  // Seek via drag on progress bar
  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsSeeking(true);
      handleProgressClick(e);

      const handleMouseMove = (me: MouseEvent) => {
        const video = videoRef.current;
        const bar = progressRef.current;
        if (!video || !bar) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
      };

      const handleMouseUp = () => {
        setIsSeeking(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleProgressClick, videoRef],
  );

  // CSS filter preview for video element
  const cssFilterStyle = isFiltersEnabled
    ? `brightness(${1 + filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`
    : undefined;

  // CSS transform preview for rotation/flip
  const cssTransformParts: string[] = [];
  if (transform.rotation !== 0) {
    cssTransformParts.push(`rotate(${transform.rotation}deg)`);
  }
  if (transform.flip === 'horizontal' || transform.flip === 'both') {
    cssTransformParts.push('scaleX(-1)');
  }
  if (transform.flip === 'vertical' || transform.flip === 'both') {
    cssTransformParts.push('scaleY(-1)');
  }
  const cssTransformStyle = isFiltersEnabled && cssTransformParts.length > 0
    ? cssTransformParts.join(' ')
    : undefined;

  // Sync playbackRate when speed changes
  useEffect(() => {
    if (videoRef.current && isFiltersEnabled) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, isFiltersEnabled, videoRef]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const aspectLabel = videoInfo ? getAspectRatioLabel(videoInfo.width, videoInfo.height) : '';

  return (
    <div className="flex flex-col h-full">
      {/* Video container with watermark overlay */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden min-h-0 relative"
      >
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          className="max-w-full max-h-full object-contain"
          style={{
            filter: cssFilterStyle,
            transform: cssTransformStyle,
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (!isSeeking && videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onClick={handleVideoClick}
          playsInline
        />

        {/* Watermark overlay (only if watermark module is enabled) */}
        {isWatermarkEnabled && (
          <WatermarkOverlay
            videoElement={videoElement}
            containerElement={containerElement}
          />
        )}

        {/* Text overlay (only if text module is enabled) */}
        {isTextEnabled && (
          <TextOverlay
            videoElement={videoElement}
            containerElement={containerElement}
          />
        )}

        {/* PiP overlay (only if filters module is enabled and PiP layers exist) */}
        {isFiltersEnabled && pipLayers.length > 0 && videoInfo && containerElement && (
          <PiPOverlay
            containerWidth={containerElement.clientWidth}
            containerHeight={containerElement.clientHeight}
            videoWidth={videoInfo.width}
            videoHeight={videoInfo.height}
            currentTime={currentTime}
          />
        )}

        {/* Crop overlay (only if filters module is enabled and crop is active) */}
        {isFiltersEnabled && transform.crop && videoInfo && containerElement && (
          <CropOverlay
            containerWidth={containerElement.clientWidth}
            containerHeight={containerElement.clientHeight}
            videoWidth={videoInfo.width}
            videoHeight={videoInfo.height}
          />
        )}
      </div>

      {/* Playback controls (hidden when timeline is active — timeline has its own playhead) */}
      {!isTrimEnabled && (
        <div className="flex items-center gap-3 mt-3 px-1">
          {/* Play/Pause button */}
          <button
            onClick={handleVideoClick}
            className="w-8 h-8 flex items-center justify-center text-text-primary
                       hover:text-accent transition-colors duration-150 text-lg flex-shrink-0"
            title={isPlaying ? '暫停' : '播放'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Progress bar */}
          <div
            ref={progressRef}
            className="flex-1 h-5 flex items-center cursor-pointer group"
            onMouseDown={handleProgressMouseDown}
          >
            <div className="w-full h-1 bg-border rounded-full relative group-hover:h-1.5 transition-all">
              <div
                className="absolute left-0 top-0 h-full bg-accent rounded-full transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full
                           opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          {/* Time display */}
          <span className="text-xs text-text-secondary font-mono whitespace-nowrap flex-shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Aspect ratio badge */}
          {aspectLabel && (
            <span className="text-xs text-text-secondary bg-bg-component px-2 py-0.5 rounded flex-shrink-0">
              {aspectLabel}
            </span>
          )}
        </div>
      )}

      {/* Simplified controls when timeline is active */}
      {isTrimEnabled && (
        <div className="flex items-center gap-3 mt-2 px-1">
          <button
            onClick={handleVideoClick}
            className="w-7 h-7 flex items-center justify-center text-text-primary
                       hover:text-accent transition-colors duration-150 text-sm flex-shrink-0"
            title={isPlaying ? '暫停' : '播放'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="text-xs text-text-secondary font-mono">
            {formatTime(currentTime)}
          </span>
          {aspectLabel && (
            <span className="text-xs text-text-secondary bg-bg-component px-2 py-0.5 rounded flex-shrink-0 ml-auto">
              {aspectLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
