import { useCallback } from 'react';
import { useEffectsStore } from '../../stores/effectsStore';
import { FILTER_PRESETS } from '../../types';
import type { FilterPreset } from '../../types';

export function FilterPanel() {
  const {
    filters,
    activePresetId,
    setBrightness,
    setContrast,
    setSaturation,
    setActivePreset,
    setFilters,
    resetFilters,
  } = useEffectsStore();

  const handlePresetClick = useCallback(
    (preset: FilterPreset) => {
      setFilters(preset.adjustments);
      setActivePreset(preset.id);
    },
    [setFilters, setActivePreset]
  );

  // CSS filter for live preview (used by VideoPlayer)
  const cssFilter = `brightness(${1 + filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`;

  return (
    <div className="w-64 flex-shrink-0 border-l border-border bg-bg-secondary overflow-y-auto">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">🎨 濾鏡</h3>
          <button
            onClick={resetFilters}
            className="text-[10px] text-text-secondary hover:text-accent transition-colors"
          >
            重置
          </button>
        </div>

        {/* Preset Grid */}
        <div className="mb-4">
          <span className="text-[11px] text-text-secondary mb-2 block">預設模板</span>
          <div className="grid grid-cols-4 gap-1.5">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={`flex flex-col items-center p-1.5 rounded border transition-colors ${
                  activePresetId === preset.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border/50 hover:border-border text-text-secondary hover:text-text-primary'
                }`}
                title={preset.name}
              >
                <span className="text-lg leading-none">{preset.icon}</span>
                <span className="text-[9px] mt-0.5 truncate w-full text-center">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Adjustments */}
        <div className="space-y-3">
          <span className="text-[11px] text-text-secondary block">手動調整</span>

          {/* Brightness */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-text-secondary">亮度</label>
              <span className="text-[10px] text-text-secondary/60 font-mono">
                {filters.brightness > 0 ? '+' : ''}{filters.brightness.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={filters.brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-text-secondary">對比</label>
              <span className="text-[10px] text-text-secondary/60 font-mono">
                {filters.contrast.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={filters.contrast}
              onChange={(e) => setContrast(parseFloat(e.target.value))}
              className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-text-secondary">飽和度</label>
              <span className="text-[10px] text-text-secondary/60 font-mono">
                {filters.saturation.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={filters.saturation}
              onChange={(e) => setSaturation(parseFloat(e.target.value))}
              className="w-full h-1 bg-border rounded appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>

        {/* Live preview indicator */}
        <div className="mt-4 p-2 rounded bg-bg-primary/50 border border-border/30">
          <span className="text-[10px] text-text-secondary/60 block mb-1">
            CSS 預覽
          </span>
          <code className="text-[9px] text-text-secondary/40 break-all">
            {cssFilter}
          </code>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
