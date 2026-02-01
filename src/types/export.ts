// ===== Platform Export Presets =====

/** Supported export platform IDs */
export type ExportPlatformId =
  | 'youtube'
  | 'instagram_reels'
  | 'tiktok'
  | 'twitter'
  | 'custom'
  | 'gif';

/** Aspect ratio mode */
export type AspectRatioMode = 'pad' | 'crop';

/** Export format */
export type ExportVideoFormat = 'mp4' | 'mov' | 'gif';

/** Export quality level */
export type ExportQualityLevel = 'highest' | 'high' | 'medium' | 'low';

/** GIF FPS options */
export type GifFps = 10 | 15 | 24;

/** Platform export preset definition */
export interface ExportPlatformPreset {
  /** Unique platform ID */
  id: ExportPlatformId;
  /** Display name */
  name: string;
  /** Platform icon (emoji) */
  icon: string;
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Aspect ratio string (e.g., "16:9") */
  aspectRatio: string;
  /** Video codec */
  codec: string;
  /** Audio codec */
  audioCodec: string;
  /** Quality level */
  quality: ExportQualityLevel;
  /** Format */
  format: ExportVideoFormat;
  /** Max duration in seconds (0 = no limit) */
  maxDuration: number;
  /** Description */
  description: string;
}

/** All platform presets */
export const PLATFORM_PRESETS: ExportPlatformPreset[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '📺',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    codec: 'H.264',
    audioCodec: 'AAC',
    quality: 'highest',
    format: 'mp4',
    maxDuration: 0,
    description: '1920×1080 / 16:9 / H.264 / AAC / 最高品質',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    icon: '📸',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'H.264',
    audioCodec: 'AAC',
    quality: 'high',
    format: 'mp4',
    maxDuration: 90,
    description: '1080×1920 / 9:16 / H.264 / AAC',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'H.264',
    audioCodec: 'AAC',
    quality: 'high',
    format: 'mp4',
    maxDuration: 180,
    description: '1080×1920 / 9:16 / H.264 / AAC',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '🐦',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    codec: 'H.264',
    audioCodec: 'AAC',
    quality: 'high',
    format: 'mp4',
    maxDuration: 140,
    description: '1280×720 / 16:9 / 最大 140s',
  },
  {
    id: 'custom',
    name: '自定義',
    icon: '⚙️',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    codec: 'H.264',
    audioCodec: 'AAC',
    quality: 'high',
    format: 'mp4',
    maxDuration: 0,
    description: '自訂解析度 / 格式',
  },
];

// ===== GIF Export Settings =====

/** GIF export settings */
export interface GifExportSettings {
  /** Output width (px) */
  width: number;
  /** Frames per second */
  fps: GifFps;
  /** Color count (2-256) */
  colors: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds (-1 = entire video) */
  endTime: number;
}

/** Default GIF settings */
export const DEFAULT_GIF_SETTINGS: GifExportSettings = {
  width: 480,
  fps: 15,
  colors: 256,
  startTime: 0,
  endTime: -1,
};

/** GIF FPS options */
export const GIF_FPS_OPTIONS: { value: GifFps; label: string }[] = [
  { value: 10, label: '10 FPS' },
  { value: 15, label: '15 FPS' },
  { value: 24, label: '24 FPS' },
];

// ===== Thumbnail / Cover =====

/** Thumbnail format */
export type ThumbnailFormat = 'jpg' | 'png';

/** Thumbnail extract settings */
export interface ThumbnailSettings {
  /** Time position in seconds */
  time: number;
  /** Output format */
  format: ThumbnailFormat;
  /** Quality (1-31 for jpg, lower=better; ignored for png) */
  quality: number;
}

// ===== Export Queue =====

/** Export task status */
export type ExportTaskStatus = 'pending' | 'processing' | 'complete' | 'failed';

/** Export task in the queue */
export interface ExportTask {
  /** Unique task ID */
  id: string;
  /** Platform preset being used */
  platformId: ExportPlatformId;
  /** Platform name for display */
  platformName: string;
  /** Platform icon */
  platformIcon: string;
  /** Output file path */
  outputPath: string;
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Aspect ratio mode */
  aspectMode: AspectRatioMode;
  /** Quality level */
  quality: ExportQualityLevel;
  /** Format */
  format: ExportVideoFormat;
  /** Current status */
  status: ExportTaskStatus;
  /** Progress (0.0 - 1.0) */
  progress: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Render process ID from Rust backend */
  processId?: string;
  /** GIF settings (if format is gif) */
  gifSettings?: GifExportSettings;
}

// ===== Render configs sent to Rust =====

/** Platform export render config for Rust backend */
export interface PlatformExportConfig {
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Aspect ratio mode: "pad" or "crop" */
  aspect_mode: string;
  /** Quality: "highest", "high", "medium", "low" */
  quality: string;
  /** Format: "mp4" or "mov" */
  format: string;
  /** Max duration (0 = no limit) */
  max_duration: number;
}

/** GIF export render config for Rust backend */
export interface GifExportConfig {
  /** Output width */
  width: number;
  /** FPS */
  fps: number;
  /** Color count */
  colors: number;
  /** Start time in seconds */
  start_time: number;
  /** End time in seconds (-1 = entire video) */
  end_time: number;
}

/** Thumbnail extract config for Rust backend */
export interface ThumbnailExportConfig {
  /** Time position in seconds */
  time: number;
  /** Output format: "jpg" or "png" */
  format: string;
  /** Quality (1-31 for jpg) */
  quality: number;
}
