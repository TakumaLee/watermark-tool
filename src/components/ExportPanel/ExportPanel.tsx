import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { useExportStore, generateTaskId } from '../../stores/exportStore';
import type {
  ExportTask,
  GifExportConfig,
  ThumbnailExportConfig,
} from '../../types';
import { PLATFORM_PRESETS, GIF_FPS_OPTIONS } from '../../types';

export function ExportPanel() {
  const { videoPath, videoInfo } = useVideoStore();
  const {
    selectedPlatformId,
    aspectMode,
    customWidth,
    customHeight,
    customFormat,
    customQuality,
    gifSettings,
    thumbnailTime,
    thumbnailFormat,
    thumbnailPreview,
    selectPlatform,
    setAspectMode,
    setCustomWidth,
    setCustomHeight,
    setCustomFormat,
    setCustomQuality,
    setGifSettings,
    setThumbnailTime,
    setThumbnailFormat,
    setThumbnailPreview,
    addTask,
    addBatchTasks,
    getActivePreset,
  } = useExportStore();

  const [estimatedGifSize, setEstimatedGifSize] = useState<number | null>(null);
  const [isExtractingThumb, setIsExtractingThumb] = useState(false);
  const [activeTab, setActiveTab] = useState<'platform' | 'gif' | 'thumbnail'>('platform');

  const hasVideo = !!videoPath && !!videoInfo;

  // Estimate GIF size
  const estimateGif = useCallback(async () => {
    if (!videoPath) return;
    try {
      const size: number = await invoke('estimate_gif_file_size', {
        input: videoPath,
        config: {
          width: gifSettings.width,
          fps: gifSettings.fps,
          colors: gifSettings.colors,
          start_time: gifSettings.startTime,
          end_time: gifSettings.endTime,
        } satisfies GifExportConfig,
      });
      setEstimatedGifSize(size);
    } catch (err) {
      console.error('Failed to estimate GIF size:', err);
    }
  }, [videoPath, gifSettings]);

  // Add single platform export to queue
  const addPlatformExport = useCallback(async () => {
    if (!videoPath) return;

    const preset = getActivePreset();
    const platformPreset = PLATFORM_PRESETS.find((p) => p.id === selectedPlatformId);

    const ext = preset.format === 'mov' ? 'mov' : 'mp4';
    const defaultName = `output_${selectedPlatformId}.${ext}`;

    const outputPath = await save({
      title: `輸出 ${platformPreset?.name ?? '影片'}`,
      defaultPath: defaultName,
      filters: [{ name: '影片', extensions: [ext] }],
    });
    if (!outputPath) return;

    const task: ExportTask = {
      id: generateTaskId(),
      platformId: selectedPlatformId,
      platformName: platformPreset?.name ?? '自定義',
      platformIcon: platformPreset?.icon ?? '⚙️',
      outputPath,
      width: preset.width,
      height: preset.height,
      aspectMode,
      quality: preset.quality,
      format: preset.format,
      status: 'pending',
      progress: 0,
    };

    addTask(task);
  }, [videoPath, selectedPlatformId, aspectMode, getActivePreset, addTask]);

  // Add GIF export to queue
  const addGifExport = useCallback(async () => {
    if (!videoPath) return;

    const outputPath = await save({
      title: '輸出 GIF',
      defaultPath: 'output.gif',
      filters: [{ name: 'GIF', extensions: ['gif'] }],
    });
    if (!outputPath) return;

    const task: ExportTask = {
      id: generateTaskId(),
      platformId: 'gif',
      platformName: 'GIF',
      platformIcon: '🎞️',
      outputPath,
      width: gifSettings.width,
      height: 0, // Auto
      aspectMode: 'pad',
      quality: 'high',
      format: 'gif',
      status: 'pending',
      progress: 0,
      gifSettings: { ...gifSettings },
    };

    addTask(task);
  }, [videoPath, gifSettings, addTask]);

  // Batch export all platforms
  const addBatchExport = useCallback(async () => {
    if (!videoPath) return;

    // Only standard platforms (not custom/gif)
    const platforms = PLATFORM_PRESETS.filter((p) => p.id !== 'custom');
    const tasks: ExportTask[] = [];

    for (const platform of platforms) {
      const ext = platform.format === 'mov' ? 'mov' : 'mp4';
      // For batch, auto-generate paths in same directory
      const basePath = videoPath.replace(/\.[^.]+$/, '');
      const outputPath = `${basePath}_${platform.id}.${ext}`;

      tasks.push({
        id: generateTaskId(),
        platformId: platform.id,
        platformName: platform.name,
        platformIcon: platform.icon,
        outputPath,
        width: platform.width,
        height: platform.height,
        aspectMode,
        quality: platform.quality,
        format: platform.format,
        status: 'pending',
        progress: 0,
      });
    }

    addBatchTasks(tasks);
  }, [videoPath, videoInfo, aspectMode, addBatchTasks]);

  // Extract thumbnail
  const extractThumbnail = useCallback(async () => {
    if (!videoPath) return;

    const ext = thumbnailFormat;
    const outputPath = await save({
      title: '儲存封面',
      defaultPath: `thumbnail.${ext}`,
      filters: [{ name: '圖片', extensions: [ext] }],
    });
    if (!outputPath) return;

    setIsExtractingThumb(true);
    try {
      await invoke('extract_thumbnail', {
        input: videoPath,
        output: outputPath,
        config: {
          time: thumbnailTime,
          format: thumbnailFormat,
          quality: 2,
        } satisfies ThumbnailExportConfig,
      });
      // Read thumbnail as data URL for preview
      setThumbnailPreview(outputPath);
    } catch (err) {
      console.error('Failed to extract thumbnail:', err);
    } finally {
      setIsExtractingThumb(false);
    }
  }, [videoPath, thumbnailTime, thumbnailFormat, setThumbnailPreview]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-bg-secondary overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium text-text-primary">📦 輸出設定</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'platform' as const, label: '平台預設', icon: '📺' },
          { id: 'gif' as const, label: 'GIF', icon: '🎞️' },
          { id: 'thumbnail' as const, label: '封面', icon: '🖼️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Platform Tab */}
      {activeTab === 'platform' && (
        <div className="p-3 space-y-3">
          {/* Platform cards */}
          <div className="space-y-2">
            {PLATFORM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectPlatform(preset.id)}
                className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                  selectedPlatformId === preset.id
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-border hover:border-accent/50 bg-bg-component'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-text-secondary truncate">
                      {preset.description}
                    </div>
                  </div>
                  {selectedPlatformId === preset.id && (
                    <span className="text-accent text-xs">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Custom settings (only for custom preset) */}
          {selectedPlatformId === 'custom' && (
            <div className="space-y-2 p-2 rounded-lg bg-bg-component border border-border">
              <div className="text-xs text-text-secondary font-medium">自定義設定</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary">寬度</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                    min={1}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary">高度</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                    min={1}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary">格式</label>
                  <select
                    value={customFormat}
                    onChange={(e) => setCustomFormat(e.target.value as 'mp4' | 'mov')}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                  >
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary">品質</label>
                  <select
                    value={customQuality}
                    onChange={(e) => setCustomQuality(e.target.value as any)}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                  >
                    <option value="highest">最高</option>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Aspect ratio mode */}
          <div className="space-y-1">
            <div className="text-xs text-text-secondary font-medium">比例適配</div>
            <div className="flex gap-2">
              <button
                onClick={() => setAspectMode('pad')}
                className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                  aspectMode === 'pad'
                    ? 'bg-accent text-white'
                    : 'bg-bg-component border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                📐 加黑邊
              </button>
              <button
                onClick={() => setAspectMode('crop')}
                className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                  aspectMode === 'crop'
                    ? 'bg-accent text-white'
                    : 'bg-bg-component border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                ✂️ 裁切
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={addPlatformExport}
              disabled={!hasVideo}
              className="w-full px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-xs font-medium
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ➕ 加入輸出佇列
            </button>
            <button
              onClick={addBatchExport}
              disabled={!hasVideo}
              className="w-full px-4 py-1.5 border border-accent/50 hover:bg-accent/10 text-accent rounded-lg text-xs
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📋 全平台批次輸出
            </button>
          </div>
        </div>
      )}

      {/* GIF Tab */}
      {activeTab === 'gif' && (
        <div className="p-3 space-y-3">
          <div className="text-xs text-text-secondary">
            使用高品質兩階段 palette 方法輸出 GIF
          </div>

          {/* Width */}
          <div>
            <label className="text-xs text-text-secondary">寬度 (px)</label>
            <input
              type="number"
              value={gifSettings.width}
              onChange={(e) => setGifSettings({ width: Math.max(1, Number(e.target.value)) })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-xs text-text-primary mt-1"
              min={1}
              max={1920}
            />
          </div>

          {/* FPS */}
          <div>
            <label className="text-xs text-text-secondary">FPS</label>
            <div className="flex gap-2 mt-1">
              {GIF_FPS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGifSettings({ fps: opt.value })}
                  className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                    gifSettings.fps === opt.value
                      ? 'bg-accent text-white'
                      : 'bg-bg-component border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="text-xs text-text-secondary">
              色彩數: {gifSettings.colors}
            </label>
            <input
              type="range"
              min={2}
              max={256}
              value={gifSettings.colors}
              onChange={(e) => setGifSettings({ colors: Number(e.target.value) })}
              className="w-full mt-1"
            />
          </div>

          {/* Time range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-text-secondary">開始時間 (s)</label>
              <input
                type="number"
                value={gifSettings.startTime}
                onChange={(e) => setGifSettings({ startTime: Math.max(0, Number(e.target.value)) })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                min={0}
                step={0.1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-secondary">結束時間 (s)</label>
              <input
                type="number"
                value={gifSettings.endTime}
                onChange={(e) => setGifSettings({ endTime: Number(e.target.value) })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
                step={0.1}
              />
              <div className="text-[9px] text-text-secondary mt-0.5">-1 = 全部</div>
            </div>
          </div>

          {/* Estimate size */}
          <button
            onClick={estimateGif}
            disabled={!hasVideo}
            className="w-full px-3 py-1.5 border border-border rounded text-xs text-text-secondary
                       hover:text-text-primary hover:border-accent/50 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📊 預估檔案大小
          </button>
          {estimatedGifSize !== null && (
            <div className="text-xs text-text-secondary text-center">
              預估大小: <span className="text-accent font-medium">{formatBytes(estimatedGifSize)}</span>
            </div>
          )}

          {/* Export GIF button */}
          <button
            onClick={addGifExport}
            disabled={!hasVideo}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-600/80 text-white rounded-lg text-xs font-medium
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🎞️ 加入 GIF 輸出佇列
          </button>
        </div>
      )}

      {/* Thumbnail Tab */}
      {activeTab === 'thumbnail' && (
        <div className="p-3 space-y-3">
          <div className="text-xs text-text-secondary">
            從影片任意時間點擷取封面圖片
          </div>

          {/* Time position */}
          <div>
            <label className="text-xs text-text-secondary">
              時間位置: {formatTime(thumbnailTime)}
            </label>
            <input
              type="range"
              min={0}
              max={videoInfo?.duration ?? 0}
              step={0.1}
              value={thumbnailTime}
              onChange={(e) => setThumbnailTime(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-[9px] text-text-secondary">
              <span>0:00</span>
              <span>{formatTime(videoInfo?.duration ?? 0)}</span>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-text-secondary">格式</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setThumbnailFormat('jpg')}
                className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                  thumbnailFormat === 'jpg'
                    ? 'bg-accent text-white'
                    : 'bg-bg-component border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                JPG
              </button>
              <button
                onClick={() => setThumbnailFormat('png')}
                className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
                  thumbnailFormat === 'png'
                    ? 'bg-accent text-white'
                    : 'bg-bg-component border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                PNG
              </button>
            </div>
          </div>

          {/* Extract button */}
          <button
            onClick={extractThumbnail}
            disabled={!hasVideo || isExtractingThumb}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-600/80 text-white rounded-lg text-xs font-medium
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExtractingThumb ? '⏳ 擷取中...' : '🖼️ 擷取封面'}
          </button>

          {/* Preview */}
          {thumbnailPreview && (
            <div className="space-y-1">
              <div className="text-xs text-text-secondary">已擷取:</div>
              <div className="p-2 bg-bg-component rounded-lg border border-border text-center">
                <span className="text-xs text-accent break-all">
                  ✅ {thumbnailPreview.split('/').pop()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
