/** Audio waveform peaks data */
export interface WaveformData {
  /** Normalized peak values (0-1) */
  peaks: number[];
  /** Sample rate used for extraction */
  sampleRate: number;
  /** Duration of the audio in seconds */
  duration: number;
}

/** BGM (Background Music) item */
export interface BGMItem {
  /** Unique identifier */
  id: string;
  /** File path on disk */
  filePath: string;
  /** Display name */
  name: string;
  /** Total duration of the BGM file in seconds */
  duration: number;
  /** Volume (0-200, percentage) */
  volume: number;
  /** Offset in seconds: when the BGM starts playing on the timeline */
  startOffset: number;
  /** Trim start: where in the BGM file to start playing (seconds) */
  trimStart: number;
  /** Trim end: where in the BGM file to stop playing (seconds, -1 = end) */
  trimEnd: number;
  /** Fade in duration (seconds, 0 = no fade) */
  fadeIn: number;
  /** Fade out duration (seconds, 0 = no fade) */
  fadeOut: number;
  /** Whether this BGM is muted */
  isMuted: boolean;
  /** Waveform data for display */
  waveform: WaveformData | null;
}

/** Main audio fade settings */
export interface AudioFadeSettings {
  /** Fade in duration (seconds) */
  fadeInDuration: number;
  /** Fade out duration (seconds) */
  fadeOutDuration: number;
}

/** Clip-level volume override */
export interface ClipVolumeOverride {
  /** Timeline clip ID */
  clipId: string;
  /** Volume (0-200, percentage) */
  volume: number;
  /** Whether this clip is muted */
  isMuted: boolean;
}

/** Audio render configuration sent to Rust backend */
export interface AudioRenderConfig {
  /** Main volume (0-200, percentage) */
  mainVolume: number;
  /** Whether main audio is muted */
  mainMuted: boolean;
  /** Fade in duration for main audio (seconds) */
  fadeInDuration: number;
  /** Fade out duration for main audio (seconds) */
  fadeOutDuration: number;
  /** BGM configurations */
  bgmItems: BGMRenderConfig[];
  /** Per-clip volume overrides */
  clipVolumes: ClipVolumeRenderConfig[];
}

/** BGM render config for FFmpeg */
export interface BGMRenderConfig {
  filePath: string;
  volume: number;
  startOffset: number;
  trimStart: number;
  trimEnd: number;
  fadeIn: number;
  fadeOut: number;
  isMuted: boolean;
}

/** Clip volume render config for FFmpeg */
export interface ClipVolumeRenderConfig {
  startTime: number;
  endTime: number;
  volume: number;
  isMuted: boolean;
}

/** Supported audio file extensions for BGM import */
export const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'] as const;

/** Default BGM values */
export const DEFAULT_BGM: Omit<BGMItem, 'id' | 'filePath' | 'name' | 'duration' | 'waveform'> = {
  volume: 100,
  startOffset: 0,
  trimStart: 0,
  trimEnd: -1,
  fadeIn: 0,
  fadeOut: 0,
  isMuted: false,
};
