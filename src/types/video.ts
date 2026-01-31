/** Video metadata returned from FFmpeg probe */
export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
  file_size: number;
}

/** Aspect ratio category for layout adaptation */
export type AspectRatioType = 'landscape' | 'portrait' | 'square';

/** Supported video file extensions */
export const SUPPORTED_VIDEO_EXTENSIONS = [
  'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v',
] as const;

/** MIME types for video files */
export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
] as const;
