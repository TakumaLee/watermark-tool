import { useState, useCallback } from 'react';
import type { OutputQuality, OutputFormat } from '../../types';
import { useRender } from '../../hooks/useRender';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const QUALITY_OPTIONS: { value: OutputQuality; label: string; desc: string }[] = [
  { value: 'original', label: '原始品質', desc: '檔案最大，無壓縮損失' },
  { value: 'high', label: '高品質', desc: '推薦，接近原始品質' },
  { value: 'medium', label: '中品質', desc: '均衡檔案大小與品質' },
  { value: 'low', label: '低品質', desc: '檔案最小' },
];

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4 (H.264)' },
  { value: 'mov', label: 'MOV (QuickTime)' },
];

export function OutputDialog({ isOpen, onClose }: Props) {
  const [format, setFormat] = useState<OutputFormat>('mp4');
  const [quality, setQuality] = useState<OutputQuality>('high');
  const [isStarting, setIsStarting] = useState(false);

  const { selectOutputPath, startRenderProcess } = useRender();

  const handleStartOutput = useCallback(async () => {
    setIsStarting(true);
    try {
      const outputPath = await selectOutputPath(format);
      if (!outputPath) {
        setIsStarting(false);
        return;
      }

      await startRenderProcess(outputPath, quality);
      onClose();
    } catch (err) {
      console.error('Failed to start render:', err);
    } finally {
      setIsStarting(false);
    }
  }, [format, quality, selectOutputPath, startRenderProcess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[440px] max-h-[90vh] overflow-y-auto
                    animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-medium text-text-primary">輸出設定</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">輸出格式</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as OutputFormat)}
              className="w-full bg-bg-component border border-border rounded-lg px-3 py-2 text-sm
                         text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quality selection */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary font-medium">輸出品質</label>
            <div className="space-y-1.5">
              {QUALITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    quality === opt.value
                      ? 'bg-accent/10 border border-accent/30'
                      : 'hover:bg-bg-component/50 border border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={opt.value}
                    checked={quality === opt.value}
                    onChange={() => setQuality(opt.value)}
                    className="accent-accent mt-0.5 w-3.5 h-3.5"
                  />
                  <div>
                    <span className="text-sm text-text-primary">{opt.label}</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary
                       hover:border-accent hover:text-accent transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleStartOutput}
            disabled={isStarting}
            className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? '準備中...' : '選擇路徑並輸出'}
          </button>
        </div>
      </div>
    </div>
  );
}
