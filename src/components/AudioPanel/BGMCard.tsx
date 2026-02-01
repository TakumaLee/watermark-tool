import { useState } from 'react';
import type { BGMItem } from '../../types';
import { formatTime } from '../../utils/formatTime';

interface BGMCardProps {
  bgm: BGMItem;
  onUpdate: (updates: Partial<BGMItem>) => void;
  onRemove: () => void;
}

export function BGMCard({ bgm, onUpdate, onRemove }: BGMCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const effectiveDuration = bgm.trimEnd > 0
    ? bgm.trimEnd - bgm.trimStart
    : bgm.duration - bgm.trimStart;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors
        ${bgm.isMuted ? 'border-border/50 opacity-60' : 'border-border'}`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-bg-primary/30 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-[10px]">🎵</span>
        <span className="text-xs text-text-primary truncate flex-1">{bgm.name}</span>
        <span className="text-[9px] text-text-secondary/50 font-mono">
          {formatTime(effectiveDuration)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ isMuted: !bgm.isMuted });
          }}
          className={`text-[10px] ${bgm.isMuted ? 'text-error' : 'text-text-secondary'}`}
          title={bgm.isMuted ? '取消靜音' : '靜音'}
        >
          {bgm.isMuted ? '🔇' : '🔊'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-[10px] text-text-secondary hover:text-error transition-colors"
          title="移除 BGM"
        >
          ✕
        </button>
        <span className="text-[9px] text-text-secondary/40">
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded settings */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2.5 bg-bg-primary/10">
          {/* Volume */}
          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary/70">音量</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={200}
                value={bgm.volume}
                onChange={(e) => onUpdate({ volume: Number(e.target.value) })}
                className="flex-1 accent-accent h-0.5"
              />
              <span className="text-[10px] text-text-secondary w-9 text-right font-mono">
                {bgm.volume}%
              </span>
            </div>
          </div>

          {/* Start offset */}
          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary/70">起始偏移 (秒)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={bgm.startOffset}
              onChange={(e) => onUpdate({ startOffset: Math.max(0, Number(e.target.value)) })}
              className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                         focus:border-accent focus:outline-none"
            />
          </div>

          {/* Trim */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-text-secondary/70">裁切起點 (秒)</label>
              <input
                type="number"
                min={0}
                max={bgm.duration}
                step={0.5}
                value={bgm.trimStart}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(Number(e.target.value), bgm.duration));
                  onUpdate({ trimStart: v });
                }}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                           focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-text-secondary/70">裁切終點 (秒)</label>
              <input
                type="number"
                min={-1}
                max={bgm.duration}
                step={0.5}
                value={bgm.trimEnd}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onUpdate({ trimEnd: v < 0 ? -1 : Math.min(v, bgm.duration) });
                }}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                           focus:border-accent focus:outline-none"
                placeholder="-1 = 結尾"
              />
            </div>
          </div>

          {/* Fade */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-text-secondary/70">淡入 (秒)</label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={bgm.fadeIn}
                onChange={(e) => onUpdate({ fadeIn: Math.max(0, Number(e.target.value)) })}
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
                value={bgm.fadeOut}
                onChange={(e) => onUpdate({ fadeOut: Math.max(0, Number(e.target.value)) })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary
                           focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Info */}
          <div className="text-[9px] text-text-secondary/40">
            總長：{formatTime(bgm.duration)} | 路徑：{bgm.filePath.split('/').pop()}
          </div>
        </div>
      )}
    </div>
  );
}
