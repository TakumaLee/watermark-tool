import { useState } from 'react';
import { useLicenseStore } from '../../stores/licenseStore';

export function LicenseDialog() {
  const { dialogOpen, setDialogOpen, validateKey, isLoading, error, license } = useLicenseStore();
  const [key, setKey] = useState('');
  const [success, setSuccess] = useState(false);

  if (!dialogOpen) return null;

  const handleValidate = async () => {
    setSuccess(false);
    const valid = await validateKey(key);
    if (valid) {
      setSuccess(true);
      setTimeout(() => {
        setDialogOpen(false);
        setKey('');
        setSuccess(false);
      }, 1500);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setKey('');
    setSuccess(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary border border-border rounded-lg w-[420px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">🔑 輸入授權碼</h3>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {success ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-green-400">授權成功！已解鎖 Pro 功能</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-text-secondary">
                輸入授權碼以解鎖浮水印移除等 Pro 功能。
                格式：WMT-PRO-XXXX-XXXX-XXXX
              </p>

              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="WMT-PRO-XXXX-XXXX-XXXX"
                className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent font-mono tracking-wider"
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                disabled={isLoading}
              />

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {license.is_valid && (
                <p className="text-xs text-green-400">
                  ✅ 目前已授權（{license.tier.toUpperCase()}）
                </p>
              )}

              <a
                href="#"
                className="text-xs text-accent hover:underline"
              >
                哪裡取得授權碼？
              </a>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleValidate}
              disabled={isLoading || !key.trim()}
              className="px-4 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {isLoading ? '驗證中...' : '驗證'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
