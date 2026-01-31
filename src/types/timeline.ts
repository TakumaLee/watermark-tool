/** A single clip segment on the timeline */
export interface TimelineClip {
  /** Unique identifier */
  id: string;
  /** Source video path */
  sourcePath: string;
  /** Source video URL for preview */
  sourceUrl: string;
  /** Start time in the source video (seconds) */
  startTime: number;
  /** End time in the source video (seconds) */
  endTime: number;
  /** Duration of the clip (endTime - startTime) */
  duration: number;
  /** Display name */
  name: string;
}

/** Timeline state */
export interface TimelineState {
  /** All clips in order */
  clips: TimelineClip[];
  /** Current playhead position in timeline-time (seconds) */
  playheadTime: number;
  /** Currently active clip ID (the one the playhead is over) */
  activeClipId: string | null;
  /** Selected clip ID for operations */
  selectedClipId: string | null;
  /** Zoom level (pixels per second) */
  zoom: number;
  /** Scroll offset in pixels */
  scrollOffset: number;
  /** Whether timeline is playing */
  isPlaying: boolean;
  /** Total timeline duration */
  totalDuration: number;
  /** Trim mode: selecting in/out points */
  trimMode: TrimMode | null;
}

/** Trim mode for setting in/out points */
export interface TrimMode {
  clipId: string;
  inPoint: number;
  outPoint: number;
}

/** Timeline zoom constraints */
export const TIMELINE_ZOOM = {
  MIN: 10,    // 10 px/s (zoomed out)
  MAX: 500,   // 500 px/s (zoomed in)
  DEFAULT: 50, // 50 px/s
  STEP: 1.3,  // zoom factor per step
} as const;
