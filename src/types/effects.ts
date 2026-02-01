// ===== Transition Types =====

/** Available transition types */
export type TransitionType = 'fade' | 'slideleft' | 'slideright' | 'zoomin' | 'dissolve';

/** Transition duration options (seconds) */
export type TransitionDuration = 0.5 | 1 | 1.5 | 2;

/** Transition between two clips */
export interface ClipTransition {
  /** Transition type */
  type: TransitionType;
  /** Duration in seconds */
  duration: TransitionDuration;
}

/** Transition definition for display */
export interface TransitionDefinition {
  type: TransitionType;
  name: string;
  icon: string;
  /** FFmpeg xfade transition name */
  ffmpegName: string;
}

/** All available transitions */
export const ALL_TRANSITIONS: TransitionDefinition[] = [
  { type: 'fade', name: '淡入淡出', icon: '🌅', ffmpegName: 'fade' },
  { type: 'slideleft', name: '左滑', icon: '⬅️', ffmpegName: 'slideleft' },
  { type: 'slideright', name: '右滑', icon: '➡️', ffmpegName: 'slideright' },
  { type: 'zoomin', name: '縮放', icon: '🔍', ffmpegName: 'zoomin' },
  { type: 'dissolve', name: '溶解', icon: '✨', ffmpegName: 'dissolve' },
];

/** Available transition durations */
export const TRANSITION_DURATIONS: TransitionDuration[] = [0.5, 1, 1.5, 2];

// ===== Filter Types =====

/** Filter adjustment values */
export interface FilterAdjustments {
  /** Brightness: -1.0 to 1.0 (0 = default) */
  brightness: number;
  /** Contrast: 0.0 to 3.0 (1.0 = default) */
  contrast: number;
  /** Saturation: 0.0 to 3.0 (1.0 = default) */
  saturation: number;
}

/** Default filter values */
export const DEFAULT_FILTER_ADJUSTMENTS: FilterAdjustments = {
  brightness: 0,
  contrast: 1.0,
  saturation: 1.0,
};

/** Preset filter template */
export interface FilterPreset {
  id: string;
  name: string;
  icon: string;
  adjustments: FilterAdjustments;
}

/** All filter presets */
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'none',
    name: '無濾鏡',
    icon: '🚫',
    adjustments: { brightness: 0, contrast: 1.0, saturation: 1.0 },
  },
  {
    id: 'warm',
    name: '暖色調',
    icon: '🌞',
    adjustments: { brightness: 0.05, contrast: 1.1, saturation: 1.3 },
  },
  {
    id: 'cool',
    name: '冷色調',
    icon: '❄️',
    adjustments: { brightness: -0.02, contrast: 1.1, saturation: 0.8 },
  },
  {
    id: 'bw',
    name: '黑白',
    icon: '🖤',
    adjustments: { brightness: 0, contrast: 1.2, saturation: 0 },
  },
  {
    id: 'vintage',
    name: '復古',
    icon: '📷',
    adjustments: { brightness: 0.05, contrast: 0.9, saturation: 0.7 },
  },
  {
    id: 'cinematic',
    name: '電影感',
    icon: '🎬',
    adjustments: { brightness: -0.05, contrast: 1.3, saturation: 0.85 },
  },
  {
    id: 'vivid',
    name: '鮮豔',
    icon: '🌈',
    adjustments: { brightness: 0.03, contrast: 1.15, saturation: 1.6 },
  },
  {
    id: 'soft',
    name: '柔和',
    icon: '🌸',
    adjustments: { brightness: 0.08, contrast: 0.85, saturation: 0.9 },
  },
];

// ===== Speed Types =====

/** Available speed values */
export type SpeedValue = 0.25 | 0.5 | 1 | 1.5 | 2 | 4;

/** All available speed options */
export const SPEED_OPTIONS: { value: SpeedValue; label: string }[] = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
];

// ===== PiP Types =====

/** Picture-in-Picture configuration */
export interface PiPConfig {
  /** Unique ID */
  id: string;
  /** Source file path */
  sourcePath: string;
  /** Source URL for preview */
  sourceUrl: string;
  /** File name for display */
  name: string;
  /** Proportional x position (0-1) */
  x: number;
  /** Proportional y position (0-1) */
  y: number;
  /** Proportional width (0-1) */
  width: number;
  /** Proportional height (0-1) */
  height: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds (-1 = entire duration) */
  endTime: number;
  /** Original aspect ratio for lock */
  aspectRatio: number;
}

// ===== Crop/Rotate/Flip Types =====

/** Rotation angle */
export type RotationAngle = 0 | 90 | 180 | 270;

/** Flip direction */
export type FlipDirection = 'none' | 'horizontal' | 'vertical' | 'both';

/** Crop region (proportional 0-1) */
export interface CropRegion {
  /** Left offset (0-1) */
  x: number;
  /** Top offset (0-1) */
  y: number;
  /** Width (0-1) */
  width: number;
  /** Height (0-1) */
  height: number;
}

/** Transform configuration */
export interface TransformConfig {
  /** Rotation angle */
  rotation: RotationAngle;
  /** Flip direction */
  flip: FlipDirection;
  /** Crop region (null = no crop) */
  crop: CropRegion | null;
}

/** Default transform */
export const DEFAULT_TRANSFORM: TransformConfig = {
  rotation: 0,
  flip: 'none',
  crop: null,
};

// ===== Render Config Types (sent to Rust) =====

/** Effects render configuration for Rust backend */
export interface EffectsRenderConfig {
  /** Filter adjustments */
  filters: FilterAdjustments;
  /** Speed multiplier (1.0 = normal) */
  speed: number;
  /** Reverse video */
  reverse: boolean;
  /** PiP layers */
  pip: PiPRenderConfig[];
  /** Transform (crop/rotate/flip) */
  transform: TransformConfig;
  /** Transitions between clips */
  transitions: TransitionRenderConfig[];
}

/** PiP render config for Rust */
export interface PiPRenderConfig {
  sourcePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  endTime: number;
}

/** Transition render config for Rust */
export interface TransitionRenderConfig {
  type: string;
  duration: number;
  /** Offset in seconds where the transition starts (computed from clip durations) */
  offset: number;
}
