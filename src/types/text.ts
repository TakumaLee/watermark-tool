/** Text alignment options */
export type TextAlign = 'left' | 'center' | 'right';

/** Built-in font options */
export interface FontOption {
  /** Display name */
  name: string;
  /** Font family CSS value */
  family: string;
  /** Path hint for FFmpeg (resolved at export time) */
  ffmpegName: string;
}

/** Built-in fonts list */
export const BUILT_IN_FONTS: FontOption[] = [
  { name: 'Noto Sans TC', family: 'Noto Sans TC, sans-serif', ffmpegName: 'NotoSansTC' },
  { name: 'Noto Serif TC', family: 'Noto Serif TC, serif', ffmpegName: 'NotoSerifTC' },
  { name: 'Arial', family: 'Arial, Helvetica, sans-serif', ffmpegName: 'Arial' },
  { name: 'Times New Roman', family: 'Times New Roman, serif', ffmpegName: 'TimesNewRoman' },
  { name: 'Courier New', family: 'Courier New, monospace', ffmpegName: 'CourierNew' },
  { name: 'Impact', family: 'Impact, sans-serif', ffmpegName: 'Impact' },
  { name: 'Comic Sans MS', family: 'Comic Sans MS, cursive', ffmpegName: 'ComicSansMS' },
  { name: 'PingFang TC', family: 'PingFang TC, sans-serif', ffmpegName: 'PingFangTC' },
];

/** Text overlay item state */
export interface TextOverlayItem {
  /** Unique identifier */
  id: string;
  /** Text content */
  content: string;
  /** Font family (from BUILT_IN_FONTS) */
  fontFamily: string;
  /** Font size in px (relative to preview; stored as ratio for export) */
  fontSize: number;
  /** Text color (hex string, e.g. '#ffffff') */
  color: string;
  /** Stroke/outline color */
  strokeColor: string;
  /** Stroke width in px */
  strokeWidth: number;
  /** Background color with alpha (hex + alpha, e.g. '#000000' with bgOpacity) */
  bgColor: string;
  /** Background opacity 0-100 */
  bgOpacity: number;
  /** Text alignment */
  align: TextAlign;
  /** Position X as ratio (0-1) relative to video */
  x: number;
  /** Position Y as ratio (0-1) relative to video */
  y: number;
  /** Width as ratio (0-1) relative to video width (auto-sized, but draggable) */
  width: number;
  /** Start time in seconds (when text appears) */
  startTime: number;
  /** End time in seconds (when text disappears; -1 = entire video) */
  endTime: number;
  /** Whether this text item is currently being edited */
  isEditing: boolean;
}

/** SRT subtitle entry */
export interface SubtitleEntry {
  /** Sequence number (1-based) */
  index: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Subtitle text (can be multi-line) */
  text: string;
}

/** Subtitle style configuration */
export interface SubtitleStyle {
  /** Font family */
  fontFamily: string;
  /** Font size in px */
  fontSize: number;
  /** Text color (hex) */
  color: string;
  /** Stroke color (hex) */
  strokeColor: string;
  /** Stroke width */
  strokeWidth: number;
  /** Background color */
  bgColor: string;
  /** Background opacity 0-100 */
  bgOpacity: number;
  /** Vertical position ratio (0=top, 1=bottom) — default 0.9 (near bottom) */
  positionY: number;
}

/** Default subtitle style */
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Noto Sans TC, sans-serif',
  fontSize: 28,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  bgColor: '#000000',
  bgOpacity: 50,
  positionY: 0.85,
};

/** Default text overlay values */
export const DEFAULT_TEXT_OVERLAY: Omit<TextOverlayItem, 'id'> = {
  content: '文字',
  fontFamily: 'Noto Sans TC, sans-serif',
  fontSize: 32,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 0,
  bgColor: '#000000',
  bgOpacity: 0,
  align: 'center',
  x: 0.35,
  y: 0.4,
  width: 0.3,
  startTime: 0,
  endTime: -1,
  isEditing: false,
};

/** Text config sent to Rust for FFmpeg rendering */
export interface TextRenderConfig {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  bgOpacity: number;
  align: string;
  x: number;
  y: number;
  startTime: number;
  endTime: number;
}

/** Subtitle render config sent to Rust */
export interface SubtitleRenderConfig {
  /** SRT content as string */
  srtContent: string;
  /** Style settings */
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  positionY: number;
}
