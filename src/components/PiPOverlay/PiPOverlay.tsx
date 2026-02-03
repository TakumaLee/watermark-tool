import { useRef, useCallback, useState } from 'react';
import { useEffectsStore } from '../../stores/effectsStore';
import type { PiPConfig } from '../../types';

interface PiPOverlayProps {
  containerWidth: number;
  containerHeight: number;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
}

export function PiPOverlay({
  containerWidth,
  containerHeight,
  videoWidth,
  videoHeight,
  currentTime,
}: PiPOverlayProps) {
  const { pipLayers, selectedPipId, updatePip, selectPip } = useEffectsStore();

  if (pipLayers.length === 0) return null;

  // Calculate video display area (letterbox)
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

  return (
    <div className="absolute inset-0 pointer-events-none">
      {pipLayers.map((pip) => {
        // Check time visibility
        const endTime = pip.endTime < 0 ? Infinity : pip.endTime;
        if (currentTime < pip.startTime || currentTime > endTime) return null;

        return (
          <PiPItem
            key={pip.id}
            pip={pip}
            isSelected={selectedPipId === pip.id}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
            offsetX={offsetX}
            offsetY={offsetY}
            onSelect={() => selectPip(pip.id)}
            onUpdate={(updates) => updatePip(pip.id, updates)}
          />
        );
      })}
    </div>
  );
}

interface PiPItemProps {
  pip: PiPConfig;
  isSelected: boolean;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<PiPConfig>) => void;
}

function PiPItem({
  pip,
  isSelected,
  displayWidth,
  displayHeight,
  offsetX,
  offsetY,
  onSelect,
  onUpdate,
}: PiPItemProps) {
  const [_isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const pixelX = offsetX + pip.x * displayWidth;
  const pixelY = offsetY + pip.y * displayHeight;
  const pixelW = pip.width * displayWidth;
  const pixelH = pip.height * displayHeight;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        startX: pip.x,
        startY: pip.y,
      };

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - dragStart.current.x) / displayWidth;
        const dy = (me.clientY - dragStart.current.y) / displayHeight;
        const newX = Math.max(0, Math.min(1 - pip.width, dragStart.current.startX + dx));
        const newY = Math.max(0, Math.min(1 - pip.height, dragStart.current.startY + dy));
        onUpdate({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [pip, displayWidth, displayHeight, onSelect, onUpdate]
  );

  return (
    <div
      className={`absolute pointer-events-auto cursor-move ${
        isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-white/30'
      }`}
      style={{
        left: pixelX,
        top: pixelY,
        width: pixelW,
        height: pixelH,
      }}
      onMouseDown={handleMouseDown}
    >
      <video
        src={pip.sourceUrl}
        className="w-full h-full object-cover rounded-sm"
        muted
        loop
        autoPlay
        playsInline
      />
      {isSelected && (
        <div className="absolute -top-4 left-0 text-[9px] text-accent bg-bg-secondary/80 px-1 rounded">
          PiP: {pip.name}
        </div>
      )}
    </div>
  );
}

export default PiPOverlay;
