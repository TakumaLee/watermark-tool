import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { useVideoStore } from '../../stores/videoStore';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useModuleStore } from '../../stores/moduleStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useEffectsStore } from '../../stores/effectsStore';
import { useTimelinePreview } from '../../viewmodels/useTimelinePreview';
import { useClipPlayback } from '../../viewmodels/useClipPlayback';
import { useBGMPreview } from '../../viewmodels/useBGMPreview';
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
  // Two physical <video> elements for double-buffer clip transitions.
  // One is always visible+playing (primary), the other preloads the next clip (secondary).
  const slot0Ref = useRef<HTMLVideoElement>(null);
  const slot1Ref = useRef<HTMLVideoElement>(null);

  // Which slot is currently the active (visible) one.
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);

  // Stable refs whose .current points to the active/secondary element.
  // Updated synchronously in useLayoutEffect so all hooks always see the live element.
  const primaryRef = useRef<HTMLVideoElement | null>(null);
  const secondaryRef = useRef<HTMLVideoElement | null>(null);

  // Keep external ref accessible without adding it to reactive deps.
  const extRefHolder = useRef(externalVideoRef);
  extRefHolder.current = externalVideoRef;

  // Initialise on first mount and sync on every slot swap.
  const isInitialRef = useRef(true);
  useLayoutEffect(() => {
    const slot0 = slot0Ref.current;
    const slot1 = slot1Ref.current;
    const newPrimary = activeSlot === 0 ? slot0 : slot1;
    const newSecondary = activeSlot === 0 ? slot1 : slot0;

    // Mute secondary, unmute primary to prevent audio overlap.
    if (slot0) slot0.muted = activeSlot !== 0;
    if (slot1) slot1.muted = activeSlot !== 1;

    primaryRef.current = newPrimary;
    secondaryRef.current = newSecondary;
    if (extRefHolder.current) extRefHolder.current.current = newPrimary;

    // Notify Timeline to re-attach its timeupdate listener to the new element.
    if (!isInitialRef.current) {
      useTimelineStore.getState().bumpSlotVersion();
    }
    isInitialRef.current = false;
  }, [activeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by useTimelinePreview at a clip boundary when the secondary is preloaded.
  const swapSlots = useCallback(() => {
    setActiveSlot((s) => (s === 0 ? 1 : 0));
  }, []);

  const { videoUrl, videoInfo, videoPath } = useVideoStore();
  const prevVideoPathRef = useRef<string | null>(null);
  const isWatermarkEnabled = useModuleStore((s) => s.isEnabled('watermark'));
  const isTextEnabled = useModuleStore((s) => s.isEnabled('text'));
  const isTrimEnabled = useModuleStore((s) => s.isEnabled('trim'));
  const isFiltersEnabled = useModuleStore((s) => s.isEnabled('filters'));

  // Load new video into primary slot on import; clear secondary preload state.
  useEffect(() => {
    if (!videoUrl) return;
    const primary = primaryRef.current;
    if (primary) { primary.src = videoUrl; primary.load(); }
    const secondary = secondaryRef.current;
    if (secondary) { secondary.removeAttribute('src'); secondary.load(); }
  }, [videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plug hooks into the active slot; re-attach when slot swaps (activeSlot in each dep array).
  useTimelinePreview(primaryRef, secondaryRef, swapSlots, activeSlot);
  useClipPlayback(primaryRef, activeSlot);
  useBGMPreview(primaryRef, activeSlot);

  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);

  // Keep overlay refs in sync with the active slot element.
  useEffect(() => {
    setVideoElement(primaryRef.current);
    setContainerElement(containerRef.current);
  }, [activeSlot]);

  // Playback state events — re-attach to new primary on slot swap.
  useEffect(() => {
    const video = primaryRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (!isSeekingRef.current) setCurrentTime(video.currentTime);
    };
    const onMeta = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('ended', onEnded);
    };
  }, [activeSlot]);

  // Initialize timeline when a video is loaded (trim module only).
  useEffect(() => {
    if (!isTrimEnabled || !videoInfo || !videoPath || duration <= 0) return;
    const { clips } = useTimelineStore.getState();
    const videoPathChanged = videoPath !== prevVideoPathRef.current;
    prevVideoPathRef.current = videoPath;

    const shouldInit =
      clips.length === 0 ||
      (videoPathChanged && !clips.some((c) => c.sourcePath === videoPath));

    if (shouldInit) {
      const fileName = videoPath.split('/').pop()?.split('\\').pop() ?? 'Video';
      useTimelineStore.getState().initFromVideo(videoPath, videoUrl ?? '', duration, fileName);
    }
  }, [isTrimEnabled, videoInfo, videoPath, videoUrl, duration]);

  // Play / pause on click.
  const handleVideoClick = useCallback(() => {
    const video = primaryRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        e.preventDefault();
        useTimelineStore.getState().splitAtPlayhead();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        const { selectedId, watermarks, updateWatermark } = useWatermarkStore.getState();
        if (!selectedId) return;
        e.preventDefault();
        const wm = watermarks.find((w) => w.id === selectedId);
        if (!wm) return;
        const step = e.shiftKey ? 0.01 : 0.001;
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

  // Seek via progress bar click.
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = primaryRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }, []);

  // Seek via drag on progress bar.
  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isSeekingRef.current = true;
      handleProgressClick(e);

      const handleMouseMove = (me: MouseEvent) => {
        const video = primaryRef.current;
        const bar = progressRef.current;
        if (!video || !bar) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
      };

      const handleMouseUp = () => {
        isSeekingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleProgressClick],
  );

  // Effects store for CSS filter preview + speed.
  const filters = useEffectsStore((s) => s.filters);
  const speed = useEffectsStore((s) => s.speed);
  const transform = useEffectsStore((s) => s.transform);
  const pipLayers = useEffectsStore((s) => s.pipLayers);

  const cssFilterStyle = isFiltersEnabled
    ? `brightness(${1 + filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`
    : undefined;

  const cssTransformParts: string[] = [];
  if (transform.rotation !== 0) cssTransformParts.push(`rotate(${transform.rotation}deg)`);
  if (transform.flip === 'horizontal' || transform.flip === 'both') cssTransformParts.push('scaleX(-1)');
  if (transform.flip === 'vertical' || transform.flip === 'both') cssTransformParts.push('scaleY(-1)');
  const cssTransformStyle = isFiltersEnabled && cssTransformParts.length > 0
    ? cssTransformParts.join(' ')
    : undefined;

  // Sync playbackRate when speed changes; re-apply after slot swap.
  useEffect(() => {
    if (primaryRef.current && isFiltersEnabled) {
      primaryRef.current.playbackRate = speed;
    }
  }, [speed, isFiltersEnabled, activeSlot]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const aspectLabel = videoInfo ? getAspectRatioLabel(videoInfo.width, videoInfo.height) : '';

  return (
    <div className="flex flex-col h-full">
      {/* Video container with overlays */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden min-h-0 relative"
      >
        {/* Slot 0 — visible when activeSlot === 0 */}
        <video
          ref={slot0Ref}
          className="max-w-full max-h-full object-contain"
          style={{
            filter: activeSlot === 0 ? cssFilterStyle : undefined,
            transform: activeSlot === 0 ? cssTransformStyle : undefined,
            display: activeSlot === 0 ? undefined : 'none',
          }}
          onClick={handleVideoClick}
          playsInline
        />

        {/* Slot 1 — visible when activeSlot === 1 */}
        <video
          ref={slot1Ref}
          className="max-w-full max-h-full object-contain"
          style={{
            filter: activeSlot === 1 ? cssFilterStyle : undefined,
            transform: activeSlot === 1 ? cssTransformStyle : undefined,
            display: activeSlot === 1 ? undefined : 'none',
          }}
          onClick={handleVideoClick}
          playsInline
        />

        {/* Watermark overlay (watermark module only) */}
        {isWatermarkEnabled && (
          <WatermarkOverlay
            videoElement={videoElement}
            containerElement={containerElement}
          />
        )}

        {/* Text overlay (text module only) */}
        {isTextEnabled && (
          <TextOverlay
            videoElement={videoElement}
            containerElement={containerElement}
          />
        )}

        {/* PiP overlay (filters module only) */}
        {isFiltersEnabled && pipLayers.length > 0 && videoInfo && containerElement && (
          <PiPOverlay
            containerWidth={containerElement.clientWidth}
            containerHeight={containerElement.clientHeight}
            videoWidth={videoInfo.width}
            videoHeight={videoInfo.height}
            currentTime={currentTime}
          />
        )}

        {/* Crop overlay (filters module only) */}
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
          <button
            onClick={handleVideoClick}
            className="w-8 h-8 flex items-center justify-center text-text-primary
                       hover:text-accent transition-colors duration-150 text-lg flex-shrink-0"
            title={isPlaying ? '暫停' : '播放'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

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

          <span className="text-xs text-text-secondary font-mono whitespace-nowrap flex-shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

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
