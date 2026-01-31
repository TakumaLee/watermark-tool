import { useCallback, useState } from 'react';
import type { WatermarkItem, MovementMode, MovementDirection, SpeedPreset } from '../../types';
import { SPEED_PRESET_VALUES } from '../../types';
import { useWatermarkStore } from '../../stores/watermarkStore';
import { useVideoStore } from '../../stores/videoStore';

interface Props {
  watermark: WatermarkItem;
  index: number;
  isSelected: boolean;
}

export function WatermarkCard({ watermark, index, isSelected }: Props) {
  const { updateWatermark, updateMovement, removeWatermark, selectWatermark, applySameAsAbove } = useWatermarkStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Convert ratio to pixel values for display
  const videoWidth = videoInfo?.width ?? 1920;
  const videoHeight = videoInfo?.height ?? 1080;

  const pixelX = Math.round(watermark.x * videoWidth);
  const pixelY = Math.round(watermark.y * videoHeight);
  const pixelW = Math.round(watermark.width * videoWidth);
  const pixelH = Math.round(watermark.height * videoHeight);

  // Handle number input changes - convert pixel back to ratio
  const handlePositionChange = useCallback(
    (field: 'x' | 'y', pixelValue: number) => {
      const max = field === 'x' ? videoWidth : videoHeight;
      const ratio = Math.max(0, Math.min(1, pixelValue / max));
      updateWatermark(watermark.id, { [field]: ratio });
    },
    [watermark.id, videoWidth, videoHeight, updateWatermark],
  );

  const handleSizeChange = useCallback(
    (field: 'width' | 'height', pixelValue: number) => {
      const max = field === 'width' ? videoWidth : videoHeight;
      const newRatio = Math.max(0.01, Math.min(1, pixelValue / max));

      if (watermark.lockAspectRatio) {
        const aspect = watermark.naturalHeight / watermark.naturalWidth;
        const videoAspect = videoWidth / videoHeight;

        if (field === 'width') {
          const newH = newRatio * aspect * videoAspect;
          updateWatermark(watermark.id, { width: newRatio, height: newH });
        } else {
          const newW = newRatio / aspect / videoAspect;
          updateWatermark(watermark.id, { width: newW, height: newRatio });
        }
      } else {
        updateWatermark(watermark.id, { [field]: newRatio });
      }
    },
    [watermark, videoWidth, videoHeight, updateWatermark],
  );

  const handleSameAsAbove = useCallback(
    (checked: boolean) => {
      if (checked) {
        applySameAsAbove(watermark.id);
      } else {
        updateWatermark(watermark.id, { sameAsAbove: false });
      }
    },
    [watermark.id, applySameAsAbove, updateWatermark],
  );

  const handleLockToggle = useCallback(() => {
    updateWatermark(watermark.id, { lockAspectRatio: !watermark.lockAspectRatio });
  }, [watermark.id, watermark.lockAspectRatio, updateWatermark]);

  // --- Movement mode handlers ---
  const handleMovementType = useCallback(
    (type: 'Static' | 'Linear' | 'Random') => {
      let movement: MovementMode;
      switch (type) {
        case 'Static':
          movement = { type: 'Static' };
          break;
        case 'Linear':
          movement = { type: 'Linear', speed: SPEED_PRESET_VALUES.medium, direction: 'horizontal' };
          break;
        case 'Random':
          movement = { type: 'Random', interval: 2.0, fade_duration: 0.3 };
          break;
      }
      updateMovement(watermark.id, movement);
    },
    [watermark.id, updateMovement],
  );

  const handleLinearSpeed = useCallback(
    (speed: number) => {
      if (watermark.movement.type === 'Linear') {
        updateMovement(watermark.id, { ...watermark.movement, speed });
      }
    },
    [watermark.id, watermark.movement, updateMovement],
  );

  const handleLinearDirection = useCallback(
    (direction: MovementDirection) => {
      if (watermark.movement.type === 'Linear') {
        updateMovement(watermark.id, { ...watermark.movement, direction });
      }
    },
    [watermark.id, watermark.movement, updateMovement],
  );

  const handleRandomInterval = useCallback(
    (interval: number) => {
      if (watermark.movement.type === 'Random') {
        updateMovement(watermark.id, { ...watermark.movement, interval });
      }
    },
    [watermark.id, watermark.movement, updateMovement],
  );

  const handleRandomFadeDuration = useCallback(
    (fade_duration: number) => {
      if (watermark.movement.type === 'Random') {
        updateMovement(watermark.id, { ...watermark.movement, fade_duration });
      }
    },
    [watermark.id, watermark.movement, updateMovement],
  );

  // Get current speed preset label
  const getSpeedLabel = (speed: number): string => {
    if (speed <= 70) return '慢';
    if (speed <= 180) return '中';
    return '快';
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors duration-150 ${
        isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-border/80'
      }`}
      onClick={() => selectWatermark(watermark.id)}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer bg-bg-component/30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors w-4"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <span className="text-xs text-accent font-mono">#{index + 1}</span>
          <span className="text-xs text-text-primary truncate" title={watermark.name}>
            {watermark.name}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); removeWatermark(watermark.id); }}
          className="text-xs text-text-secondary hover:text-error transition-colors px-1"
          title="刪除浮水印"
        >
          ✕
        </button>
      </div>

      {/* Card body */}
      {!isCollapsed && (
        <div className="px-3 py-2.5 space-y-3">
          {/* Thumbnail + info */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-bg-component rounded flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={watermark.imageUrl}
                alt={watermark.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="text-[10px] text-text-secondary">
              <p>原始: {watermark.naturalWidth}×{watermark.naturalHeight}</p>
            </div>
          </div>

          {/* "Same as above" checkbox (only for index > 0) */}
          {index > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={watermark.sameAsAbove}
                onChange={(e) => handleSameAsAbove(e.target.checked)}
                className="accent-accent w-3.5 h-3.5"
              />
              <span className="text-xs text-text-secondary">同上（尺寸 + 透明度）</span>
            </label>
          )}

          {/* Position section */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">位置</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="X"
                value={pixelX}
                onChange={(v) => handlePositionChange('x', v)}
                suffix="px"
              />
              <NumberInput
                label="Y"
                value={pixelY}
                onChange={(v) => handlePositionChange('y', v)}
                suffix="px"
              />
            </div>
          </div>

          {/* Size section */}
          <div className={`space-y-1.5 ${watermark.sameAsAbove ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">尺寸</p>
              <button
                onClick={handleLockToggle}
                className={`text-xs transition-colors ${
                  watermark.lockAspectRatio ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
                title={watermark.lockAspectRatio ? '已鎖定比例' : '自由調整'}
              >
                {watermark.lockAspectRatio ? '🔒' : '🔓'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="W"
                value={pixelW}
                onChange={(v) => handleSizeChange('width', v)}
                suffix="px"
              />
              <NumberInput
                label="H"
                value={pixelH}
                onChange={(v) => handleSizeChange('height', v)}
                suffix="px"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-secondary">比例:</span>
              <span className="text-[10px] text-text-primary font-mono">
                {(watermark.width * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Opacity section */}
          <div className={`space-y-1.5 ${watermark.sameAsAbove ? 'opacity-40 pointer-events-none' : ''}`}>
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">透明度</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={watermark.opacity}
                onChange={(e) => updateWatermark(watermark.id, { opacity: parseInt(e.target.value) })}
                className="flex-1 h-4"
              />
              <span className="text-xs text-text-primary font-mono w-10 text-right">{watermark.opacity}%</span>
            </div>
          </div>

          {/* Movement mode section */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">移動方式</p>
            <div className="space-y-1">
              {/* Static */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`move-${watermark.id}`}
                  checked={watermark.movement.type === 'Static'}
                  onChange={() => handleMovementType('Static')}
                  className="accent-accent w-3 h-3"
                />
                <span className="text-xs text-text-primary">固定</span>
              </label>

              {/* Linear */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`move-${watermark.id}`}
                  checked={watermark.movement.type === 'Linear'}
                  onChange={() => handleMovementType('Linear')}
                  className="accent-accent w-3 h-3"
                />
                <span className="text-xs text-text-primary">線性移動</span>
              </label>

              {/* Linear settings (expanded when selected) */}
              {watermark.movement.type === 'Linear' && (
                <div className="ml-5 mt-1 p-2.5 bg-bg-component/30 rounded-lg space-y-2.5 border border-border/50">
                  {/* Speed slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-secondary">速度</span>
                      <span className="text-[10px] text-text-primary font-mono">
                        {Math.round(watermark.movement.speed)} px/s ({getSpeedLabel(watermark.movement.speed)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary">慢</span>
                      <input
                        type="range"
                        min={10}
                        max={400}
                        value={watermark.movement.speed}
                        onChange={(e) => handleLinearSpeed(parseInt(e.target.value))}
                        className="flex-1 h-3"
                      />
                      <span className="text-[10px] text-text-secondary">快</span>
                    </div>
                    {/* Speed presets */}
                    <div className="flex gap-1.5 mt-1">
                      {(['slow', 'medium', 'fast'] as SpeedPreset[]).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleLinearSpeed(SPEED_PRESET_VALUES[preset])}
                          className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                            Math.abs(watermark.movement.type === 'Linear' ? watermark.movement.speed - SPEED_PRESET_VALUES[preset] : 999) < 20
                              ? 'bg-accent/20 text-accent border border-accent/30'
                              : 'bg-bg-component/50 text-text-secondary hover:text-text-primary border border-transparent'
                          }`}
                        >
                          {preset === 'slow' ? '慢' : preset === 'medium' ? '中' : '快'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direction */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-secondary">移動方向</span>
                    <select
                      value={watermark.movement.direction}
                      onChange={(e) => handleLinearDirection(e.target.value as MovementDirection)}
                      className="w-full bg-bg-component border border-border rounded px-2 py-1 text-xs
                                 text-text-primary focus:outline-none focus:border-accent/50"
                    >
                      <option value="horizontal">水平移動</option>
                      <option value="vertical">垂直移動</option>
                      <option value="diagonal">對角線移動</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Random */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`move-${watermark.id}`}
                  checked={watermark.movement.type === 'Random'}
                  onChange={() => handleMovementType('Random')}
                  className="accent-accent w-3 h-3"
                />
                <span className="text-xs text-text-primary">隨機出現</span>
              </label>

              {/* Random settings (expanded when selected) */}
              {watermark.movement.type === 'Random' && (
                <div className="ml-5 mt-1 p-2.5 bg-bg-component/30 rounded-lg space-y-2.5 border border-border/50">
                  {/* Interval slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-secondary">閃爍頻率</span>
                      <span className="text-[10px] text-text-primary font-mono">
                        每 {watermark.movement.interval.toFixed(1)} 秒
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary">慢</span>
                      <input
                        type="range"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={watermark.movement.interval}
                        onChange={(e) => handleRandomInterval(parseFloat(e.target.value))}
                        className="flex-1 h-3"
                      />
                      <span className="text-[10px] text-text-secondary">快</span>
                    </div>
                  </div>

                  {/* Fade duration */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watermark.movement.fade_duration > 0}
                        onChange={(e) => handleRandomFadeDuration(e.target.checked ? 0.3 : 0)}
                        className="accent-accent w-3 h-3"
                      />
                      <span className="text-[10px] text-text-secondary">淡入淡出過渡</span>
                    </label>
                    {watermark.movement.fade_duration > 0 && (
                      <div className="flex items-center gap-2 ml-5">
                        <span className="text-[10px] text-text-secondary">時間:</span>
                        <input
                          type="range"
                          min={0.1}
                          max={1.0}
                          step={0.1}
                          value={watermark.movement.fade_duration}
                          onChange={(e) => handleRandomFadeDuration(parseFloat(e.target.value))}
                          className="flex-1 h-3"
                        />
                        <span className="text-[10px] text-text-primary font-mono w-8 text-right">
                          {watermark.movement.fade_duration.toFixed(1)}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Reusable number input ---

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function NumberInput({ label, value, onChange, suffix }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync from prop when not focused
  if (!isFocused && String(value) !== localValue) {
    setLocalValue(String(value));
  }

  const handleBlur = () => {
    setIsFocused(false);
    const num = parseInt(localValue);
    if (!isNaN(num)) {
      onChange(num);
    } else {
      setLocalValue(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-text-secondary w-3">{label}</span>
      <div className="flex-1 flex items-center bg-bg-component/50 rounded px-1.5 py-0.5 border border-transparent focus-within:border-accent/50 transition-colors">
        <input
          type="text"
          value={isFocused ? localValue : String(value)}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => { setIsFocused(true); setLocalValue(String(value)); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-xs text-text-primary font-mono outline-none"
        />
        {suffix && <span className="text-[10px] text-text-secondary ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}
