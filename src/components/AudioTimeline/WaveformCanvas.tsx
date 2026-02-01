import { useRef, useEffect, useCallback } from 'react';
import type { WaveformData } from '../../types';

interface WaveformCanvasProps {
  /** Waveform data to render */
  waveform: WaveformData | null;
  /** Width of the canvas in pixels */
  width: number;
  /** Height of the canvas in pixels */
  height: number;
  /** Color of the waveform bars */
  color?: string;
  /** Background color */
  bgColor?: string;
  /** Playhead position ratio (0-1) */
  playheadRatio?: number;
  /** Whether to show playhead */
  showPlayhead?: boolean;
  /** Optional className */
  className?: string;
}

export function WaveformCanvas({
  waveform,
  width,
  height,
  color = '#e94560',
  bgColor = 'transparent',
  playheadRatio = 0,
  showPlayhead = false,
  className = '',
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    if (!waveform || waveform.peaks.length === 0) {
      // Draw placeholder line
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const peaks = waveform.peaks;
    const barWidth = Math.max(1, width / peaks.length);
    const centerY = height / 2;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;

    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * width;
      const peakHeight = peaks[i] * centerY * 0.9;

      // Draw symmetrical bar (top + bottom from center)
      ctx.fillRect(
        x,
        centerY - peakHeight,
        Math.max(1, barWidth - 0.5),
        peakHeight * 2 || 1
      );
    }

    ctx.globalAlpha = 1;

    // Draw playhead
    if (showPlayhead && playheadRatio >= 0 && playheadRatio <= 1) {
      const playheadX = playheadRatio * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveform, width, height, color, bgColor, playheadRatio, showPlayhead]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block' }}
    />
  );
}
