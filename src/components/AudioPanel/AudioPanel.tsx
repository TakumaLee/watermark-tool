import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useAudioStore, generateBgmId } from '../../stores/audioStore';
import { useVideoStore } from '../../stores/videoStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { useModuleStore } from '../../stores/moduleStore';
import type { BGMItem } from '../../types';
import { DEFAULT_BGM, SUPPORTED_AUDIO_EXTENSIONS } from '../../types';
import { BGMCard } from './BGMCard';

export function AudioPanel() {
  const { videoPath } = useVideoStore();
  const isTrimEnabled = useModuleStore((s) => s.isEnabled('trim'));
  const clips = useTimelineStore((s) => s.clips);

  const {
    mainVolume,
    mainMuted,
    mainFade,
    mainWaveform,
    bgmItems,
    clipVolumes,
    setMainVolume,
    toggleMainMute,
    setMainFade,
    setMainWaveform,
    addBgm,
    removeBgm,
    updateBgm,
    setBgmWaveform,
    setClipVolume,
    toggleClipMute,
    clearAll,
  } = useAudioStore();

  // Extract waveform from video
  const extractMainWaveform = useCallback(async () => {
    if (!videoPath) return;
    try {
      const result = await invoke<{ peaks: number[]; sample_rate: number; duration: number }>(
        'extract_audio_waveform',
        { path: videoPath, numPeaks: 800 }
      );
      setMainWaveform({
        peaks: result.peaks,
        sampleRate: result.sample_rate,
        duration: result.duration,
      });
    } catch (err) {
      console.error('Failed to extract waveform:', err);
    }
  }, [videoPath, setMainWaveform]);

  // Import BGM
  const importBgm = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: '音訊檔案',
            extensions: [...SUPPORTED_AUDIO_EXTENSIONS],
          },
        ],
      });
      if (!selected) return;

      const filePath = selected as string;
      const fileName = filePath.split('/').pop()?.split('\\').pop() ?? 'BGM';

      // Probe duration
      const duration = await invoke<number>('probe_audio_duration', { path: filePath });

      const id = generateBgmId();
      const bgm: BGMItem = {
        id,
        filePath,
        name: fileName,
        duration,
        ...DEFAULT_BGM,
        waveform: null,
      };

      addBgm(bgm);

      // Extract waveform for the BGM
      try {
        const waveformResult = await invoke<{ peaks: number[]; sample_rate: number; duration: number }>(
          'extract_audio_waveform',
          { path: filePath, numPeaks: 400 }
        );
        setBgmWaveform(id, {
          peaks: waveformResult.peaks,
          sampleRate: waveformResult.sample_rate,
          duration: waveformResult.duration,
        });
      } catch (err) {
        console.error('Failed to extract BGM waveform:', err);
      }
    } catch (err) {
      console.error('Failed to import BGM:', err);
    }
  }, [addBgm, setBgmWaveform]);

  return (
    <div className="w-[320px] flex-shrink-0 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">🎵 音訊處理</h2>
        {(bgmItems.length > 0 || mainWaveform) && (
          <button
            onClick={clearAll}
            className="text-[10px] text-text-secondary hover:text-error transition-colors"
            title="重置音訊設定"
          >
            重置 🗑
          </button>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
            {/* Waveform extraction — requires a loaded video */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">音訊波形</span>
                <button
                  onClick={extractMainWaveform}
                  disabled={!videoPath}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors
                             disabled:opacity-30 disabled:cursor-not-allowed"
                  title={!videoPath ? '請先匯入影片' : undefined}
                >
                  {mainWaveform ? '重新提取' : '提取波形'}
                </button>
              </div>
              {mainWaveform && (
                <div className="text-[10px] text-text-secondary/60">
                  ✅ 波形已載入（{mainWaveform.peaks.length} peaks）
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* Main volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">主音量</span>
                <button
                  onClick={toggleMainMute}
                  className={`text-sm transition-colors ${
                    mainMuted ? 'text-error' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title={mainMuted ? '取消靜音' : '靜音'}
                >
                  {mainMuted ? '🔇' : '🔊'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={mainVolume}
                  onChange={(e) => setMainVolume(Number(e.target.value))}
                  className="flex-1 accent-accent h-1"
                  disabled={mainMuted}
                />
                <span className="text-[11px] text-text-secondary w-10 text-right font-mono">
                  {mainVolume}%
                </span>
              </div>
            </div>

            {/* Fade in/out */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">淡入淡出</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary/70">淡入 (秒)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={mainFade.fadeInDuration}
                    onChange={(e) => setMainFade({ fadeInDuration: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                               focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary/70">淡出 (秒)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={mainFade.fadeOutDuration}
                    onChange={(e) => setMainFade({ fadeOutDuration: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                               focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Per-clip volume (only when trim module is active) */}
            {isTrimEnabled && clips.length > 1 && (
              <>
                <div className="border-t border-border/50" />
                <div className="space-y-2">
                  <span className="text-xs font-medium text-text-secondary">片段音量</span>
                  <div className="space-y-1.5">
                    {clips.map((clip) => {
                      const override = clipVolumes.find((cv) => cv.clipId === clip.id);
                      const volume = override?.volume ?? 100;
                      const isMuted = override?.isMuted ?? false;

                      return (
                        <div key={clip.id} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleClipMute(clip.id)}
                            className={`text-[10px] flex-shrink-0 ${
                              isMuted ? 'text-error' : 'text-text-secondary'
                            }`}
                            title={isMuted ? '取消靜音' : '靜音'}
                          >
                            {isMuted ? '🔇' : '🔊'}
                          </button>
                          <span className="text-[10px] text-text-secondary truncate w-16 flex-shrink-0">
                            {clip.name}
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={volume}
                            onChange={(e) => setClipVolume(clip.id, Number(e.target.value))}
                            className="flex-1 accent-accent h-0.5"
                            disabled={isMuted}
                          />
                          <span className="text-[9px] text-text-secondary/60 w-7 text-right font-mono">
                            {volume}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* BGM section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">背景音樂 (BGM)</span>
                <span className="text-[10px] text-text-secondary/50">{bgmItems.length}</span>
              </div>

              <button
                onClick={importBgm}
                className="w-full py-2 border border-dashed border-border rounded-lg
                           text-text-secondary text-xs hover:border-accent hover:text-accent
                           transition-colors duration-150"
              >
                + 匯入 BGM
              </button>

              {bgmItems.length > 0 && (
                <div className="space-y-2">
                  {bgmItems.map((bgm) => (
                    <BGMCard
                      key={bgm.id}
                      bgm={bgm}
                      onUpdate={(updates) => updateBgm(bgm.id, updates)}
                      onRemove={() => removeBgm(bgm.id)}
                    />
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
