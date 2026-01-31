import type { WatermarkItem, OutputQuality } from './watermark';

/** Preset config file schema version */
export const PRESET_SCHEMA_VERSION = 1;

/** Watermark configuration stored in preset (without runtime fields like imageUrl) */
export interface PresetWatermarkConfig {
  /** Display name */
  name: string;
  /** Original file path */
  filePath: string;
  /** Position and size (ratio 0-1) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Opacity 0-100 */
  opacity: number;
  /** Lock aspect ratio */
  lockAspectRatio: boolean;
  /** Same as above flag */
  sameAsAbove: boolean;
  /** Movement mode */
  movement: WatermarkItem['movement'];
}

/** JSON schema for preset config files */
export interface PresetConfig {
  /** Schema version for future migration */
  version: number;
  /** Preset display name */
  name: string;
  /** Creation timestamp ISO string */
  createdAt: string;
  /** Watermark configurations */
  watermarks: PresetWatermarkConfig[];
}

/** Preset metadata returned from Rust backend */
export interface PresetInfo {
  name: string;
  path: string;
  watermark_count: number;
  modified: string;
}

/** Batch processing naming mode */
export type BatchNamingMode = 'auto' | 'prefix' | 'suffix';

/** Batch processing output folder mode */
export type BatchOutputMode = 'same' | 'custom';

/** Batch file item for the batch dialog */
export interface BatchFileItem {
  /** Full file path */
  path: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** Whether this file is selected */
  selected: boolean;
  /** Whether this is a supported video file */
  supported: boolean;
}

/** Batch processing settings */
export interface BatchSettings {
  files: BatchFileItem[];
  namingMode: BatchNamingMode;
  customPrefix: string;
  customSuffix: string;
  outputMode: BatchOutputMode;
  customOutputDir: string;
  quality: OutputQuality;
}

/** Batch progress event from Rust */
export interface BatchProgressEvent {
  batch_id: string;
  current_index: number;
  total_count: number;
  file_progress: number;
  file_status: 'processing' | 'complete' | 'error';
  error_message: string | null;
  batch_complete: boolean;
}

/** Per-file batch status for UI display */
export interface BatchFileStatus {
  path: string;
  name: string;
  outputName: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
}
