import { useCallback, useRef, useEffect, useState } from 'react';
import { useAudioStore } from '../../stores/audioStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useVideoStore } from '../../stores/videoStore';
import { WaveformCanvas } from './WaveformCanvas';
import { formatTime } from '../../utils/formatTime';

interface AudioTimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function AudioTimeline({ videoRef: _videoRef }: AudioTimelineProps) {
  const {
    mainWaveform,
    bgmItems,
    selectedBgmId,
    selectBgm,
    updateBgm,
  } = useAudioStore();

  const {
    zoom,
    scrollOffset,
    totalDuration,
    playheadTime,
  } = useTimelineStore();

  const { videoInfo } = useVideoStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const duration = totalDuration || videoInfo?.duration || 0;
  const timelineWidth = duration * zoom;
  const playheadRatio = duration > 0 ? playheadTime / duration : 0;

  // BGM drag for offset adjustment
  const [_draggingBgm, setDraggingBgm] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; startOffset: number }>({ x: 0, startOffset: 0 });

  const handleBgmMouseDown = useCallback((e: React.MouseEvent, bgmId: string) => {
    e.preventDefault();
    e.stopPropagation();
    selectBgm(bgmId);
    const bgm = bgmItems.find((b) => b.id === bgmId);
    if (!bgm) return;

    setDraggingBgm(bgmId);
    dragStartRef.current = { x: e.clientX, startOffset: bgm.startOffset };

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - dragStartRef.current.x;
      const timeDelta = dx / zoom;
      const newOffset = Math.max(0, dragStartRef.current.startOffset + timeDelta);
      updateBgm(bgmId, { startOffset: newOffset });
    };

    const handleMouseUp = () => {
      setDraggingBgm(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [bgmItems, zoom, selectBgm, updateBgm]);

  if (duration === 0) return null;

  return (
    <div ref={containerRef} className="flex-shrink-0 border-t border-border/30">
      {/* Main audio waveform */}
      <div className="h-8 relative overflow-hidden bg-bg-primary/50">
        <div
          className="absolute top-0 bottom-0"
          style={{ left: -scrollOffset, width: timelineWidth }}
        >
          <WaveformCanvas
            waveform={mainWaveform}
            width={Math.max(timelineWidth, containerWidth)}
            height={32}
            color="#4a9eff"
            playheadRatio={playheadRatio}
            showPlayhead={true}
          />
        </div>
        {/* Label */}
        <div className="absolute top-0.5 left-1 text-[9px] text-text-secondary/60 pointer-events-none z-10">
          🔊 主音訊
        </div>
      </div>

      {/* BGM tracks */}
      {bgmItems.map((bgm) => {
        const bgmEffectiveDuration = bgm.trimEnd > 0
          ? bgm.trimEnd - bgm.trimStart
          : bgm.duration - bgm.trimStart;
        const bgmLeft = bgm.startOffset * zoom - scrollOffset;
        const bgmWidth = bgmEffectiveDuration * zoom;
        const isSelected = selectedBgmId === bgm.id;

        return (
          <div
            key={bgm.id}
            className="h-8 relative overflow-hidden border-t border-border/20"
          >
            {/* BGM block */}
            <div
              className={`absolute top-0.5 bottom-0.5 rounded cursor-move transition-colors
                ${isSelected ? 'ring-1 ring-accent' : ''}
                ${bgm.isMuted ? 'opacity-40' : ''}`}
              style={{
                left: Math.max(0, bgmLeft),
                width: bgmWidth,
                background: 'rgba(233, 69, 96, 0.15)',
              }}
              onMouseDown={(e) => handleBgmMouseDown(e, bgm.id)}
            >
              {/* BGM waveform */}
              {bgm.waveform && (
                <WaveformCanvas
                  waveform={bgm.waveform}
                  width={Math.max(bgmWidth, 1)}
                  height={30}
                  color="#e94560"
                />
              )}
              {/* BGM label */}
              <div className="absolute top-0.5 left-1 text-[9px] text-accent/80 truncate pointer-events-none max-w-[120px]">
                🎵 {bgm.name}
              </div>
              {/* Time info */}
              <div className="absolute bottom-0 right-1 text-[8px] text-text-secondary/50 pointer-events-none">
                {formatTime(bgm.startOffset)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { WaveformCanvas } from './WaveformCanvas';
