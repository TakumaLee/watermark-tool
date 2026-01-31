import { useState, useEffect, useCallback } from 'react';
import { usePreset } from '../../hooks/usePreset';
import type { PresetInfo } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PresetDialog({ isOpen, onClose }: Props) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [presetName, setPresetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { savePreset, quickSavePreset, loadPresetFromDialog, loadPresetFromPath, listPresets, deletePreset } = usePreset();

  // Load presets when dialog opens
  useEffect(() => {
    if (isOpen) {
      refreshPresets();
    }
  }, [isOpen]);

  const refreshPresets = useCallback(async () => {
    try {
      const list = await listPresets();
      setPresets(list);
    } catch (err) {
      console.warn('Failed to list presets:', err);
    }
  }, [listPresets]);

  const handleSaveToFile = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const success = await savePreset(presetName || undefined);
      if (success) {
        onClose();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [savePreset, presetName, onClose]);

  const handleQuickSave = useCallback(async () => {
    if (!presetName.trim()) {
      setError('請輸入設定名稱');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await quickSavePreset(presetName.trim());
      setPresetName('');
      await refreshPresets();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [quickSavePreset, presetName, refreshPresets]);

  const handleLoadFromFile = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const success = await loadPresetFromDialog();
      if (success) {
        onClose();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loadPresetFromDialog, onClose]);

  const handleLoadPreset = useCallback(async (path: string) => {
    setError(null);
    setLoading(true);
    try {
      await loadPresetFromPath(path);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loadPresetFromPath, onClose]);

  const handleDeletePreset = useCallback(async (path: string) => {
    try {
      await deletePreset(path);
      await refreshPresets();
    } catch (err) {
      setError(String(err));
    }
  }, [deletePreset, refreshPresets]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-medium text-text-primary">浮水印設定</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveToFile}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              儲存為檔案...
            </button>
            <button
              onClick={handleLoadFromFile}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm text-text-primary
                         hover:border-accent hover:text-accent transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              從檔案載入...
            </button>
          </div>

          {/* Quick save to app data */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">快速儲存</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="輸入設定名稱..."
                className="flex-1 bg-bg-component border border-border rounded-lg px-3 py-2 text-sm
                           text-text-primary placeholder-text-secondary/50
                           focus:outline-none focus:border-accent transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickSave();
                }}
              />
              <button
                onClick={handleQuickSave}
                disabled={loading || !presetName.trim()}
                className="px-4 py-2 bg-bg-component border border-border rounded-lg text-sm text-text-primary
                           hover:border-accent hover:text-accent transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                儲存
              </button>
            </div>
          </div>

          {/* Saved presets list */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">
              已儲存的設定 ({presets.length})
            </label>
            {presets.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">
                尚無已儲存的設定
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.path}
                    className="flex items-center justify-between p-3 bg-bg-component/50 rounded-lg
                               border border-transparent hover:border-border transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">
                        📄 {preset.name}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {preset.watermark_count} 個浮水印 · {preset.modified}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                      <button
                        onClick={() => handleLoadPreset(preset.path)}
                        disabled={loading}
                        className="px-3 py-1 text-xs text-accent border border-accent/30 rounded
                                   hover:bg-accent/10 transition-colors
                                   disabled:opacity-50"
                      >
                        載入
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.path)}
                        disabled={loading}
                        className="px-3 py-1 text-xs text-error/70 border border-error/20 rounded
                                   hover:bg-error/10 hover:text-error transition-colors
                                   disabled:opacity-50"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary
                       hover:border-accent hover:text-accent transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
