import { useState, useEffect } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useVideoStore } from '../../stores/videoStore';
import { useVideoImport } from '../../hooks/useVideoImport';
import { EmptyState } from './EmptyState';
import { VideoPlayer } from './VideoPlayer';
import { LoadingState } from './LoadingState';

interface VideoPreviewProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export function VideoPreview({ videoRef }: VideoPreviewProps) {
  const { videoUrl, isLoading, error } = useVideoStore();
  const { importFromPath } = useVideoImport();
  const [isDragOver, setIsDragOver] = useState(false);

  // Listen for Tauri native drag-and-drop events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const { type } = event.payload;
        if (type === 'enter' || type === 'over') {
          setIsDragOver(true);
        } else if (type === 'drop') {
          setIsDragOver(false);
          const paths = event.payload.paths;
          if (paths.length > 0) {
            importFromPath(paths[0]);
          }
        } else if (type === 'leave') {
          setIsDragOver(false);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [importFromPath]);

  return (
    <div className="flex-1 flex flex-col p-4 min-w-0">
      {/* Error toast */}
      {error && (
        <div
          className="mb-3 px-4 py-2.5 bg-error/15 border border-error/30 rounded-lg
                      text-error text-sm flex items-center justify-between"
        >
          <span>⚠ {error}</span>
          <button
            onClick={() => useVideoStore.getState().setError(null)}
            className="ml-3 text-error/70 hover:text-error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content area */}
      <div
        className={`flex-1 min-h-0 rounded-lg transition-all duration-200 ${
          isDragOver ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''
        }`}
      >
        {isLoading ? (
          <LoadingState />
        ) : videoUrl ? (
          <VideoPlayer videoRef={videoRef} />
        ) : (
          <EmptyState isDragOver={isDragOver} />
        )}
      </div>
    </div>
  );
}
