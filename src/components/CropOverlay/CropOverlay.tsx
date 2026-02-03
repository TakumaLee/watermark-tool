import { useCallback } from 'react';
import { useEffectsStore } from '../../stores/effectsStore';

interface CropOverlayProps {
  containerWidth: number;
  containerHeight: number;
  videoWidth: number;
  videoHeight: number;
}

export function CropOverlay({
  containerWidth,
  containerHeight,
  videoWidth,
  videoHeight,
}: CropOverlayProps) {
  const { transform, setCrop } = useEffectsStore();

  if (!transform.crop) return null;

  const crop = transform.crop;

  // Calculate video display area
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;
  let displayWidth: number;
  let displayHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > containerAspect) {
    displayWidth = containerWidth;
    displayHeight = containerWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayHeight) / 2;
  } else {
    displayHeight = containerHeight;
    displayWidth = containerHeight * videoAspect;
    offsetX = (containerWidth - displayWidth) / 2;
    offsetY = 0;
  }

  const cropX = offsetX + crop.x * displayWidth;
  const cropY = offsetY + crop.y * displayHeight;
  const cropW = crop.width * displayWidth;
  const cropH = crop.height * displayHeight;

  const handleDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startCropX = crop.x;
      const startCropY = crop.y;

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / displayWidth;
        const dy = (me.clientY - startY) / displayHeight;
        setCrop({
          ...crop,
          x: Math.max(0, Math.min(1 - crop.width, startCropX + dx)),
          y: Math.max(0, Math.min(1 - crop.height, startCropY + dy)),
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [crop, displayWidth, displayHeight, setCrop]
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dark overlay outside crop area */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Crop area (transparent) */}
      <div
        className="absolute pointer-events-auto cursor-move border-2 border-accent border-dashed"
        style={{
          left: cropX,
          top: cropY,
          width: cropW,
          height: cropH,
          // Cut out from the dark overlay by using box-shadow trick
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.5)`,
          background: 'transparent',
        }}
        onMouseDown={handleDrag}
      >
        {/* Corner handles */}
        {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
          <CropHandle
            key={corner}
            corner={corner}
            crop={crop}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
            setCrop={setCrop}
          />
        ))}

        {/* Size label */}
        <div className="absolute top-1 left-1 text-[9px] text-accent bg-black/60 px-1 rounded">
          {Math.round(crop.width * videoWidth)} × {Math.round(crop.height * videoHeight)}
        </div>
      </div>
    </div>
  );
}

function CropHandle({
  corner,
  crop,
  displayWidth,
  displayHeight,
  setCrop,
}: {
  corner: 'nw' | 'ne' | 'sw' | 'se';
  crop: { x: number; y: number; width: number; height: number };
  displayWidth: number;
  displayHeight: number;
  setCrop: (c: { x: number; y: number; width: number; height: number }) => void;
}) {
  const posStyle: React.CSSProperties = {
    nw: { top: -4, left: -4, cursor: 'nw-resize' },
    ne: { top: -4, right: -4, cursor: 'ne-resize' },
    sw: { bottom: -4, left: -4, cursor: 'sw-resize' },
    se: { bottom: -4, right: -4, cursor: 'se-resize' },
  }[corner];

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startCrop = { ...crop };

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / displayWidth;
        const dy = (me.clientY - startY) / displayHeight;

        let { x, y, width, height } = startCrop;

        if (corner.includes('e')) {
          width = Math.max(0.1, Math.min(1 - x, startCrop.width + dx));
        }
        if (corner.includes('w')) {
          const newX = Math.max(0, startCrop.x + dx);
          width = Math.max(0.1, startCrop.width - (newX - startCrop.x));
          x = newX;
        }
        if (corner.includes('s')) {
          height = Math.max(0.1, Math.min(1 - y, startCrop.height + dy));
        }
        if (corner.includes('n')) {
          const newY = Math.max(0, startCrop.y + dy);
          height = Math.max(0.1, startCrop.height - (newY - startCrop.y));
          y = newY;
        }

        setCrop({ x, y, width, height });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [corner, crop, displayWidth, displayHeight, setCrop]
  );

  return (
    <div
      className="absolute w-2 h-2 bg-accent rounded-full pointer-events-auto"
      style={posStyle}
      onMouseDown={handleMouseDown}
    />
  );
}

export default CropOverlay;
