import { useMemo } from 'react';
import { formatTime } from '../../utils/formatTime';

interface TimelineRulerProps {
  zoom: number;
  scrollOffset: number;
  totalDuration: number;
  containerWidth: number;
}

export function TimelineRuler({ zoom, scrollOffset, totalDuration, containerWidth }: TimelineRulerProps) {
  const ticks = useMemo(() => {
    // Determine tick interval based on zoom level
    const targetPixelGap = 80; // target gap between ticks in pixels
    const rawInterval = targetPixelGap / zoom; // seconds per tick

    // Snap to nice intervals
    const niceIntervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let interval = niceIntervals.find((i) => i >= rawInterval) ?? 600;

    const startTime = Math.max(0, Math.floor((scrollOffset / zoom) / interval) * interval);
    const endTime = Math.min(totalDuration + interval, (scrollOffset + containerWidth) / zoom + interval);

    const result: { time: number; x: number; isMinor: boolean }[] = [];
    for (let t = startTime; t <= endTime; t += interval) {
      result.push({
        time: t,
        x: t * zoom - scrollOffset,
        isMinor: false,
      });
      // Add minor tick at midpoint
      const mid = t + interval / 2;
      if (mid <= endTime) {
        result.push({
          time: mid,
          x: mid * zoom - scrollOffset,
          isMinor: true,
        });
      }
    }
    return result;
  }, [zoom, scrollOffset, totalDuration, containerWidth]);

  return (
    <div className="absolute top-0 left-0 right-0 h-5 bg-bg-primary/50 border-b border-border/30 overflow-hidden">
      {ticks.map((tick, i) => (
        <div key={i} className="absolute top-0" style={{ left: tick.x }}>
          {tick.isMinor ? (
            <div className="w-px h-2 bg-border/40 mt-3" />
          ) : (
            <>
              <span className="text-[9px] text-text-secondary/50 font-mono absolute top-0 -translate-x-1/2 whitespace-nowrap">
                {formatTime(tick.time)}
              </span>
              <div className="w-px h-2.5 bg-border/60 mt-2.5" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
