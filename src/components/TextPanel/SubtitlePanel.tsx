import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTextStore } from '../../stores/textStore';
import { BUILT_IN_FONTS } from '../../types/text';
import { parseSrt, formatSrtTime } from '../../utils/srtParser';
import type { SubtitleEntry } from '../../types/text';

export function SubtitlePanel() {
  const {
    subtitles,
    subtitleStyle,
    subtitlesEnabled,
    srtFilePath,
    setSubtitles,
    updateSubtitle,
    removeSubtitle,
    addSubtitle,
    updateSubtitleStyle,
    setSubtitlesEnabled,
    clearSubtitles,
  } = useTextStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Import SRT file
  const handleImportSrt = useCallback(async () => {
    try {
      const selected = await open({
        filters: [{ name: 'SRT 字幕檔', extensions: ['srt'] }],
        multiple: false,
      });
      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected;
      const content = await invoke<string>('load_preset', { path: filePath });
      const entries = parseSrt(content);

      if (entries.length === 0) {
        console.warn('SRT file is empty or invalid');
        return;
      }

      setSubtitles(entries, filePath);
    } catch (err) {
      console.error('Failed to import SRT:', err);
    }
  }, [setSubtitles]);

  // Add new empty subtitle
  const handleAddSubtitle = useCallback(() => {
    const lastSub = subtitles[subtitles.length - 1];
    const startTime = lastSub ? lastSub.endTime + 0.5 : 0;
    const newEntry: SubtitleEntry = {
      index: subtitles.length + 1,
      startTime,
      endTime: startTime + 3,
      text: '新字幕',
    };
    addSubtitle(newEntry);
    setEditingIndex(newEntry.index);
  }, [subtitles, addSubtitle]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          字幕
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={subtitlesEnabled}
              onChange={(e) => setSubtitlesEnabled(e.target.checked)}
              className="w-3 h-3 accent-blue-400"
            />
            顯示
          </label>
          {subtitles.length > 0 && (
            <button
              onClick={clearSubtitles}
              className="text-[10px] text-text-secondary hover:text-error transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Import button */}
      <button
        onClick={handleImportSrt}
        className="w-full py-2 border border-dashed border-border rounded-lg
                   text-text-secondary text-xs hover:border-blue-400 hover:text-blue-400
                   transition-colors duration-150"
      >
        📄 匯入 SRT 字幕檔
      </button>

      {srtFilePath && (
        <p className="text-[9px] text-text-secondary/60 truncate" title={srtFilePath}>
          📁 {srtFilePath.split('/').pop()?.split('\\').pop()}
        </p>
      )}

      {/* Subtitle style settings */}
      {subtitles.length > 0 && (
        <div className="bg-bg-primary/50 rounded-lg p-2.5 space-y-2">
          <h4 className="text-[10px] text-text-secondary font-medium">字幕樣式</h4>

          {/* Font */}
          <select
            value={subtitleStyle.fontFamily}
            onChange={(e) => updateSubtitleStyle({ fontFamily: e.target.value })}
            className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary"
          >
            {BUILT_IN_FONTS.map((f) => (
              <option key={f.family} value={f.family}>{f.name}</option>
            ))}
          </select>

          {/* Size + Color */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-text-secondary/70 block mb-0.5">大小</label>
              <input
                type="number"
                value={subtitleStyle.fontSize}
                min={12}
                max={100}
                onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value) || 28 })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] text-text-secondary/70 block mb-0.5">顏色</label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={subtitleStyle.color}
                  onChange={(e) => updateSubtitleStyle({ color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border border-border"
                />
                <span className="text-[9px] text-text-secondary font-mono">{subtitleStyle.color}</span>
              </div>
            </div>
          </div>

          {/* Stroke */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-text-secondary/70 block mb-0.5">描邊色</label>
              <input
                type="color"
                value={subtitleStyle.strokeColor}
                onChange={(e) => updateSubtitleStyle({ strokeColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border border-border"
              />
            </div>
            <div>
              <label className="text-[9px] text-text-secondary/70 block mb-0.5">描邊寬度: {subtitleStyle.strokeWidth}</label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={subtitleStyle.strokeWidth}
                onChange={(e) => updateSubtitleStyle({ strokeWidth: parseFloat(e.target.value) })}
                className="w-full h-1 accent-blue-400"
              />
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="text-[9px] text-text-secondary/70 block mb-0.5">
              垂直位置: {(subtitleStyle.positionY * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={subtitleStyle.positionY * 100}
              onChange={(e) => updateSubtitleStyle({ positionY: parseFloat(e.target.value) / 100 })}
              className="w-full h-1 accent-blue-400"
            />
          </div>
        </div>
      )}

      {/* Subtitle list */}
      {subtitles.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {subtitles.map((sub) => (
            <div
              key={sub.index}
              className={`bg-bg-primary/50 rounded p-2 text-xs group cursor-pointer hover:bg-bg-primary/80 transition-colors ${
                editingIndex === sub.index ? 'ring-1 ring-blue-400' : ''
              }`}
              onClick={() => setEditingIndex(editingIndex === sub.index ? null : sub.index)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-text-secondary font-mono">
                  #{sub.index} {formatSrtTime(sub.startTime)} → {formatSrtTime(sub.endTime)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSubtitle(sub.index);
                  }}
                  className="text-[9px] text-text-secondary hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                >
                  ✕
                </button>
              </div>

              {editingIndex === sub.index ? (
                <div className="space-y-1.5 mt-2">
                  <textarea
                    value={sub.text}
                    onChange={(e) => updateSubtitle(sub.index, { text: e.target.value })}
                    className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary resize-none"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[9px] text-text-secondary/70">開始 (秒)</label>
                      <input
                        type="number"
                        value={sub.startTime.toFixed(3)}
                        step={0.1}
                        min={0}
                        onChange={(e) => updateSubtitle(sub.index, { startTime: parseFloat(e.target.value) || 0 })}
                        className="w-full px-1.5 py-0.5 bg-bg-primary border border-border rounded text-[9px] text-text-primary font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-text-secondary/70">結束 (秒)</label>
                      <input
                        type="number"
                        value={sub.endTime.toFixed(3)}
                        step={0.1}
                        min={0}
                        onChange={(e) => updateSubtitle(sub.index, { endTime: parseFloat(e.target.value) || 0 })}
                        className="w-full px-1.5 py-0.5 bg-bg-primary border border-border rounded text-[9px] text-text-primary font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-text-primary truncate">{sub.text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add subtitle button */}
      <button
        onClick={handleAddSubtitle}
        className="w-full py-1.5 text-[10px] text-text-secondary hover:text-blue-400 transition-colors"
      >
        + 新增字幕條目
      </button>
    </div>
  );
}
