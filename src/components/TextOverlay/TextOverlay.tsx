import { useRef, useState, useEffect, useCallback } from 'react';
import { useTextStore } from '../../stores/textStore';
import { TextOverlayItem } from './TextOverlayItem';
import { SubtitleDisplay } from './SubtitleDisplay';

interface Props {
  /** Ref to the <video> element */
  videoElement: HTMLVideoElement | null;
  /** Container element for calculating bounds */
  containerElement: HTMLDivElement | null;
}

/**
 * Overlay layer for text items and subtitles on the video.
 */
export function TextOverlay({ videoElement, containerElement }: Props) {
  const { textItems, selectedTextId, selectTextItem, subtitles, subtitleStyle, subtitlesEnabled } = useTextStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videoRect, setVideoRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // Calculate video display rect (same logic as WatermarkOverlay)
  const calculateVideoRect = useCallback(() => {
    if (!videoElement || !containerElement) return;

    const containerRect = containerElement.getBoundingClientRect();
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    const containerW = containerRect.width;
    const containerH = containerRect.height;
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerW / containerH;

    let displayW: number;
    let displayH: number;

    if (containerAspect > videoAspect) {
      displayH = containerH;
      displayW = containerH * videoAspect;
    } else {
      displayW = containerW;
      displayH = containerW / videoAspect;
    }

    const left = (containerW - displayW) / 2;
    const top = (containerH - displayH) / 2;

    setVideoRect({ left, top, width: displayW, height: displayH });
  }, [videoElement, containerElement]);

  // Track video time for time-range visibility and subtitle sync
  useEffect(() => {
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };
    const handleLoadedMetadata = () => {
      setVideoDuration(videoElement.duration);
      calculateVideoRect();
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('loadeddata', handleLoadedMetadata);

    // Initialize
    if (videoElement.duration) {
      setVideoDuration(videoElement.duration);
      setCurrentTime(videoElement.currentTime);
    }

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('loadeddata', handleLoadedMetadata);
    };
  }, [videoElement, calculateVideoRect]);

  // Recalculate on resize
  useEffect(() => {
    calculateVideoRect();

    const handleResize = () => calculateVideoRect();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | undefined;
    if (containerElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [containerElement, calculateVideoRect]);

  // Click on empty area → deselect
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current || e.target === (overlayRef.current?.firstElementChild as HTMLElement)) {
        selectTextItem(null);
      }
    },
    [selectTextItem],
  );

  const hasContent = textItems.length > 0 || (subtitles.length > 0 && subtitlesEnabled);
  if (!hasContent) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 12 }}
    >
      <div
        className="absolute pointer-events-auto"
        style={{
          left: `${videoRect.left}px`,
          top: `${videoRect.top}px`,
          width: `${videoRect.width}px`,
          height: `${videoRect.height}px`,
        }}
        onClick={handleOverlayClick}
      >
        {/* Text overlay items */}
        {textItems.map((item) => (
          <TextOverlayItem
            key={item.id}
            item={item}
            isSelected={selectedTextId === item.id}
            videoRect={videoRect}
            currentTime={currentTime}
            videoDuration={videoDuration}
          />
        ))}

        {/* Subtitle display */}
        <SubtitleDisplay
          subtitles={subtitles}
          style={subtitleStyle}
          currentTime={currentTime}
          videoRect={videoRect}
          enabled={subtitlesEnabled}
        />
      </div>
    </div>
  );
}
