import { useCallback, useRef, useState, useEffect } from 'react';
import type { TextOverlayItem as TextOverlayItemType } from '../../types/text';
import { useTextStore } from '../../stores/textStore';
import { useVideoStore } from '../../stores/videoStore';

interface Props {
  item: TextOverlayItemType;
  isSelected: boolean;
  /** The actual displayed video rect within the container */
  videoRect: { left: number; top: number; width: number; height: number };
  /** Current video time for time-range visibility */
  currentTime: number;
  /** Video duration */
  videoDuration: number;
}

type ResizeHandle = 'w' | 'e';

export function TextOverlayItem({ item, isSelected, videoRect, currentTime, videoDuration }: Props) {
  const { updateTextItem, selectTextItem } = useTextStore();
  const videoInfo = useVideoStore((s) => s.videoInfo);
  const itemRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Determine visibility based on time range
  const endTime = item.endTime < 0 ? videoDuration : item.endTime;
  const isVisible = currentTime >= item.startTime && currentTime <= endTime;

  // Focus the contentEditable when editing starts
  useEffect(() => {
    if (item.isEditing && editRef.current) {
      editRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [item.isEditing]);

  // Convert ratio coordinates to pixel positions
  const pixelX = item.x * videoRect.width;
  const pixelY = item.y * videoRect.height;
  const pixelW = item.width * videoRect.width;

  // Scale font size relative to video height
  const scaledFontSize = (item.fontSize / 1080) * videoRect.height;

  // --- Drag logic ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (item.isEditing) return; // Don't drag while editing
      e.preventDefault();
      e.stopPropagation();
      selectTextItem(item.id);

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startX = item.x;
      const startY = item.y;

      setIsDragging(true);

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startMouseX) / videoRect.width;
        const dy = (me.clientY - startMouseY) / videoRect.height;
        const newX = Math.max(0, Math.min(1 - item.width, startX + dx));
        const newY = Math.max(0, Math.min(0.95, startY + dy));
        updateTextItem(item.id, { x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [item, videoRect, updateTextItem, selectTextItem],
  );

  // --- Double-click to edit ---
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateTextItem(item.id, { isEditing: true });
    },
    [item.id, updateTextItem],
  );

  // --- ContentEditable blur → save ---
  const handleBlur = useCallback(() => {
    if (editRef.current) {
      const newContent = editRef.current.innerText.trim() || '文字';
      updateTextItem(item.id, { content: newContent, isEditing: false });
    }
  }, [item.id, updateTextItem]);

  // --- ContentEditable keydown ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        updateTextItem(item.id, { isEditing: false });
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        updateTextItem(item.id, { isEditing: false });
      }
      e.stopPropagation(); // Prevent global shortcuts while editing
    },
    [item.id, updateTextItem],
  );

  // --- Width resize (horizontal handles) ---
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();
      selectTextItem(item.id);

      const startMouseX = e.clientX;
      const startX = item.x;
      const startW = item.width;

      setIsResizing(true);

      const handleMouseMove = (me: MouseEvent) => {
        const dx = (me.clientX - startMouseX) / videoRect.width;

        let newX = startX;
        let newW = startW;

        if (handle === 'e') {
          newW = Math.max(0.05, startW + dx);
        } else {
          newW = Math.max(0.05, startW - dx);
          newX = startX + startW - newW;
        }

        newX = Math.max(0, Math.min(1 - newW, newX));
        updateTextItem(item.id, { x: newX, width: newW });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [item, videoRect, updateTextItem, selectTextItem],
  );

  if (!isVisible) return null;

  const bgColorWithAlpha = item.bgOpacity > 0
    ? `${item.bgColor}${Math.round(item.bgOpacity * 2.55).toString(16).padStart(2, '0')}`
    : 'transparent';

  return (
    <div
      ref={itemRef}
      className="absolute select-none"
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        width: `${pixelW}px`,
        cursor: item.isEditing ? 'text' : isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 25 : 15,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Text content */}
      {item.isEditing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          className="outline-none whitespace-pre-wrap break-words"
          style={{
            fontFamily: item.fontFamily,
            fontSize: `${scaledFontSize}px`,
            color: item.color,
            textAlign: item.align,
            WebkitTextStroke: item.strokeWidth > 0
              ? `${(item.strokeWidth / 1080) * videoRect.height}px ${item.strokeColor}`
              : undefined,
            backgroundColor: bgColorWithAlpha,
            padding: '2px 6px',
            borderRadius: '2px',
            lineHeight: 1.3,
            minHeight: `${scaledFontSize * 1.3}px`,
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        >
          {item.content}
        </div>
      ) : (
        <div
          className="whitespace-pre-wrap break-words pointer-events-none"
          style={{
            fontFamily: item.fontFamily,
            fontSize: `${scaledFontSize}px`,
            color: item.color,
            textAlign: item.align,
            WebkitTextStroke: item.strokeWidth > 0
              ? `${(item.strokeWidth / 1080) * videoRect.height}px ${item.strokeColor}`
              : undefined,
            backgroundColor: bgColorWithAlpha,
            padding: '2px 6px',
            borderRadius: '2px',
            lineHeight: 1.3,
          }}
        >
          {item.content}
        </div>
      )}

      {/* Selection border + handles */}
      {isSelected && !item.isEditing && (
        <>
          <div
            className="absolute inset-0 border-2 border-blue-400 border-dashed pointer-events-none"
            style={{ margin: '-1px' }}
          />

          {/* Left resize handle */}
          <div
            className="absolute w-2 h-8 bg-blue-400 border border-white rounded-sm"
            style={{
              left: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'ew-resize',
              zIndex: 30,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
          />

          {/* Right resize handle */}
          <div
            className="absolute w-2 h-8 bg-blue-400 border border-white rounded-sm"
            style={{
              right: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'ew-resize',
              zIndex: 30,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          />

          {/* Label badge */}
          <div className="absolute -top-5 left-0 text-[9px] text-blue-400 bg-bg-primary/80 px-1.5 py-0.5 rounded pointer-events-none">
            📝 文字
          </div>
        </>
      )}

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute inset-0 border-2 border-blue-400/50 bg-blue-400/5 pointer-events-none" />
      )}
    </div>
  );
}
