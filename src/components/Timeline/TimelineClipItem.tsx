import { useCallback, useState } from 'react';
import { useTimelineStore } from '../../stores/timelineStore';
import { formatTime } from '../../utils/formatTime';
import type { TimelineClip } from '../../types';

interface TimelineClipItemProps {
  clip: TimelineClip;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onDragEnd: () => void;
}

export function TimelineClipItem({ clip, isSelected, zoom, onSelect, onDragEnd }: TimelineClipItemProps) {
  const { trimClip } = useTimelineStore();
  const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null);

  const clipWidth = clip.duration * zoom;
  const minClipWidth = 20; // minimum display width in px

  // Handle trim drag on clip edges
  const handleTrimMouseDown = useCallback(
    (e: React.MouseEvent, edge: 'start' | 'end') => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingTrim(edge);

      const startX = e.clientX;
      const originalStart = clip.startTime;
      const originalEnd = clip.endTime;
      const minDuration = 0.1; // minimum clip duration in seconds

      const handleMouseMove = (me: MouseEvent) => {
        const deltaX = me.clientX - startX;
        const deltaTime = deltaX / zoom;

        if (edge === 'start') {
          const newStart = Math.max(0, Math.min(originalEnd - minDuration, originalStart + deltaTime));
          trimClip(clip.id, newStart, originalEnd);
        } else {
          const newEnd = Math.max(originalStart + minDuration, originalEnd + deltaTime);
          trimClip(clip.id, originalStart, newEnd);
        }
      };

      const handleMouseUp = () => {
        setIsDraggingTrim(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [clip, zoom, trimClip]
  );

  // Drag & drop for reorder
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', clip.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [clip.id]
  );

  return (
    <div
      className={`h-full rounded relative group cursor-pointer overflow-hidden
        ${isSelected
          ? 'bg-accent/30 border border-accent/60'
          : 'bg-bg-component/80 border border-border/40 hover:border-accent/30'
        }
        ${isDraggingTrim ? 'z-10' : ''}
      `}
      style={{ minWidth: minClipWidth }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Clip content */}
      <div className="flex items-center h-full px-2 min-w-0">
        {clipWidth > 60 && (
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-text-primary truncate font-medium">
              {clip.name}
            </div>
            {clipWidth > 120 && (
              <div className="text-[9px] text-text-secondary/70 font-mono">
                {formatTime(clip.startTime)} → {formatTime(clip.endTime)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize
                   bg-transparent hover:bg-accent/50 transition-colors z-10
                   group-hover:bg-accent/20"
        onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
      >
        <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-0.5 h-4 bg-text-secondary/40 rounded-full" />
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize
                   bg-transparent hover:bg-accent/50 transition-colors z-10
                   group-hover:bg-accent/20"
        onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
      >
        <div className="absolute top-1/2 -translate-y-1/2 right-0.5 w-0.5 h-4 bg-text-secondary/40 rounded-full" />
      </div>
    </div>
  );
}
