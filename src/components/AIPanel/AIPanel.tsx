import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAIStore } from '../../stores/aiStore';
import { useVideoStore } from '../../stores/videoStore';
import { useTextStore } from '../../stores/textStore';
import { useTimelineStore } from '../../stores/timelineStore';
import type {
  WhisperResultEntry,
  SceneChangePoint,
  SilenceSegment,
  EditSuggestion,
  SubtitleEntry,
} from '../../types';
import {
  WHISPER_LANGUAGES,
  WHISPER_MODELS,
} from '../../types';

export function AIPanel() {
  const [activeTab, setActiveTab] = useState<'subtitle' | 'scene' | 'chromakey' | 'enhance' | 'silence'>('subtitle');

  const tabs = [
    { id: 'subtitle' as const, label: '🎤 字幕', title: 'AI 自動字幕' },
    { id: 'scene' as const, label: '🎬 場景', title: '場景偵測' },
    { id: 'chromakey' as const, label: '🟩 去背', title: '背景移除' },
    { id: 'enhance' as const, label: '✨ 畫質', title: '畫質提升' },
    { id: 'silence' as const, label: '🔇 靜音', title: '靜音偵測' },
  ];

  return (
    <div className="w-72 flex-shrink-0 bg-bg-secondary border-l border-border overflow-y-auto">
      {/* Tab Bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-1 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent bg-bg-primary/50'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            title={tab.title}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === 'subtitle' && <WhisperPanel />}
        {activeTab === 'scene' && <SceneDetectPanel />}
        {activeTab === 'chromakey' && <ChromakeyPanel />}
        {activeTab === 'enhance' && <EnhancementPanel />}
        {activeTab === 'silence' && <SilenceDetectPanel />}
      </div>
    </div>
  );
}

// ============================================================
// Whisper Auto-Subtitle Panel
// ============================================================
function WhisperPanel() {
  const video = useVideoStore((s) => s.videoInfo);
  const videoPath = useVideoStore((s) => s.filePath);
  const {
    whisperConfig,
    whisperState,
    whisperResults,
    whisperAvailable,
    setWhisperConfig,
    setWhisperState,
    setWhisperResults,
    setWhisperAvailable,
    clearWhisperResults,
  } = useAIStore();
  const { setSubtitles } = useTextStore();

  // Check whisper availability on mount
  useEffect(() => {
    if (whisperAvailable === null) {
      invoke<boolean>('check_whisper_available')
        .then((available) => setWhisperAvailable(available))
        .catch(() => setWhisperAvailable(false));
    }
  }, [whisperAvailable, setWhisperAvailable]);

  const handleTranscribe = async () => {
    if (!videoPath) return;

    setWhisperState({ status: 'running', progress: 0, progressText: '準備中...', error: null });

    try {
      setWhisperState({ progressText: '正在轉錄語音...' });

      const entries = await invoke<WhisperResultEntry[]>('whisper_transcribe', {
        input: videoPath,
        language: whisperConfig.language,
        model: whisperConfig.model,
      });

      setWhisperResults(entries);
      setWhisperState({ status: 'complete', progress: 100, progressText: `完成！辨識到 ${entries.length} 段字幕` });
    } catch (err) {
      setWhisperState({ status: 'error', progress: 0, progressText: '', error: String(err) });
    }
  };

  const handleLoadToSubtitles = () => {
    // Convert whisper results to SubtitleEntry[]
    const subtitles: SubtitleEntry[] = whisperResults.map((r) => ({
      index: r.index,
      startTime: r.startTime,
      endTime: r.endTime,
      text: r.text,
    }));
    setSubtitles(subtitles);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">🎤 AI 自動字幕</h3>

      {whisperAvailable === false && (
        <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-300">
          ⚠️ 未偵測到 Whisper。請先安裝：
          <code className="block mt-1 text-yellow-200">pip install openai-whisper</code>
        </div>
      )}

      {whisperAvailable === null && (
        <div className="text-xs text-text-secondary">檢查 Whisper 中...</div>
      )}

      {/* Language selection */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">語言</label>
        <select
          value={whisperConfig.language}
          onChange={(e) => setWhisperConfig({ language: e.target.value as any })}
          className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary"
        >
          {WHISPER_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Model selection */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">模型</label>
        <select
          value={whisperConfig.model}
          onChange={(e) => setWhisperConfig({ model: e.target.value as any })}
          className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary"
        >
          {WHISPER_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} — {m.description}
            </option>
          ))}
        </select>
      </div>

      {/* Run button */}
      <button
        onClick={handleTranscribe}
        disabled={!videoPath || !whisperAvailable || whisperState.status === 'running'}
        className="w-full px-3 py-2 bg-accent hover:bg-accent/80 disabled:bg-bg-component disabled:text-text-secondary text-white text-xs rounded transition-colors"
      >
        {whisperState.status === 'running' ? '🔄 轉錄中...' : '🎤 開始語音辨識'}
      </button>

      {/* Progress */}
      {whisperState.status === 'running' && (
        <div className="text-xs text-text-secondary">
          {whisperState.progressText}
        </div>
      )}

      {/* Error */}
      {whisperState.status === 'error' && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
          ❌ {whisperState.error}
        </div>
      )}

      {/* Results */}
      {whisperResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              辨識到 {whisperResults.length} 段字幕
            </span>
            <button
              onClick={clearWhisperResults}
              className="text-xs text-text-secondary hover:text-accent"
            >
              清除
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {whisperResults.map((entry) => (
              <div
                key={entry.index}
                className="p-1.5 bg-bg-primary rounded text-xs"
              >
                <span className="text-text-secondary">
                  {formatTime(entry.startTime)} → {formatTime(entry.endTime)}
                </span>
                <div className="text-text-primary mt-0.5">{entry.text}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleLoadToSubtitles}
            className="w-full px-3 py-1.5 bg-bg-component hover:bg-border text-text-primary text-xs rounded transition-colors"
          >
            📝 載入為字幕
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Scene Detection Panel
// ============================================================
function SceneDetectPanel() {
  const videoPath = useVideoStore((s) => s.filePath);
  const {
    sceneDetectConfig,
    sceneDetectState,
    sceneChangePoints,
    setSceneDetectConfig,
    setSceneDetectState,
    setSceneChangePoints,
    clearSceneChangePoints,
  } = useAIStore();
  const { splitAtTime } = useTimelineStore();

  const handleDetect = async () => {
    if (!videoPath) return;

    setSceneDetectState({ status: 'running', progress: 0, error: null });

    try {
      const points = await invoke<SceneChangePoint[]>('detect_scenes', {
        input: videoPath,
        threshold: sceneDetectConfig.threshold,
      });

      setSceneChangePoints(points);
      setSceneDetectState({ status: 'complete', progress: 100 });
    } catch (err) {
      setSceneDetectState({ status: 'error', error: String(err) });
    }
  };

  const handleSplitAtPoints = () => {
    // Split at all detected scene change points
    for (const point of sceneChangePoints) {
      splitAtTime(point.timestamp);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">🎬 場景偵測</h3>

      {/* Threshold slider */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          靈敏度: {sceneDetectConfig.threshold.toFixed(1)}
        </label>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.1"
          value={sceneDetectConfig.threshold}
          onChange={(e) =>
            setSceneDetectConfig({ threshold: parseFloat(e.target.value) })
          }
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-secondary">
          <span>高靈敏</span>
          <span>低靈敏</span>
        </div>
      </div>

      <button
        onClick={handleDetect}
        disabled={!videoPath || sceneDetectState.status === 'running'}
        className="w-full px-3 py-2 bg-accent hover:bg-accent/80 disabled:bg-bg-component disabled:text-text-secondary text-white text-xs rounded transition-colors"
      >
        {sceneDetectState.status === 'running' ? '🔄 偵測中...' : '🎬 開始場景偵測'}
      </button>

      {sceneDetectState.status === 'error' && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
          ❌ {sceneDetectState.error}
        </div>
      )}

      {sceneChangePoints.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              偵測到 {sceneChangePoints.length} 個場景切換點
            </span>
            <button
              onClick={clearSceneChangePoints}
              className="text-xs text-text-secondary hover:text-accent"
            >
              清除
            </button>
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {sceneChangePoints.map((point, i) => (
              <div
                key={i}
                className="px-2 py-1 bg-bg-primary rounded text-xs text-text-primary flex justify-between"
              >
                <span>🔹 {formatTime(point.timestamp)}</span>
                <span className="text-text-secondary">score: {point.score.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSplitAtPoints}
            className="w-full px-3 py-1.5 bg-bg-component hover:bg-border text-text-primary text-xs rounded transition-colors"
          >
            ✂️ 在切換點自動分割
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Chromakey (Background Removal) Panel
// ============================================================
function ChromakeyPanel() {
  const {
    chromakeyConfig,
    chromakeyState,
    setChromakeyConfig,
    setChromakeyEnabled,
  } = useAIStore();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">🟩 背景移除</h3>
      <p className="text-[10px] text-text-secondary">
        使用 FFmpeg chromakey 濾鏡移除指定顏色的背景（綠幕/藍幕等）
      </p>

      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-primary">啟用背景移除</span>
        <button
          onClick={() => setChromakeyEnabled(!chromakeyState.enabled)}
          className={`w-10 h-5 rounded-full transition-colors ${
            chromakeyState.enabled ? 'bg-accent' : 'bg-bg-component'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
              chromakeyState.enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Color picker */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">背景色</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={chromakeyConfig.color}
            onChange={(e) => setChromakeyConfig({ color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
          <input
            type="text"
            value={chromakeyConfig.color}
            onChange={(e) => setChromakeyConfig({ color: e.target.value })}
            className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary font-mono"
          />
        </div>
        {/* Quick presets */}
        <div className="flex gap-1 mt-1">
          {[
            { color: '#00ff00', label: '綠' },
            { color: '#0000ff', label: '藍' },
            { color: '#ffffff', label: '白' },
            { color: '#000000', label: '黑' },
          ].map((preset) => (
            <button
              key={preset.color}
              onClick={() => setChromakeyConfig({ color: preset.color })}
              className="px-2 py-0.5 text-[10px] bg-bg-primary border border-border rounded hover:border-accent transition-colors"
              style={{ borderColor: chromakeyConfig.color === preset.color ? undefined : undefined }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: preset.color }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Similarity slider */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          容差 (similarity): {chromakeyConfig.similarity.toFixed(2)}
        </label>
        <input
          type="range"
          min="0.01"
          max="1"
          step="0.01"
          value={chromakeyConfig.similarity}
          onChange={(e) =>
            setChromakeyConfig({ similarity: parseFloat(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </div>

      {/* Blend slider */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          混合 (blend): {chromakeyConfig.blend.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={chromakeyConfig.blend}
          onChange={(e) =>
            setChromakeyConfig({ blend: parseFloat(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </div>
    </div>
  );
}

// ============================================================
// Quality Enhancement Panel
// ============================================================
function EnhancementPanel() {
  const videoPath = useVideoStore((s) => s.filePath);
  const {
    enhancementConfig,
    enhancementState,
    setEnhancementConfig,
    setSharpenEnabled,
    setDenoiseEnabled,
    setUpscaleEnabled,
    resetEnhancement,
  } = useAIStore();

  const handleRender = async () => {
    if (!videoPath) return;

    // Build enhancement config for Rust
    const enhancement: any = {
      sharpen: enhancementConfig.sharpen.enabled
        ? {
            luma_x: enhancementConfig.sharpen.lumaX,
            luma_y: enhancementConfig.sharpen.lumaY,
            luma_amount: enhancementConfig.sharpen.lumaAmount,
          }
        : null,
      denoise: enhancementConfig.denoise.enabled
        ? {
            strength: enhancementConfig.denoise.strength,
            filter_type: enhancementConfig.denoise.filterType,
          }
        : null,
      upscale: enhancementConfig.upscale.enabled
        ? { scale_factor: enhancementConfig.upscale.scaleFactor }
        : null,
    };

    try {
      const processId = await invoke<string>('render_with_enhancement', {
        input: videoPath,
        output: videoPath.replace(/\.[^.]+$/, '_enhanced.mp4'),
        enhancement,
        chromakey: null,
        quality: 'high',
      });
      // Process ID can be used for progress tracking
    } catch (err) {
      console.error('Enhancement render failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">✨ 畫質提升</h3>
        <button
          onClick={resetEnhancement}
          className="text-[10px] text-text-secondary hover:text-accent"
        >
          重置
        </button>
      </div>

      {/* Sharpen */}
      <div className="p-2 bg-bg-primary rounded space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-primary">🔪 銳化 (Unsharp)</span>
          <button
            onClick={() => setSharpenEnabled(!enhancementConfig.sharpen.enabled)}
            className={`w-10 h-5 rounded-full transition-colors ${
              enhancementConfig.sharpen.enabled ? 'bg-accent' : 'bg-bg-component'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                enhancementConfig.sharpen.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {enhancementConfig.sharpen.enabled && (
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">
              強度: {enhancementConfig.sharpen.lumaAmount.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={enhancementConfig.sharpen.lumaAmount}
              onChange={(e) =>
                setEnhancementConfig({
                  sharpen: {
                    ...enhancementConfig.sharpen,
                    lumaAmount: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-accent"
            />
          </div>
        )}
      </div>

      {/* Denoise */}
      <div className="p-2 bg-bg-primary rounded space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-primary">🔇 降噪</span>
          <button
            onClick={() => setDenoiseEnabled(!enhancementConfig.denoise.enabled)}
            className={`w-10 h-5 rounded-full transition-colors ${
              enhancementConfig.denoise.enabled ? 'bg-accent' : 'bg-bg-component'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                enhancementConfig.denoise.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {enhancementConfig.denoise.enabled && (
          <>
            <div className="flex gap-1">
              {(['hqdn3d', 'nlmeans'] as const).map((type_) => (
                <button
                  key={type_}
                  onClick={() =>
                    setEnhancementConfig({
                      denoise: { ...enhancementConfig.denoise, filterType: type_ },
                    })
                  }
                  className={`flex-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                    enhancementConfig.denoise.filterType === type_
                      ? 'bg-accent text-white'
                      : 'bg-bg-component text-text-secondary'
                  }`}
                >
                  {type_ === 'hqdn3d' ? 'HQDN3D (快)' : 'NLMeans (精)'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">
                強度: {enhancementConfig.denoise.strength}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={enhancementConfig.denoise.strength}
                onChange={(e) =>
                  setEnhancementConfig({
                    denoise: {
                      ...enhancementConfig.denoise,
                      strength: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-accent"
              />
            </div>
          </>
        )}
      </div>

      {/* Upscale */}
      <div className="p-2 bg-bg-primary rounded space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-primary">🔍 超解析度</span>
          <button
            onClick={() => setUpscaleEnabled(!enhancementConfig.upscale.enabled)}
            className={`w-10 h-5 rounded-full transition-colors ${
              enhancementConfig.upscale.enabled ? 'bg-accent' : 'bg-bg-component'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                enhancementConfig.upscale.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {enhancementConfig.upscale.enabled && (
          <div className="flex gap-1">
            {[1.5, 2, 4].map((factor) => (
              <button
                key={factor}
                onClick={() =>
                  setEnhancementConfig({
                    upscale: { ...enhancementConfig.upscale, scaleFactor: factor },
                  })
                }
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  enhancementConfig.upscale.scaleFactor === factor
                    ? 'bg-accent text-white'
                    : 'bg-bg-component text-text-secondary hover:text-text-primary'
                }`}
              >
                {factor}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview info */}
      <div className="text-[10px] text-text-secondary">
        💡 這些效果使用 FFmpeg 內建濾鏡，不需要額外 AI 模型。
        輸出時會自動套用已啟用的濾鏡。
      </div>
    </div>
  );
}

// ============================================================
// Silence Detection / Auto-Edit Panel
// ============================================================
function SilenceDetectPanel() {
  const videoPath = useVideoStore((s) => s.filePath);
  const {
    silenceDetectConfig,
    silenceDetectState,
    silenceSegments,
    editSuggestions,
    setSilenceDetectConfig,
    setSilenceDetectState,
    setSilenceSegments,
    setEditSuggestions,
    clearSilenceResults,
  } = useAIStore();
  const { splitAtTime, deleteClip } = useTimelineStore();

  const handleDetect = async () => {
    if (!videoPath) return;

    setSilenceDetectState({ status: 'running', progress: 0, error: null });

    try {
      const segments = await invoke<SilenceSegment[]>('detect_silence', {
        input: videoPath,
        noiseDb: silenceDetectConfig.noiseThresholdDb,
        minDuration: silenceDetectConfig.minDurationSec,
      });

      setSilenceSegments(segments);

      // Generate edit suggestions
      const suggestions: EditSuggestion[] = segments.map((seg) => ({
        type: 'remove_silence' as const,
        startTime: seg.startTime,
        endTime: seg.endTime,
        description: `靜音 ${seg.duration.toFixed(1)}s（${formatTime(seg.startTime)} → ${formatTime(seg.endTime)}）`,
      }));

      setEditSuggestions(suggestions);
      setSilenceDetectState({ status: 'complete', progress: 100 });
    } catch (err) {
      setSilenceDetectState({ status: 'error', error: String(err) });
    }
  };

  const handleApplySuggestion = (suggestion: EditSuggestion) => {
    // Split at start and end of silence, then the user can delete the middle
    splitAtTime(suggestion.startTime);
    splitAtTime(suggestion.endTime);
  };

  const handleApplyAll = () => {
    // Apply all suggestions by splitting at silence boundaries
    for (const suggestion of editSuggestions) {
      splitAtTime(suggestion.startTime);
      splitAtTime(suggestion.endTime);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">🔇 自動剪輯建議</h3>
      <p className="text-[10px] text-text-secondary">
        偵測影片中的靜音片段，建議裁切點
      </p>

      {/* Noise threshold */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          靜音門檻: {silenceDetectConfig.noiseThresholdDb} dB
        </label>
        <input
          type="range"
          min="-60"
          max="-10"
          step="1"
          value={silenceDetectConfig.noiseThresholdDb}
          onChange={(e) =>
            setSilenceDetectConfig({ noiseThresholdDb: parseInt(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </div>

      {/* Min duration */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          最短靜音: {silenceDetectConfig.minDurationSec}s
        </label>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={silenceDetectConfig.minDurationSec}
          onChange={(e) =>
            setSilenceDetectConfig({ minDurationSec: parseFloat(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </div>

      <button
        onClick={handleDetect}
        disabled={!videoPath || silenceDetectState.status === 'running'}
        className="w-full px-3 py-2 bg-accent hover:bg-accent/80 disabled:bg-bg-component disabled:text-text-secondary text-white text-xs rounded transition-colors"
      >
        {silenceDetectState.status === 'running' ? '🔄 偵測中...' : '🔇 開始靜音偵測'}
      </button>

      {silenceDetectState.status === 'error' && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
          ❌ {silenceDetectState.error}
        </div>
      )}

      {editSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              找到 {editSuggestions.length} 段靜音
            </span>
            <button
              onClick={clearSilenceResults}
              className="text-xs text-text-secondary hover:text-accent"
            >
              清除
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {editSuggestions.map((suggestion, i) => (
              <div
                key={i}
                className="p-1.5 bg-bg-primary rounded text-xs flex items-center justify-between"
              >
                <span className="text-text-primary">{suggestion.description}</span>
                <button
                  onClick={() => handleApplySuggestion(suggestion)}
                  className="text-accent hover:text-accent/80 ml-2 flex-shrink-0"
                  title="在此位置分割"
                >
                  ✂️
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleApplyAll}
            className="w-full px-3 py-1.5 bg-bg-component hover:bg-border text-text-primary text-xs rounded transition-colors"
          >
            ✂️ 全部分割
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export default AIPanel;
