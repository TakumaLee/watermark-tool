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
}

/** Supported watermark image extensions */
export const SUPPORTED_WATERMARK_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp',
] as const;

/** Default watermark size as ratio of video width */
export const DEFAULT_WATERMARK_SIZE = 0.15;
