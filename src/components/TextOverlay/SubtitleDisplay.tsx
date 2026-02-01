import type { SubtitleEntry, SubtitleStyle } from '../../types/text';

interface Props {
  subtitles: SubtitleEntry[];
  style: SubtitleStyle;
  currentTime: number;
  videoRect: { left: number; top: number; width: number; height: number };
  enabled: boolean;
}

/**
 * Renders the currently active subtitle on the video overlay.
 * Finds the subtitle that matches the current time and displays it.
 */
export function SubtitleDisplay({ subtitles, style, currentTime, videoRect, enabled }: Props) {
  if (!enabled || subtitles.length === 0) return null;

  // Find the active subtitle for the current time
  const activeSub = subtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (!activeSub) return null;

  const scaledFontSize = (style.fontSize / 1080) * videoRect.height;
  const posY = style.positionY * videoRect.height;

  const bgColorWithAlpha = style.bgOpacity > 0
    ? `${style.bgColor}${Math.round(style.bgOpacity * 2.55).toString(16).padStart(2, '0')}`
    : 'transparent';

  return (
    <div
      className="absolute left-0 right-0 flex justify-center pointer-events-none"
      style={{
        top: `${posY}px`,
      }}
    >
      <div
        className="whitespace-pre-wrap text-center max-w-[90%]"
        style={{
          fontFamily: style.fontFamily,
          fontSize: `${scaledFontSize}px`,
          color: style.color,
          WebkitTextStroke: style.strokeWidth > 0
            ? `${(style.strokeWidth / 1080) * videoRect.height}px ${style.strokeColor}`
            : undefined,
          backgroundColor: bgColorWithAlpha,
          padding: '4px 12px',
          borderRadius: '4px',
          lineHeight: 1.3,
          textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        {activeSub.text}
      </div>
    </div>
  );
}
