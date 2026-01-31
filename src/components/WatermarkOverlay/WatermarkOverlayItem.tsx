import { useCallback, useRef, useState } from 'react';
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

export function WatermarkOverlayItem({ watermark, isSelected, videoRect }: Props) {
  const { updateWatermark, selectWatermark } = useWatermarkStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Convert ratio coordinates to pixel positions within the video rect
  const pixelX = watermark.x * videoRect.width;
  const pixelY = watermark.y * videoRect.height;
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
          // Use width as the driver
          newH = newW * aspectRatio;

          // Recalculate position for top-anchored handles
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
        opacity: watermark.opacity / 100,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 20 : 10,
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
        </>
      )}

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute inset-0 border-2 border-accent/50 bg-accent/5 pointer-events-none" />
      )}
    </div>
  );
}
