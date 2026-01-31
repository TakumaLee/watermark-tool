import { useVideoImport } from '../../hooks/useVideoImport';

interface EmptyStateProps {
  isDragOver: boolean;
}

export function EmptyState({ isDragOver }: EmptyStateProps) {
  const { importFromDialog } = useVideoImport();

  return (
    <div
      className={`flex flex-col items-center justify-center h-full transition-colors duration-200 ${
        isDragOver
          ? 'bg-accent/10 border-2 border-dashed border-accent rounded-lg'
          : ''
      }`}
    >
      <div className="text-6xl mb-6 opacity-60">📂</div>
      <h2 className="text-xl font-medium text-text-primary mb-2">
        拖放影片到此處
      </h2>
      <p className="text-text-secondary mb-6">
        或點擊下方「匯入影片」按鈕
      </p>
      <p className="text-text-secondary text-xs mb-8">
        支援格式：MP4 MOV AVI MKV WMV FLV WEBM
      </p>
      <button
        onClick={importFromDialog}
        className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg
                   transition-colors duration-150 font-medium text-sm"
      >
        📂 選擇影片檔案
      </button>
    </div>
  );
}
