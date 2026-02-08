import { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVideoStore } from '../../stores/videoStore';

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

interface DragState {
  index: number;
  type: 'move' | 'resize';
  startX: number;
  startY: number;
  origRegion: DetectedRegion;
}

// Check if running inside Tauri
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

export function WatermarkRemover() {
  const { videoPath, videoUrl, videoInfo } = useVideoStore();
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeProgress, setRemoveProgress] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const drawingRef = useRef<{ startX: number; startY: number } | null>(null);

  const videoWidth = videoInfo?.width ?? 1920;
  const videoHeight = videoInfo?.height ?? 1080;

  // Scale factor from display to actual video coords
  const getScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { sx: 1, sy: 1 };
    const rect = container.getBoundingClientRect();
    return {
      sx: videoWidth / rect.width,
      sy: videoHeight / rect.height,
    };
  }, [videoWidth, videoHeight]);

  const handleDetect = async () => {
    if (!videoPath || !isTauri) return;
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await invoke<DetectedRegion[]>('detect_watermark', {
        input: videoPath,
        frames: 30,
        threshold: 15.0,
      });
      setRegions(detected);
      if (detected.length === 0) {
        setError('未偵測到浮水印區域，可切換至手動模式自行框選');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRemove = async () => {
    if (!videoPath || regions.length === 0 || !isTauri) return;
    setIsRemoving(true);
    setRemoveProgress(0);
    setError(null);
    setResultPath(null);

    try {
      const ext = videoPath.split('.').pop() || 'mp4';
      const outputPath = videoPath.replace(`.${ext}`, `_no_watermark.${ext}`);

      // Use the first region for now (backend supports single region)
      const r = regions[0];
      const processId = await invoke<string>('remove_watermark', {
        input: videoPath,
        output: outputPath,
        maskX: r.x,
        maskY: r.y,
        maskWidth: r.width,
        maskHeight: r.height,
        quality: 'high',
      });

      // Poll progress
      const pollInterval = setInterval(async () => {
        try {
          const progress = await invoke<number>('get_render_progress', { processId });
          setRemoveProgress(Math.round(progress * 100));
          if (progress >= 1.0) {
            clearInterval(pollInterval);
            setIsRemoving(false);
            setResultPath(outputPath);
          }
        } catch {
          // still running
        }
      }, 1000);
    } catch (e) {
      setError(String(e));
      setIsRemoving(false);
    }
  };

  const deleteRegion = (index: number) => {
    setRegions((prev) => prev.filter((_, i) => i !== index));
  };

  // Manual drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!manualMode) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { sx, sy } = getScale();
    drawingRef.current = {
      startX: (e.clientX - rect.left) * sx,
      startY: (e.clientY - rect.top) * sy,
    };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawingRef.current || !manualMode) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { sx, sy } = getScale();
    const endX = (e.clientX - rect.left) * sx;
    const endY = (e.clientY - rect.top) * sy;
    const { startX, startY } = drawingRef.current;
    drawingRef.current = null;

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w > 10 && h > 10) {
      setRegions((prev) => [
        ...prev,
        { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) },
      ]);
    }
  };

  // Region drag to move
  const handleRegionMouseDown = (e: React.MouseEvent, index: number, type: 'move' | 'resize') => {
    e.stopPropagation();
    dragRef.current = {
      index,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origRegion: { ...regions[index] },
    };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { sx, sy } = getScale();
      const dx = (ev.clientX - d.startX) * sx;
      const dy = (ev.clientY - d.startY) * sy;

      setRegions((prev) => {
        const updated = [...prev];
        if (d.type === 'move') {
          updated[d.index] = {
            ...d.origRegion,
            x: Math.max(0, Math.round(d.origRegion.x + dx)),
            y: Math.max(0, Math.round(d.origRegion.y + dy)),
          };
        } else {
          updated[d.index] = {
            ...d.origRegion,
            width: Math.max(20, Math.round(d.origRegion.width + dx)),
            height: Math.max(20, Math.round(d.origRegion.height + dy)),
          };
        }
        return updated;
      });
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const hasVideo = !!videoPath;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-text-primary">🧹 浮水印移除</h3>

      {!hasVideo && (
        <p className="text-xs text-text-secondary">請先載入影片</p>
      )}

      {hasVideo && (
        <>
          {/* Video preview with region overlay */}
          <div
            ref={containerRef}
            className="relative w-full bg-black rounded overflow-hidden cursor-crosshair"
            style={{ aspectRatio: `${videoWidth}/${videoHeight}` }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                muted
              />
            )}

            {/* Region overlays */}
            {regions.map((r, i) => {
              const style = {
                left: `${(r.x / videoWidth) * 100}%`,
                top: `${(r.y / videoHeight) * 100}%`,
                width: `${(r.width / videoWidth) * 100}%`,
                height: `${(r.height / videoHeight) * 100}%`,
              };
              return (
                <div
                  key={i}
                  className="absolute border-2 border-dashed border-red-500 bg-red-500/10 group"
                  style={style}
                  onMouseDown={(e) => handleRegionMouseDown(e, i, 'move')}
                >
                  {/* Delete button */}
                  <button
                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); deleteRegion(i); }}
                  >
                    ×
                  </button>
                  {/* Resize handle */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleRegionMouseDown(e, i, 'resize')}
                  />
                  {/* Label */}
                  <span className="absolute top-0 left-1 text-[8px] text-red-400">
                    {r.confidence ? `${Math.round(r.confidence * 100)}%` : `#${i + 1}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => setManualMode(e.target.checked)}
                className="rounded"
              />
              手動框選
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDetect}
              disabled={isDetecting || isRemoving}
              className="flex-1 px-3 py-1.5 text-xs bg-bg-primary border border-border rounded hover:border-accent transition-colors disabled:opacity-50"
            >
              {isDetecting ? '偵測中...' : '🔍 自動偵測'}
            </button>
            <button
              onClick={handleRemove}
              disabled={isRemoving || regions.length === 0}
              className="flex-1 px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {isRemoving ? '移除中...' : '🧹 開始移除'}
            </button>
          </div>

          {/* Progress */}
          {isRemoving && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-bg-primary rounded overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${removeProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-text-secondary text-center">{removeProgress}%</p>
            </div>
          )}

          {/* Regions list */}
          {regions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-text-secondary">偵測到 {regions.length} 個區域：</p>
              {regions.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] text-text-secondary bg-bg-primary px-2 py-1 rounded">
                  <span>#{i + 1}: {r.x},{r.y} → {r.width}×{r.height}</span>
                  <button
                    onClick={() => deleteRegion(i)}
                    className="text-red-400 hover:text-red-300"
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {resultPath && (
            <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
              <p className="text-xs text-green-400">✅ 浮水印移除完成！</p>
              <p className="text-[10px] text-text-secondary mt-1 break-all">{resultPath}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
