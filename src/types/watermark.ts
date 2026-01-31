/** Movement mode types matching Rust backend */
export type MovementMode =
  | { type: 'Static' }
  | { type: 'Linear'; speed: number; direction: MovementDirection }
  | { type: 'Random'; interval: number; fade_duration: number };

/** Direction for linear movement */
export type MovementDirection = 'horizontal' | 'vertical' | 'diagonal';

/** Speed presets for linear movement */
export type SpeedPreset = 'slow' | 'medium' | 'fast';

/** Speed preset values in px/s */
export const SPEED_PRESET_VALUES: Record<SpeedPreset, number> = {
  slow: 50,
  medium: 120,
  fast: 250,
};

/** Watermark item state */
export interface WatermarkItem {
  /** Unique identifier */
  id: string;
  /** Display name (filename) */
  name: string;
  /** Original file path */
  filePath: string;
  /** Asset URL for display (converted from file path) */
  imageUrl: string;
  /** Original image width in pixels */
  naturalWidth: number;
  /** Original image height in pixels */
  naturalHeight: number;

  /** Position X as ratio (0–1) relative to video */
  x: number;
  /** Position Y as ratio (0–1) relative to video */
  y: number;
  /** Width as ratio (0–1) relative to video width */
  width: number;
  /** Height as ratio (0–1) relative to video height */
  height: number;

  /** Opacity 0–100 */
  opacity: number;
  /** Whether aspect ratio is locked */
  lockAspectRatio: boolean;
  /** Whether "same as above" is enabled (copies opacity + size from previous) */
  sameAsAbove: boolean;
  /** Movement mode for the watermark */
  movement: MovementMode;
}

/** Output quality options */
export type OutputQuality = 'original' | 'high' | 'medium' | 'low';

/** Output format options */
export type OutputFormat = 'mp4' | 'mov';

/** Output settings */
export interface OutputSettings {
  format: OutputFormat;
  quality: OutputQuality;
  outputPath: string;
}

/** Render state */
export type RenderState =
  | { status: 'idle' }
  | { status: 'rendering'; processId: string; progress: number }
  | { status: 'complete'; outputPath: string }
  | { status: 'error'; message: string };

/** Supported watermark image extensions */
export const SUPPORTED_WATERMARK_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp',
] as const;

/** Default watermark size as ratio of video width */
export const DEFAULT_WATERMARK_SIZE = 0.15;
