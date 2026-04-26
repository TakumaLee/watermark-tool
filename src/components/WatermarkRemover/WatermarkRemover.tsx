import { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVideoStore } from '../../stores/videoStore';

interface Region {
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
  origRegion: Region;
}

interface DrawRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const isTauri =
  typeof window !== 'undefined' &&
  !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

export function WatermarkRemover() {
  const { videoPath, videoUrl, videoInfo } = useVideoStore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeProgress, setRemoveProgress] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const videoWidth = videoInfo?.width ?? 1920;
  const videoHeight = videoInfo?.height ?? 1080;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const getScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { sx: 1, sy: 1 };
    const rect = container.getBoundingClientRect();
    return {
      sx: videoWidth / rect.width,
      sy: videoHeight / rect.height,
    };
  }, [videoWidth, videoHeight]);

  const toVideoCoords = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const { sx, sy } = getScale();

    const rawX = (clientX - rect.left) * sx;
    const rawY = (clientY - rect.top) * sy;

    return {
      x: clamp(rawX, 0, videoWidth),
      y: clamp(rawY, 0, videoHeight),
    };
  }, [getScale, videoWidth, videoHeight]);

  const handleDetect = async () => {
    if (!videoPath || !isTauri) return;

    setIsDetecting(true);
    setError(null);
    setResultPath(null);
    setStatusText('分析影片浮水印中...');

    try {
      const detected = await invoke<Region[]>('detect_watermark', {
        input: videoPath,
        frames: 30,
        threshold: 15.0,
      });

      setRegions(detected);
      if (detected.length === 0) {
        setStatusText('未偵測到浮水印，請切換手動框選。');
      } else {
        setStatusText(`已偵測到 ${detected.length} 個區域。`);
      }
    } catch (e) {
      setError(String(e));
      setStatusText('');
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
    setStatusText('啟動浮水印移除...');

    let pollInterval: number | null = null;

    try {
      const ext = videoPath.split('.').pop() || 'mp4';
      const outputPath = videoPath.replace(new RegExp(`\\.${ext}$`), `_no_watermark.${ext}`);
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

      setStatusText('處理中，請稍候...');

      pollInterval = window.setInterval(async () => {
        try {
          const progress = await invoke<number>('get_render_progress', { processId });
          const percent = Math.round(progress * 100);
          setRemoveProgress(percent);

          if (progress >= 1) {
            if (pollInterval !== null) {
              window.clearInterval(pollInterval);
            }
            setIsRemoving(false);
            setResultPath(outputPath);
            setStatusText('浮水印移除完成！');
          }
        } catch {
          // keep polling until backend updates progress map
        }
      }, 1000);
    } catch (e) {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
      }
      setError(String(e));
      setStatusText('');
      setIsRemoving(false);
    }
  };

  const deleteRegion = (index: number) => {
    setRegions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!manualMode) return;
    const point = toVideoCoords(e.clientX, e.clientY);
    if (!point) return;

    setDrawRect({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!manualMode || !drawRect) return;
    const point = toVideoCoords(e.clientX, e.clientY);
    if (!point) return;

    setDrawRect((prev) => (prev ? { ...prev, currentX: point.x, currentY: point.y } : null));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!manualMode || !drawRect) return;

    const point = toVideoCoords(e.clientX, e.clientY);
    const endX = point?.x ?? drawRect.currentX;
    const endY = point?.y ?? drawRect.currentY;

    const x = Math.min(drawRect.startX, endX);
    const y = Math.min(drawRect.startY, endY);
    const w = Math.abs(endX - drawRect.startX);
    const h = Math.abs(endY - drawRect.startY);

    setDrawRect(null);

    if (w >= 10 && h >= 10) {
      setRegions((prev) => [
        ...prev,
        { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) },
      ]);
      setStatusText(`已新增選取區域 (${Math.round(w)}×${Math.round(h)})`);
    }
  };

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
        if (!updated[d.index]) return prev;

        if (d.type === 'move') {
          updated[d.index] = {
            ...d.origRegion,
            x: clamp(Math.round(d.origRegion.x + dx), 0, videoWidth - d.origRegion.width),
            y: clamp(Math.round(d.origRegion.y + dy), 0, videoHeight - d.origRegion.height),
          };
        } else {
          updated[d.index] = {
            ...d.origRegion,
            width: clamp(Math.round(d.origRegion.width + dx), 20, videoWidth - d.origRegion.x),
            height: clamp(Math.round(d.origRegion.height + dy), 20, videoHeight - d.origRegion.y),
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

  const drawingRegion = drawRect
    ? {
        x: Math.min(drawRect.startX, drawRect.currentX),
        y: Math.min(drawRect.startY, drawRect.currentY),
        width: Math.abs(drawRect.currentX - drawRect.startX),
        height: Math.abs(drawRect.currentY - drawRect.startY),
      }
    : null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-text-primary">🧹 浮水印移除</h3>

      {!hasVideo && <p className="text-xs text-text-secondary">請先載入影片</p>}

      {hasVideo && (
        <>
          <div
            ref={containerRef}
            className="relative w-full bg-black rounded overflow-hidden cursor-crosshair"
            style={{ aspectRatio: `${videoWidth}/${videoHeight}` }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {videoUrl && <video src={videoUrl} className="w-full h-full object-contain" muted />}

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
                  <button
                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRegion(i);
                    }}
                  >
                    ×
                  </button>

                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleRegionMouseDown(e, i, 'resize')}
                  />

                  <span className="absolute top-0 left-1 text-[8px] text-red-400">
                    {r.confidence ? `${Math.round(r.confidence * 100)}%` : `#${i + 1}`}
                  </span>
                </div>
              );
            })}

            {drawingRegion && (
              <div
                className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/10 pointer-events-none"
                style={{
                  left: `${(drawingRegion.x / videoWidth) * 100}%`,
                  top: `${(drawingRegion.y / videoHeight) * 100}%`,
                  width: `${(drawingRegion.width / videoWidth) * 100}%`,
                  height: `${(drawingRegion.height / videoHeight) * 100}%`,
                }}
              />
            )}
          </div>

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
            <span className="text-[10px] text-text-secondary">拖曳滑鼠即可框選浮水印區域</span>
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
              {isRemoving ? '移除中...' : '🧹 移除浮水印'}
            </button>
          </div>

          {isRemoving && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-bg-primary rounded overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${removeProgress}%` }} />
              </div>
              <p className="text-[10px] text-text-secondary text-center">{removeProgress}%</p>
            </div>
          )}

          {regions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-text-secondary">已選取 {regions.length} 個區域：</p>
              {regions.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[10px] text-text-secondary bg-bg-primary px-2 py-1 rounded"
                >
                  <span>
                    #{i + 1}: x={r.x}, y={r.y}, w={r.width}, h={r.height}
                  </span>
                  <button onClick={() => deleteRegion(i)} className="text-red-400 hover:text-red-300">
                    刪除
                  </button>
                </div>
              ))}
            </div>
          )}

          {statusText && <p className="text-[10px] text-text-secondary">{statusText}</p>}

          {resultPath && (
            <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
              <p className="text-xs text-green-400">✅ 浮水印移除完成！</p>
              <p className="text-[10px] text-text-secondary mt-1 break-all">{resultPath}</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
