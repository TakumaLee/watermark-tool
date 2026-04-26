import { useCallback, useState } from 'react';
import { useTimelineStore } from '../../stores/timelineStore';
import { formatTime } from '../../utils/formatTime';
import type { TimelineClip } from '../../types';

interface TimelineClipItemProps {
  clip: TimelineClip;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onMoveStart: (clipId: string, startX: number) => void;
}

export function TimelineClipItem({ clip, isSelected, zoom, onSelect, onMoveStart }: TimelineClipItemProps) {
  const { trimClip } = useTimelineStore();
  const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null);

  const clipWidth = clip.duration * zoom;
  const minClipWidth = 20;

  const handleTrimMouseDown = useCallback(
    (e: React.MouseEvent, edge: 'start' | 'end') => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingTrim(edge);

      const startX = e.clientX;
      const originalStart = clip.startTime;
      const originalEnd = clip.endTime;
      const minDuration = 0.1;

      const handleMouseMove = (me: MouseEvent) => {
        const deltaTime = (me.clientX - startX) / zoom;
        if (edge === 'start') {
          // Constrain to [sourceStart, currentEnd - minDuration]
          const newStart = Math.max(clip.sourceStart, Math.min(originalEnd - minDuration, originalStart + deltaTime));
          trimClip(clip.id, newStart, originalEnd);
        } else {
          // Constrain to [currentStart + minDuration, sourceEnd]
          const newEnd = Math.min(clip.sourceEnd, Math.max(originalStart + minDuration, originalEnd + deltaTime));
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

  return (
    <div
      className={`h-full rounded relative group cursor-grab overflow-hidden
        ${isSelected
          ? 'bg-accent/30 border border-accent/60'
          : 'bg-bg-component/80 border border-border/40 hover:border-accent/30'
        }
        ${isDraggingTrim ? 'z-10 cursor-ew-resize' : ''}
      `}
      style={{ minWidth: minClipWidth }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={(e) => {
        onMoveStart(clip.id, e.clientX);
      }}
    >
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
