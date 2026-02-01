import { useCallback } from 'react';
import type { TextOverlayItem } from '../../types/text';
import { BUILT_IN_FONTS } from '../../types/text';
import { useTextStore } from '../../stores/textStore';
import { useVideoStore } from '../../stores/videoStore';
import { formatTime } from '../../utils/formatTime';

interface Props {
  item: TextOverlayItem;
  isSelected: boolean;
}

export function TextCard({ item, isSelected }: Props) {
  const { updateTextItem, selectTextItem, removeTextItem } = useTextStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);
  const videoDuration = videoInfo ? videoInfo.duration : 0;

  const handleSelect = useCallback(() => {
    selectTextItem(item.id);
  }, [item.id, selectTextItem]);

  return (
    <div
      className={`bg-bg-component/50 rounded-lg p-3 space-y-3 border transition-colors cursor-pointer ${
        isSelected ? 'border-blue-400' : 'border-border/50 hover:border-border'
      }`}
      onClick={handleSelect}
    >
      {/* Header: text preview + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">📝</span>
          <span className="text-xs text-text-primary truncate font-medium">
            {item.content || '(空白)'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeTextItem(item.id);
          }}
          className="text-[10px] text-text-secondary hover:text-error transition-colors flex-shrink-0"
          title="刪除文字"
        >
          🗑
        </button>
      </div>

      {isSelected && (
        <>
          {/* Text content */}
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">文字內容</label>
            <textarea
              value={item.content}
              onChange={(e) => updateTextItem(item.id, { content: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-xs text-text-primary resize-none"
              rows={2}
              placeholder="輸入文字..."
            />
          </div>

          {/* Font selection */}
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">字體</label>
            <select
              value={item.fontFamily}
              onChange={(e) => updateTextItem(item.id, { fontFamily: e.target.value })}
              className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary"
            >
              {BUILT_IN_FONTS.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Font size + alignment */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">大小 (px)</label>
              <input
                type="number"
                value={item.fontSize}
                min={8}
                max={200}
                onChange={(e) => updateTextItem(item.id, { fontSize: parseInt(e.target.value) || 32 })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-xs text-text-primary font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">對齊</label>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateTextItem(item.id, { align })}
                    className={`flex-1 py-1 text-xs rounded border transition-colors ${
                      item.align === align
                        ? 'bg-blue-400/20 border-blue-400 text-blue-400'
                        : 'border-border text-text-secondary hover:border-blue-400/50'
                    }`}
                  >
                    {align === 'left' ? '⫷' : align === 'center' ? '⫿' : '⫸'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">文字顏色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={item.color}
                  onChange={(e) => updateTextItem(item.id, { color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={item.color}
                  onChange={(e) => updateTextItem(item.id, { color: e.target.value })}
                  className="flex-1 px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">描邊顏色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={item.strokeColor}
                  onChange={(e) => updateTextItem(item.id, { strokeColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={item.strokeColor}
                  onChange={(e) => updateTextItem(item.id, { strokeColor: e.target.value })}
                  className="flex-1 px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
                />
              </div>
            </div>
          </div>

          {/* Stroke width */}
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">
              描邊寬度: {item.strokeWidth}px
            </label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={item.strokeWidth}
              onChange={(e) => updateTextItem(item.id, { strokeWidth: parseFloat(e.target.value) })}
              className="w-full h-1 accent-blue-400"
            />
          </div>

          {/* Background */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">背景色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={item.bgColor}
                  onChange={(e) => updateTextItem(item.id, { bgColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-border"
                />
                <span className="text-[10px] text-text-secondary font-mono">{item.bgColor}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">
                背景透明度: {item.bgOpacity}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={item.bgOpacity}
                onChange={(e) => updateTextItem(item.id, { bgOpacity: parseInt(e.target.value) })}
                className="w-full h-1 accent-blue-400"
              />
            </div>
          </div>

          {/* Time range */}
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">顯示時間範圍</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-secondary/70 block mb-0.5">開始</label>
                <input
                  type="number"
                  value={item.startTime.toFixed(1)}
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  onChange={(e) => updateTextItem(item.id, { startTime: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-secondary/70 block mb-0.5">結束 (-1=全程)</label>
                <input
                  type="number"
                  value={item.endTime.toFixed(1)}
                  min={-1}
                  max={videoDuration}
                  step={0.1}
                  onChange={(e) => updateTextItem(item.id, { endTime: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
                />
              </div>
            </div>
            {item.startTime > 0 || item.endTime >= 0 ? (
              <p className="text-[9px] text-text-secondary/60 mt-1">
                {formatTime(item.startTime)} ~ {item.endTime < 0 ? '結尾' : formatTime(item.endTime)}
              </p>
            ) : null}
          </div>

          {/* Position */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">X 位置</label>
              <input
                type="number"
                value={(item.x * 100).toFixed(1)}
                min={0}
                max={100}
                step={0.5}
                onChange={(e) => updateTextItem(item.id, { x: (parseFloat(e.target.value) || 0) / 100 })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-secondary block mb-1">Y 位置</label>
              <input
                type="number"
                value={(item.y * 100).toFixed(1)}
                min={0}
                max={100}
                step={0.5}
                onChange={(e) => updateTextItem(item.id, { y: (parseFloat(e.target.value) || 0) / 100 })}
                className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
