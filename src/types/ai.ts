// ============================================================
// AI Features — Type Definitions (Phase 11)
// ============================================================

// === Whisper Auto-Subtitle ===

/** Supported languages for Whisper */
export type WhisperLanguage = 'auto' | 'ja' | 'en' | 'zh' | 'ko' | 'fr' | 'de' | 'es';

/** Whisper model sizes */
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

/** Status of AI processing tasks */
export type AITaskStatus = 'idle' | 'running' | 'complete' | 'error';

/** Whisper transcription configuration */
export interface WhisperConfig {
  language: WhisperLanguage;
  model: WhisperModel;
}

/** Whisper processing state */
export interface WhisperState {
  status: AITaskStatus;
  progress: number; // 0-100
  progressText: string;
  error: string | null;
}

/** Whisper result entry (matches SRT-style output) */
export interface WhisperResultEntry {
  index: number;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

// === Scene Detection ===

/** Scene detection configuration */
export interface SceneDetectConfig {
  /** Sensitivity threshold (0.1 - 0.9, lower = more sensitive) */
  threshold: number;
}

/** Scene detection processing state */
export interface SceneDetectState {
  status: AITaskStatus;
  progress: number;
  error: string | null;
}

/** Detected scene change point */
export interface SceneChangePoint {
  /** Timestamp in seconds */
  timestamp: number;
  /** Scene change score (0-1) */
  score: number;
}

// === Background Removal (Chromakey) ===

/** Chromakey (green screen removal) configuration */
export interface ChromakeyConfig {
  /** Color to remove in hex format (e.g., "#00ff00") */
  color: string;
  /** Similarity/tolerance (0.01 - 1.0) */
  similarity: number;
  /** Blend amount (0.0 - 1.0) */
  blend: number;
}

/** Chromakey processing state */
export interface ChromakeyState {
  enabled: boolean;
}

// === Quality Enhancement ===

/** Enhancement filter type */
export type EnhancementFilter = 'sharpen' | 'denoise' | 'upscale';

/** Quality enhancement configuration */
export interface EnhancementConfig {
  /** Sharpen using unsharp filter */
  sharpen: {
    enabled: boolean;
    /** Luma matrix size (3-23, odd) */
    lumaX: number;
    lumaY: number;
    /** Luma effect (-2.0 to 5.0) */
    lumaAmount: number;
  };
  /** Denoise using nlmeans or hqdn3d */
  denoise: {
    enabled: boolean;
    /** Denoising strength (1-10) */
    strength: number;
    /** Filter type */
    filterType: 'nlmeans' | 'hqdn3d';
  };
  /** Simple upscale using lanczos */
  upscale: {
    enabled: boolean;
    /** Scale factor (1.5x, 2x, 4x) */
    scaleFactor: number;
  };
}

/** Enhancement processing state */
export interface EnhancementState {
  status: AITaskStatus;
  progress: number;
  error: string | null;
}

// === Auto-Edit Suggestions (Silence Detection) ===

/** Silence detection configuration */
export interface SilenceDetectConfig {
  /** Noise threshold in dB (e.g., -30) */
  noiseThresholdDb: number;
  /** Minimum silence duration in seconds */
  minDurationSec: number;
}

/** Detected silence segment */
export interface SilenceSegment {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Duration in seconds */
  duration: number;
}

/** Silence detection processing state */
export interface SilenceDetectState {
  status: AITaskStatus;
  progress: number;
  error: string | null;
}

/** Auto-edit suggestion */
export interface EditSuggestion {
  /** Suggestion type */
  type: 'remove_silence' | 'trim_start' | 'trim_end';
  /** Start time to cut */
  startTime: number;
  /** End time to cut */
  endTime: number;
  /** Description of the suggestion */
  description: string;
}

// === Defaults ===

export const DEFAULT_WHISPER_CONFIG: WhisperConfig = {
  language: 'auto',
  model: 'base',
};

export const DEFAULT_SCENE_DETECT_CONFIG: SceneDetectConfig = {
  threshold: 0.3,
};

export const DEFAULT_CHROMAKEY_CONFIG: ChromakeyConfig = {
  color: '#00ff00',
  similarity: 0.3,
  blend: 0.1,
};

export const DEFAULT_ENHANCEMENT_CONFIG: EnhancementConfig = {
  sharpen: {
    enabled: false,
    lumaX: 5,
    lumaY: 5,
    lumaAmount: 1.0,
  },
  denoise: {
    enabled: false,
    strength: 3,
    filterType: 'hqdn3d',
  },
  upscale: {
    enabled: false,
    scaleFactor: 2,
  },
};

export const DEFAULT_SILENCE_DETECT_CONFIG: SilenceDetectConfig = {
  noiseThresholdDb: -30,
  minDurationSec: 2,
};

export const WHISPER_LANGUAGES: { value: WhisperLanguage; label: string }[] = [
  { value: 'auto', label: '自動偵測' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

export const WHISPER_MODELS: { value: WhisperModel; label: string; description: string }[] = [
  { value: 'tiny', label: 'Tiny', description: '最快速，精確度較低' },
  { value: 'base', label: 'Base', description: '平衡速度與精確度' },
  { value: 'small', label: 'Small', description: '較高精確度' },
  { value: 'medium', label: 'Medium', description: '高精確度' },
  { value: 'large', label: 'Large', description: '最高精確度，速度較慢' },
];
