import { useRef, useState, useEffect, useCallback } from 'react';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { WatermarkOverlayItem } from './WatermarkOverlayItem';

interface Props {
  /** Ref to the <video> element for calculating actual video display area */
  videoElement: HTMLVideoElement | null;
  /** Container element for calculating bounds */
  containerElement: HTMLDivElement | null;
}

/**
 * Overlay layer that sits on top of the video preview.
 * Renders all watermarks with correct positioning relative to the actual video display area.
 */
export function WatermarkOverlay({ videoElement, containerElement }: Props) {
  const { watermarks, selectedId, selectWatermark } = useWatermarkStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Track the actual video display rect (accounting for letterbox/pillarbox)
  const [videoRect, setVideoRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

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
      // Container is wider → video fits height, pillarboxed
      displayH = containerH;
      displayW = containerH * videoAspect;
    } else {
      // Container is taller → video fits width, letterboxed
      displayW = containerW;
      displayH = containerW / videoAspect;
    }

    const left = (containerW - displayW) / 2;
    const top = (containerH - displayH) / 2;

    setVideoRect({ left, top, width: displayW, height: displayH });
  }, [videoElement, containerElement]);

  // Recalculate on resize and video load
  useEffect(() => {
    calculateVideoRect();

    const handleResize = () => calculateVideoRect();
    window.addEventListener('resize', handleResize);

    // Also recalculate when video metadata loads
    const handleLoadedData = () => calculateVideoRect();
    videoElement?.addEventListener('loadeddata', handleLoadedData);
    videoElement?.addEventListener('loadedmetadata', handleLoadedData);

    // Use ResizeObserver for container size changes
    let resizeObserver: ResizeObserver | undefined;
    if (containerElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      videoElement?.removeEventListener('loadeddata', handleLoadedData);
      videoElement?.removeEventListener('loadedmetadata', handleLoadedData);
      resizeObserver?.disconnect();
    };
  }, [videoElement, containerElement, calculateVideoRect]);

  // Click on empty overlay area → deselect
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        selectWatermark(null);
      }
    },
    [selectWatermark],
  );

  if (watermarks.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {/* Clickable area constrained to video display region */}
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
        {watermarks.map((wm) => (
          <WatermarkOverlayItem
            key={wm.id}
            watermark={wm}
            isSelected={selectedId === wm.id}
            videoRect={videoRect}
          />
        ))}
      </div>
    </div>
  );
}
