import { useCallback, useRef, useState, useEffect } from 'react';
import type { WatermarkItem } from '../../types';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useVideoStore } from '../../stores/videoStore';

interface Props {
  watermark: WatermarkItem;
  isSelected: boolean;
  /** The actual displayed video rect within the container (accounting for letterbox) */
  videoRect: { left: number; top: number; width: number; height: number };
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

/**
 * Compute animated position offset for movement preview.
 * Returns {dx, dy} in pixels (relative to videoRect), and visibility flag.
 */
function useMovementPreview(
  watermark: WatermarkItem,
  videoRect: { width: number; height: number },
): { dx: number; dy: number; visible: boolean } {
  const [offset, setOffset] = useState({ dx: 0, dy: 0, visible: true });
  const animRef = useRef<number>(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    const movement = watermark.movement;

    // Only animate for non-static modes
    if (movement.type === 'Static') {
      setOffset({ dx: 0, dy: 0, visible: true });
      return;
    }

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const t = (now - startTimeRef.current) / 1000; // seconds

      if (movement.type === 'Linear') {
        const speed = movement.speed;
        const wmW = watermark.width * videoRect.width;
        const wmH = watermark.height * videoRect.height;
        const maxX = videoRect.width - wmW;
        const maxY = videoRect.height - wmH;

        // Ping-pong bounce pattern
        const bounce = (pos: number, range: number): number => {
          if (range <= 0) return 0;
          const mod = ((pos % (2 * range)) + 2 * range) % (2 * range);
          return Math.abs(mod - range);
        };

        let dx = 0;
        let dy = 0;

        const baseX = watermark.x * videoRect.width;
        const baseY = watermark.y * videoRect.height;

        switch (movement.direction) {
          case 'horizontal':
            dx = bounce(baseX + speed * t, maxX) - baseX;
            break;
          case 'vertical':
            dy = bounce(baseY + speed * t, maxY) - baseY;
            break;
          case 'diagonal':
            dx = bounce(baseX + speed * t, maxX) - baseX;
            dy = bounce(baseY + speed * t, maxY) - baseY;
            break;
        }

        setOffset({ dx, dy, visible: true });
      } else if (movement.type === 'Random') {
        const interval = movement.interval;
        const segmentIndex = Math.floor(t / interval);
        const tInSegment = t - segmentIndex * interval;
        const visibleDuration = movement.fade_duration > 0
          ? interval - movement.fade_duration
          : interval * 0.8;
        const visible = tInSegment < visibleDuration;

        // Pseudo-random positions based on segment index
        const wmW = watermark.width * videoRect.width;
        const wmH = watermark.height * videoRect.height;
        const maxX = videoRect.width - wmW;
        const maxY = videoRect.height - wmH;
        const baseX = watermark.x * videoRect.width;
        const baseY = watermark.y * videoRect.height;

        // Use same pseudo-random as FFmpeg (mod with primes)
        const px = maxX > 0 ? ((segmentIndex * 7919) % maxX) : 0;
        const py = maxY > 0 ? ((segmentIndex * 6271) % maxY) : 0;

        const dx = px - baseX;
        const dy = py - baseY;

        setOffset({ dx, dy, visible });
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [watermark.movement, watermark.x, watermark.y, watermark.width, watermark.height, videoRect.width, videoRect.height]);

  return offset;
}

export function WatermarkOverlayItem({ watermark, isSelected, videoRect }: Props) {
  const { updateWatermark, selectWatermark } = useWatermarkStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Movement preview animation
  const { dx, dy, visible } = useMovementPreview(watermark, videoRect);

  // Convert ratio coordinates to pixel positions within the video rect
  const pixelX = watermark.x * videoRect.width + dx;
  const pixelY = watermark.y * videoRect.height + dy;
  const pixelW = watermark.width * videoRect.width;
  const pixelH = watermark.height * videoRect.height;

  // --- Drag logic ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      selectWatermark(watermark.id);

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startX = watermark.x;
      const startY = watermark.y;

      setIsDragging(true);

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startMouseX) / videoRect.width;
        const dy = (me.clientY - startMouseY) / videoRect.height;

        // Clamp within video bounds (0–1 minus watermark size)
        const newX = Math.max(0, Math.min(1 - watermark.width, startX + dx));
        const newY = Math.max(0, Math.min(1 - watermark.height, startY + dy));

        updateWatermark(watermark.id, { x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [watermark, videoRect, updateWatermark, selectWatermark],
  );

  // --- Resize logic ---
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();
      selectWatermark(watermark.id);

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startX = watermark.x;
      const startY = watermark.y;
      const startW = watermark.width;
      const startH = watermark.height;
      const aspectRatio = videoInfo
        ? (watermark.naturalHeight / watermark.naturalWidth) * (videoInfo.width / videoInfo.height)
        : watermark.naturalHeight / watermark.naturalWidth;

      setIsResizing(true);

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startMouseX) / videoRect.width;
        const dy = (me.clientY - startMouseY) / videoRect.height;

        let newX = startX;
        let newY = startY;
        let newW = startW;
        let newH = startH;

        // Calculate new size based on handle
        switch (handle) {
          case 'se':
            newW = Math.max(0.02, startW + dx);
            newH = Math.max(0.02, startH + dy);
            break;
          case 'sw':
            newW = Math.max(0.02, startW - dx);
            newH = Math.max(0.02, startH + dy);
            newX = startX + startW - newW;
            break;
          case 'ne':
            newW = Math.max(0.02, startW + dx);
            newH = Math.max(0.02, startH - dy);
            newY = startY + startH - newH;
            break;
          case 'nw':
            newW = Math.max(0.02, startW - dx);
            newH = Math.max(0.02, startH - dy);
            newX = startX + startW - newW;
            newY = startY + startH - newH;
            break;
        }

        // Lock aspect ratio
        if (watermark.lockAspectRatio) {
          newH = newW * aspectRatio;

          if (handle === 'ne' || handle === 'nw') {
            newY = startY + startH - newH;
          }
          if (handle === 'nw' || handle === 'sw') {
            newX = startX + startW - newW;
          }
        }

        // Clamp to bounds
        newX = Math.max(0, Math.min(1 - newW, newX));
        newY = Math.max(0, Math.min(1 - newH, newY));

        updateWatermark(watermark.id, { x: newX, y: newY, width: newW, height: newH });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [watermark, videoRect, videoInfo, updateWatermark, selectWatermark],
  );

