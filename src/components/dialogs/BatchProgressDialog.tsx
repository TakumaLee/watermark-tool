import { useBatchStore } from '../../stores/batchStore';
import { useBatch } from '../../hooks/useBatch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchProgressDialog({ isOpen, onClose }: Props) {
  const batchState = useBatchStore((s) => s.batchState);
  const resetBatch = useBatchStore((s) => s.resetBatch);
  const { cancelBatch } = useBatch();

  if (!isOpen || batchState.status === 'idle') return null;

  const isProcessing = batchState.status === 'processing';
  const isComplete = batchState.status === 'complete';

  const files = isProcessing
    ? batchState.files
    : isComplete
      ? batchState.files
      : [];

  const totalCount = files.length;
  const completedCount = files.filter((f) => f.status === 'complete').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const currentIndex = isProcessing ? batchState.currentIndex : totalCount;

  // Overall progress
  const overallProgress = totalCount > 0
    ? files.reduce((sum, f) => sum + (f.status === 'complete' ? 1 : f.status === 'error' ? 1 : f.progress), 0) / totalCount
    : 0;

  const handleClose = () => {
    resetBatch();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[520px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-medium text-text-primary">
            {isProcessing ? '批次處理中...' : '批次處理完成'}
          </h2>
          {!isProcessing && (
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">
                整體進度：{completedCount + errorCount} / {totalCount}
              </span>
              <span className="text-sm text-accent font-mono">
                {Math.round(overallProgress * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(overallProgress * 100)}%` }}
              />
            </div>
          </div>

          {/* File list */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto border border-border rounded-lg p-2">
            {files.map((file, index) => (
              <div
                key={file.path}
                className={`p-2.5 rounded-lg transition-colors ${
                  index === currentIndex && isProcessing
                    ? 'bg-accent/5 border border-accent/20'
                    : 'bg-bg-component/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Status icon */}
                  <span className="flex-shrink-0 w-5 text-center">
                    {file.status === 'complete' && <span className="text-success">✓</span>}
                    {file.status === 'error' && <span className="text-error">✕</span>}
                    {file.status === 'processing' && (
                      <span className="text-accent animate-pulse">⏳</span>
                    )}
                    {file.status === 'pending' && (
                      <span className="text-text-secondary">⏸</span>
                    )}
                  </span>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-primary truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-text-secondary">→</span>
                      <span className="text-[10px] text-text-secondary truncate">
                        {file.outputName}
                      </span>
                    </div>

                    {/* Per-file progress bar */}
                    {file.status === 'processing' && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-[width] duration-300"
                            style={{ width: `${Math.round(file.progress * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-accent font-mono flex-shrink-0">
                          {Math.round(file.progress * 100)}%
                        </span>
                      </div>
                    )}

                    {/* Error message */}
                    {file.status === 'error' && file.error && (
                      <p className="text-[10px] text-error mt-0.5 truncate" title={file.error}>
                        {file.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Completion summary */}
          {isComplete && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm text-text-primary">
                🎉 批次處理完成！成功 {completedCount} 個
                {errorCount > 0 && <span className="text-error">，失敗 {errorCount} 個</span>}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          {isProcessing ? (
            <button
              onClick={cancelBatch}
              className="px-4 py-2 border border-error/30 rounded-lg text-sm text-error
                         hover:bg-error/10 transition-colors"
            >
              取消全部
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                         transition-colors"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
