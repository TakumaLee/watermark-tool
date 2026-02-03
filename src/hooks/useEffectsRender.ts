import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../stores/videoStore';
import { useWatermarkStore } from '../stores/watermarkStore';
import { useTextStore } from '../stores/textStore';
import { useAudioStore } from '../stores/audioStore';
import { useEffectsStore } from '../stores/effectsStore';
import type {
  PiPRenderConfig,
} from '../types';
import type { TextOverlayItem } from '../types/text';

export function useEffectsRender() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pollRef = useRef<number | null>(null);

  const exportWithEffects = useCallback(async () => {
    const { videoPath, videoInfo } = useVideoStore.getState();
    if (!videoPath || !videoInfo) return;

    const outputPath = await save({
      title: '輸出影片（含效果）',
      defaultPath: 'output_effects.mp4',
      filters: [{ name: '影片', extensions: ['mp4', 'mov'] }],
    });
    if (!outputPath) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Gather all configs
      const watermarks = useWatermarkStore.getState().watermarks.map((wm) => ({
        image_path: wm.filePath,
        x: wm.x,
        y: wm.y,
        width: wm.width,
        height: wm.height,
        opacity: wm.opacity / 100,
        movement: wm.movement,
      }));

      const { textItems, subtitles, subtitleStyle, subtitlesEnabled } = useTextStore.getState();
      const texts = textItems.map((t: TextOverlayItem) => ({
        content: t.content,
        font_family: t.fontFamily,
        font_size: t.fontSize,
        color: t.color,
        stroke_color: t.strokeColor,
        stroke_width: t.strokeWidth,
        bg_color: t.bgColor,
        bg_opacity: t.bgOpacity,
        x: t.x,
        y: t.y,
        width: t.width,
        align: t.align,
        start_time: t.startTime,
        end_time: t.endTime,
      }));

      const subtitle = subtitlesEnabled && subtitles.length > 0 ? {
        entries: subtitles.map((s) => ({
          index: s.index,
          start_time: s.startTime,
          end_time: s.endTime,
          text: s.text,
        })),
        style: {
          font_family: subtitleStyle.fontFamily,
          font_size: subtitleStyle.fontSize,
          color: subtitleStyle.color,
          stroke_color: subtitleStyle.strokeColor,
          stroke_width: subtitleStyle.strokeWidth,
          vertical_position: subtitleStyle.positionY,
        },
      } : null;

      // Audio config
      const audioState = useAudioStore.getState();
      const audio = {
        main_volume: audioState.mainVolume / 100,
        main_muted: audioState.mainMuted,
        fade_in: audioState.mainFade.fadeInDuration,
        fade_out: audioState.mainFade.fadeOutDuration,
        bgm_items: audioState.bgmItems.map((b) => ({
          file_path: b.filePath,
          volume: b.volume / 100,
          muted: b.isMuted,
          start_offset: b.startOffset,
          trim_start: b.trimStart,
          trim_end: b.trimEnd,
          fade_in: b.fadeIn,
          fade_out: b.fadeOut,
        })),
        clip_volumes: [],
      };

      // Effects config
      const effectsState = useEffectsStore.getState();
      const effects = {
        filters: {
          brightness: effectsState.filters.brightness,
          contrast: effectsState.filters.contrast,
          saturation: effectsState.filters.saturation,
        },
        speed: effectsState.speed,
        reverse: effectsState.reverse,
        pip: effectsState.pipLayers.map((p): PiPRenderConfig => ({
          sourcePath: p.sourcePath,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        transform: {
          rotation: effectsState.transform.rotation,
          flip: effectsState.transform.flip,
          crop: effectsState.transform.crop,
        },
      };

      const processId: string = await invoke('render_with_effects', {
        input: videoPath,
        output: outputPath,
        watermarks,
        texts,
        subtitle,
        audio,
        effects,
        quality: 'high',
      });

      // Poll progress
      pollRef.current = window.setInterval(async () => {
        try {
          const p: number = await invoke('get_render_progress', { processId });
          setProgress(p);
          if (p >= 1.0) {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsProcessing(false);
          }
        } catch {
          // Ignore polling errors
        }
      }, 500);
    } catch (err) {
      console.error('Effects render failed:', err);
      setIsProcessing(false);
    }
  }, []);

  return { exportWithEffects, isProcessing, progress };
}