  // Handle cursors for resize handles
  const handleCursors: Record<ResizeHandle, string> = {
    nw: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    se: 'nwse-resize',
  };

  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
  const handlePositions: Record<ResizeHandle, { left: string; top: string; transform: string }> = {
    nw: { left: '0', top: '0', transform: 'translate(-50%, -50%)' },
    ne: { left: '100%', top: '0', transform: 'translate(-50%, -50%)' },
    sw: { left: '0', top: '100%', transform: 'translate(-50%, -50%)' },
    se: { left: '100%', top: '100%', transform: 'translate(-50%, -50%)' },
  };

  return (
    <div
      ref={itemRef}
      className="absolute select-none"
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        width: `${pixelW}px`,
        height: `${pixelH}px`,
        opacity: visible ? watermark.opacity / 100 : 0,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 20 : 10,
        transition: watermark.movement.type === 'Random' ? 'opacity 0.15s ease' : undefined,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Watermark image */}
      <img
        src={watermark.imageUrl}
        alt={watermark.name}
        className="w-full h-full pointer-events-none"
        style={{ objectFit: 'fill' }}
        draggable={false}
      />

      {/* Selection border + handles */}
      {isSelected && (
        <>
          {/* Selection border */}
          <div
            className="absolute inset-0 border-2 border-accent border-dashed pointer-events-none"
            style={{ margin: '-1px' }}
          />

          {/* Resize handles */}
          {handles.map((handle) => (
            <div
              key={handle}
              className="absolute w-3 h-3 bg-accent border-2 border-white rounded-sm"
              style={{
                ...handlePositions[handle],
                cursor: handleCursors[handle],
                zIndex: 30,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, handle)}
            />
          ))}

          {/* Movement mode badge */}
          {watermark.movement.type !== 'Static' && (
            <div className="absolute -top-5 left-0 text-[9px] text-accent bg-bg-primary/80 px-1.5 py-0.5 rounded pointer-events-none">
              {watermark.movement.type === 'Linear' ? '↔ 線性移動' : '⚡ 隨機出現'}
            </div>
          )}
        </>
      )}

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute inset-0 border-2 border-accent/50 bg-accent/5 pointer-events-none" />
      )}
    </div>
  );
}
