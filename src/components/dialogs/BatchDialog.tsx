import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useBatch } from '../../hooks/useBatch';
import type { BatchFileItem, BatchNamingMode, BatchOutputMode, OutputQuality } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStarted: () => void;
}

const QUALITY_OPTIONS: { value: OutputQuality; label: string }[] = [
  { value: 'original', label: '原始品質' },
  { value: 'high', label: '高品質' },
  { value: 'medium', label: '中品質' },
  { value: 'low', label: '低品質' },
];

export function BatchDialog({ isOpen, onClose, onStarted }: Props) {
  const [files, setFiles] = useState<BatchFileItem[]>([]);
  const [namingMode, setNamingMode] = useState<BatchNamingMode>('auto');
  const [customPrefix, setCustomPrefix] = useState('');
  const [customSuffix, setCustomSuffix] = useState('_wm');
  const [outputMode, setOutputMode] = useState<BatchOutputMode>('same');
  const [customOutputDir, setCustomOutputDir] = useState('');
  const [quality, setQuality] = useState<OutputQuality>('high');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const { selectVideoFiles, startBatchProcess } = useBatch();

  const handleSelectFiles = useCallback(async () => {
    const selected = await selectVideoFiles();
    if (selected.length > 0) {
      setFiles(selected);
      setError(null);
    }
  }, [selectVideoFiles]);

  const handleToggleFile = useCallback((index: number) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index && f.supported ? { ...f, selected: !f.selected } : f,
      ),
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setFiles((prev) =>
      prev.map((f) => (f.supported ? { ...f, selected: true } : f)),
    );
  }, []);

  const handleDeselectAll = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: false })));
  }, []);

  const handleSelectOutputDir = useCallback(async () => {
    const result = await open({
      title: '選擇輸出資料夾',
      directory: true,
      multiple: false,
    });
    if (result) {
      setCustomOutputDir(result);
    }
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      await startBatchProcess(
        files,
        namingMode,
        customPrefix,
        customSuffix,
        outputMode,
        customOutputDir,
        quality,
      );
      onStarted();
    } catch (err) {
      setError(String(err));
    } finally {
      setStarting(false);
    }
  }, [files, namingMode, customPrefix, customSuffix, outputMode, customOutputDir, quality, startBatchProcess, onStarted]);

  const selectedCount = files.filter((f) => f.selected && f.supported).length;
  const canStart = selectedCount > 0 && !starting;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[540px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-medium text-text-primary">批次處理</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* File selection */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">選取影片</label>
            <button
              onClick={handleSelectFiles}
              className="w-full px-4 py-2.5 border border-dashed border-border rounded-lg text-sm text-text-secondary
                         hover:border-accent hover:text-accent transition-colors text-center"
            >
              📂 選取多個影片檔案...
            </button>

            {/* File list */}
            {files.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    已選取 {selectedCount} / {files.filter((f) => f.supported).length} 個影片
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      全選
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      取消全選
                    </button>
                  </div>
                </div>
                <div className="max-h-[180px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {files.map((file, index) => (
                    <label
                      key={file.path}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm cursor-pointer
                                  transition-colors ${
                                    !file.supported
                                      ? 'opacity-40 cursor-not-allowed'
                                      : file.selected
                                        ? 'bg-accent/10'
                                        : 'hover:bg-bg-component/50'
                                  }`}
                    >
                      <input
                        type="checkbox"
                        checked={file.selected}
                        onChange={() => handleToggleFile(index)}
                        disabled={!file.supported}
                        className="accent-accent w-3.5 h-3.5"
                      />
                      <span className={`flex-1 truncate ${file.supported ? 'text-text-primary' : 'text-text-secondary line-through'}`}>
                        {file.name}
                      </span>
                      {!file.supported && (
                        <span className="text-[10px] text-warning">(不支援)</span>
                      )}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Naming mode */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">命名方式</label>
            <div className="space-y-1.5">
              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                namingMode === 'auto' ? 'bg-accent/10 border border-accent/30' : 'border border-transparent hover:bg-bg-component/50'
              }`}>
                <input
                  type="radio"
                  name="naming"
                  checked={namingMode === 'auto'}
                  onChange={() => setNamingMode('auto')}
                  className="accent-accent w-3.5 h-3.5"
                />
                <div>
                  <span className="text-sm text-text-primary">自動命名</span>
                  <p className="text-[11px] text-text-secondary">原檔名 + _watermarked</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                namingMode === 'prefix' ? 'bg-accent/10 border border-accent/30' : 'border border-transparent hover:bg-bg-component/50'
              }`}>
                <input
                  type="radio"
                  name="naming"
                  checked={namingMode === 'prefix'}
                  onChange={() => setNamingMode('prefix')}
                  className="accent-accent w-3.5 h-3.5"
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-text-primary">自訂前綴</span>
                  {namingMode === 'prefix' && (
                    <input
                      type="text"
                      value={customPrefix}
                      onChange={(e) => setCustomPrefix(e.target.value)}
                      placeholder="prefix_"
                      className="bg-bg-component border border-border rounded px-2 py-1 text-xs
                                 text-text-primary w-28 focus:outline-none focus:border-accent"
                    />
                  )}
                </div>
              </label>

              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                namingMode === 'suffix' ? 'bg-accent/10 border border-accent/30' : 'border border-transparent hover:bg-bg-component/50'
              }`}>
                <input
                  type="radio"
                  name="naming"
                  checked={namingMode === 'suffix'}
                  onChange={() => setNamingMode('suffix')}
                  className="accent-accent w-3.5 h-3.5"
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-text-primary">自訂後綴</span>
                  {namingMode === 'suffix' && (
                    <input
                      type="text"
                      value={customSuffix}
                      onChange={(e) => setCustomSuffix(e.target.value)}
                      placeholder="_wm"
                      className="bg-bg-component border border-border rounded px-2 py-1 text-xs
                                 text-text-primary w-28 focus:outline-none focus:border-accent"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Output folder */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">輸出資料夾</label>
            <div className="space-y-1.5">
              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                outputMode === 'same' ? 'bg-accent/10 border border-accent/30' : 'border border-transparent hover:bg-bg-component/50'
              }`}>
                <input
                  type="radio"
                  name="output"
                  checked={outputMode === 'same'}
                  onChange={() => setOutputMode('same')}
                  className="accent-accent w-3.5 h-3.5"
                />
                <span className="text-sm text-text-primary">與原檔相同資料夾</span>
              </label>

              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                outputMode === 'custom' ? 'bg-accent/10 border border-accent/30' : 'border border-transparent hover:bg-bg-component/50'
              }`}>
                <input
                  type="radio"
                  name="output"
                  checked={outputMode === 'custom'}
                  onChange={() => setOutputMode('custom')}
                  className="accent-accent w-3.5 h-3.5"
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-text-primary">自訂路徑</span>
                  {outputMode === 'custom' && (
                    <button
                      onClick={handleSelectOutputDir}
                      className="px-3 py-1 text-xs border border-border rounded text-text-secondary
                                 hover:border-accent hover:text-accent transition-colors"
                    >
                      {customOutputDir ? customOutputDir.split('/').pop() : '瀏覽...'}
                    </button>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">輸出品質</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as OutputQuality)}
              className="w-full bg-bg-component border border-border rounded-lg px-3 py-2 text-sm
                         text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary
                       hover:border-accent hover:text-accent transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {starting ? '準備中...' : `開始批次處理 (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
