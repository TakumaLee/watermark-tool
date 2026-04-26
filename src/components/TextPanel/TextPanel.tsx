import { useTextStore } from '../../stores/textStore';
import { TextCard } from './TextCard';
import { SubtitlePanel } from './SubtitlePanel';

export function TextPanel() {
  const { textItems, selectedTextId, addTextItem, clearAllText } = useTextStore();

  return (
    <div className="w-[320px] flex-shrink-0 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">📝 文字 & 字幕</h2>
        {textItems.length > 0 && (
          <button
            onClick={clearAllText}
            className="text-[10px] text-text-secondary hover:text-error transition-colors"
            title="清除全部文字"
          >
            清除全部 🗑
          </button>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Add text button */}
          <button
            onClick={() => addTextItem()}
            className="w-full py-2.5 border border-dashed border-border rounded-lg
                       text-text-secondary text-sm hover:border-blue-400 hover:text-blue-400
                       transition-colors duration-150"
          >
            + 新增文字疊加
          </button>

          {/* Text overlay cards */}
          {textItems.length > 0 && (
            <div className="space-y-3">
              {textItems.map((item) => (
                <TextCard
                  key={item.id}
                  item={item}
                  isSelected={selectedTextId === item.id}
                />
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/50 pt-4">
            <SubtitlePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
