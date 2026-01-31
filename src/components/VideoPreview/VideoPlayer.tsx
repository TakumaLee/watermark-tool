import { useRef, useState, useCallback, useEffect } from 'react';
import { useVideoStore } from '../../stores/videoStore';
import { formatTime } from '../../utils/formatTime';
import { getAspectRatioLabel } from '../../utils/aspectRatio';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { videoUrl, videoInfo } = useVideoStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Sync play state
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  // Keyboard: space to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  // Seek via progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar) return;

      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = ratio * video.duration;
    },
    [],
  );

  // Seek via drag on progress bar
  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsSeeking(true);
      handleProgressClick(e);

      const handleMouseMove = (me: MouseEvent) => {
        const video = videoRef.current;
        const bar = progressRef.current;
        if (!video || !bar) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
      };

      const handleMouseUp = () => {
        setIsSeeking(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleProgressClick],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const aspectLabel = videoInfo ? getAspectRatioLabel(videoInfo.width, videoInfo.height) : '';

  return (
    <div className="flex flex-col h-full">
      {/* Video container: fills available space */}
      <div className="flex-1 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden min-h-0">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          className="max-w-full max-h-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (!isSeeking && videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          playsInline
        />
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 mt-3 px-1">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center text-text-primary
                     hover:text-accent transition-colors duration-150 text-lg flex-shrink-0"
          title={isPlaying ? '暫停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Progress bar */}
        <div
          ref={progressRef}
          className="flex-1 h-5 flex items-center cursor-pointer group"
          onMouseDown={handleProgressMouseDown}
        >
          <div className="w-full h-1 bg-border rounded-full relative group-hover:h-1.5 transition-all">
            <div
              className="absolute left-0 top-0 h-full bg-accent rounded-full transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full
                         opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Time display */}
        <span className="text-xs text-text-secondary font-mono whitespace-nowrap flex-shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Aspect ratio badge */}
        {aspectLabel && (
          <span className="text-xs text-text-secondary bg-bg-component px-2 py-0.5 rounded flex-shrink-0">
            {aspectLabel}
          </span>
        )}
      </div>
    </div>
  );
}
