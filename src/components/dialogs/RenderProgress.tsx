import { useRenderStore } from '../../stores/renderStore';
import { useRender } from '../../hooks/useRender';

/**
 * Render progress bar shown inline above the bottom toolbar.
 * Displays progress during rendering and completion/error states.
 */
export function RenderProgress() {
  const { renderState } = useRenderStore();
  const { cancelRender } = useRender();
  const { resetRender } = useRenderStore();

  if (renderState.status === 'idle') return null;

  return (
    <div className="flex-shrink-0 border-t border-border bg-bg-secondary/80 px-4 py-2.5">
      {renderState.status === 'rendering' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-primary">
              正在輸出影片...
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-accent font-mono">
                {Math.round(renderState.progress * 100)}%
              </span>
              <button
                onClick={cancelRender}
                className="text-xs text-text-secondary hover:text-error transition-colors"
              >
                取消
              </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(renderState.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {renderState.status === 'complete' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-success">✓</span>
            <span className="text-xs text-text-primary">輸出完成！</span>
            <span className="text-[10px] text-text-secondary truncate max-w-[300px]" title={renderState.outputPath}>
              {renderState.outputPath}
            </span>
          </div>
          <button
            onClick={resetRender}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            關閉
          </button>
        </div>
      )}

      {renderState.status === 'error' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-error">✕</span>
            <span className="text-xs text-error">輸出失敗</span>
            <span className="text-[10px] text-text-secondary">{renderState.message}</span>
          </div>
          <button
            onClick={resetRender}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
}
