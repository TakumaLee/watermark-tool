import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffectsStore, generatePipId } from '../../stores/effectsStore';
import { SPEED_OPTIONS } from '../../types';
import type { SpeedValue, RotationAngle, FlipDirection, PiPConfig } from '../../types';

export function EffectsPanel() {
  const {
    speed,
    reverse,
    setSpeed,
    setReverse,
    transform,
    setRotation,
    setFlip,
    setCrop,
    resetTransform,
    pipLayers,
    selectedPipId,
    addPip,
    updatePip,
    removePip,
    selectPip,
  } = useEffectsStore();

  const [expandedSection, setExpandedSection] = useState<string | null>('speed');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // PiP import
  const handleImportPip = useCallback(async () => {
    try {
      const result = await open({
        title: '選擇 PiP 影片',
        filters: [{ name: '影片檔', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
      });

      if (!result) return;
      const filePath = result as string;

      // Get video info for aspect ratio
      const info = await invoke<{ width: number; height: number; duration: number }>(
        'probe_video',
        { path: filePath }
      );

      const pip: PiPConfig = {
        id: generatePipId(),
        sourcePath: filePath,
        sourceUrl: `asset://localhost/${encodeURIComponent(filePath)}`,
        name: filePath.split('/').pop() || 'PiP',
        x: 0.65,
        y: 0.65,
        width: 0.3,
        height: 0.3,
        startTime: 0,
        endTime: -1,
        aspectRatio: info.width / info.height,
      };

      addPip(pip);
    } catch (err) {
      console.error('Failed to import PiP video:', err);
    }
  }, [addPip]);

  // Crop toggle
  const handleToggleCrop = useCallback(() => {
    if (transform.crop) {
      setCrop(null);
    } else {
      setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    }
  }, [transform.crop, setCrop]);

  return (
    <div className="w-64 flex-shrink-0 border-l border-border bg-bg-secondary overflow-y-auto">
      <div className="p-3">
        <h3 className="text-sm font-medium text-text-primary mb-3">⚡ 進階效果</h3>

        {/* === Speed Section === */}
        <SectionHeader
          title="🎬 速度調整"
          isOpen={expandedSection === 'speed'}
          onClick={() => toggleSection('speed')}
        />
        {expandedSection === 'speed' && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-1">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSpeed(opt.value as SpeedValue)}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    speed === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border/50 text-text-secondary hover:border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Reverse */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reverse}
                onChange={(e) => setReverse(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent"
              />
              <span className="text-[11px] text-text-secondary">
                ⏪ 倒放 (Reverse)
              </span>
            </label>
          </div>
        )}

        {/* === Transform Section === */}
        <SectionHeader
          title="🔄 裁剪/旋轉/翻轉"
          isOpen={expandedSection === 'transform'}
          onClick={() => toggleSection('transform')}
        />
        {expandedSection === 'transform' && (
          <div className="mb-3 space-y-3">
            {/* Rotation */}
            <div>
              <span className="text-[11px] text-text-secondary block mb-1">旋轉</span>
              <div className="flex gap-1">
                {([0, 90, 180, 270] as RotationAngle[]).map((angle) => (
                  <button
                    key={angle}
                    onClick={() => setRotation(angle)}
                    className={`flex-1 px-1 py-1 text-[11px] rounded border transition-colors ${
                      transform.rotation === angle
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/50 text-text-secondary hover:border-border'
                    }`}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
            </div>

            {/* Flip */}
            <div>
              <span className="text-[11px] text-text-secondary block mb-1">翻轉</span>
              <div className="flex gap-1">
                {(
                  [
                    { value: 'none', label: '無' },
                    { value: 'horizontal', label: '↔ 水平' },
                    { value: 'vertical', label: '↕ 垂直' },
                    { value: 'both', label: '↔↕ 雙向' },
                  ] as { value: FlipDirection; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFlip(opt.value)}
                    className={`flex-1 px-1 py-1 text-[10px] rounded border transition-colors ${
                      transform.flip === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/50 text-text-secondary hover:border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Crop */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-secondary">裁剪</span>
                <button
                  onClick={handleToggleCrop}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    transform.crop
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border/50 text-text-secondary hover:border-border'
                  }`}
                >
                  {transform.crop ? '✓ 已啟用' : '啟用裁剪'}
                </button>
              </div>

              {transform.crop && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <div>
                    <label className="text-[9px] text-text-secondary/60">X</label>
                    <input
                      type="number"
                      min="0"
                      max="0.9"
                      step="0.01"
                      value={transform.crop.x}
                      onChange={(e) =>
                        setCrop({ ...transform.crop!, x: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary/60">Y</label>
                    <input
                      type="number"
                      min="0"
                      max="0.9"
                      step="0.01"
                      value={transform.crop.y}
                      onChange={(e) =>
                        setCrop({ ...transform.crop!, y: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary/60">寬度</label>
                    <input
                      type="number"
                      min="0.1"
                      max="1"
                      step="0.01"
                      value={transform.crop.width}
                      onChange={(e) =>
                        setCrop({ ...transform.crop!, width: parseFloat(e.target.value) || 0.5 })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary/60">高度</label>
                    <input
                      type="number"
                      min="0.1"
                      max="1"
                      step="0.01"
                      value={transform.crop.height}
                      onChange={(e) =>
                        setCrop({ ...transform.crop!, height: parseFloat(e.target.value) || 0.5 })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reset */}
            <button
              onClick={resetTransform}
              className="w-full text-[10px] text-text-secondary hover:text-accent py-1 transition-colors"
            >
              重置變形
            </button>
          </div>
        )}

        {/* === PiP Section === */}
        <SectionHeader
          title="🖼 畫中畫 (PiP)"
          isOpen={expandedSection === 'pip'}
          onClick={() => toggleSection('pip')}
        />
        {expandedSection === 'pip' && (
          <div className="mb-3 space-y-2">
            <button
              onClick={handleImportPip}
              className="w-full py-1.5 text-[11px] border border-dashed border-border rounded
                         text-text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              + 匯入 PiP 影片
            </button>

            {pipLayers.map((pip) => (
              <div
                key={pip.id}
                className={`p-2 rounded border transition-colors cursor-pointer ${
                  selectedPipId === pip.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border/50 hover:border-border'
                }`}
                onClick={() => selectPip(pip.id)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-text-primary truncate flex-1">
                    {pip.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePip(pip.id);
                    }}
                    className="text-[10px] text-text-secondary hover:text-error ml-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Position & Size */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[9px] text-text-secondary/60">X</label>
                    <input
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.01"
                      value={pip.x}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updatePip(pip.id, { x: parseFloat(e.target.value) })
                      }
                      className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2
                                 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-accent
                                 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary/60">Y</label>
                    <input
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.01"
                      value={pip.y}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updatePip(pip.id, { y: parseFloat(e.target.value) })
                      }
                      className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2
                                 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-accent
                                 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>

                {/* Size slider */}
                <div className="mt-1">
                  <label className="text-[9px] text-text-secondary/60">大小</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.01"
                    value={pip.width}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const w = parseFloat(e.target.value);
                      updatePip(pip.id, {
                        width: w,
                        height: w / pip.aspectRatio,
                      });
                    }}
                    className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2
                               [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-accent
                               [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div>
                    <label className="text-[9px] text-text-secondary/60">起始 (s)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={pip.startTime}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updatePip(pip.id, { startTime: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-1 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary/60">結束 (s, -1=全程)</label>
                    <input
                      type="number"
                      min="-1"
                      step="0.1"
                      value={pip.endTime}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updatePip(pip.id, { endTime: parseFloat(e.target.value) })
                      }
                      className="w-full px-1 py-0.5 text-[10px] bg-bg-primary border border-border rounded text-text-primary"
                    />
                  </div>
                </div>
              </div>
            ))}

            {pipLayers.length === 0 && (
              <p className="text-[10px] text-text-secondary/50 text-center py-2">
                尚無 PiP 影片
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Collapsible section header */
function SectionHeader({
  title,
  isOpen,
  onClick,
}: {
  title: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-1.5 text-[12px] font-medium
                 text-text-secondary hover:text-text-primary transition-colors border-b border-border/30 mb-2"
    >
      <span>{title}</span>
      <span className="text-[10px]">{isOpen ? '▼' : '▶'}</span>
    </button>
  );
}

export default EffectsPanel;
