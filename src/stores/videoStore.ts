import { create } from 'zustand';
import type { VideoInfo } from '../types';

interface VideoState {
  /** Path to the currently loaded video file */
  videoPath: string | null;
  /** Converted asset URL for HTML5 video playback */
  videoUrl: string | null;
  /** Video metadata from FFmpeg probe */
  videoInfo: VideoInfo | null;
  /** Whether video is currently loading/probing */
  isLoading: boolean;
  /** Error message if video import failed */
  error: string | null;

  /** Actions */
  setVideo: (path: string, url: string, info: VideoInfo) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearVideo: () => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  videoPath: null,
  videoUrl: null,
  videoInfo: null,
  isLoading: false,
  error: null,

  setVideo: (path, url, info) =>
    set({
      videoPath: path,
      videoUrl: url,
      videoInfo: info,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) =>
    set({ isLoading: loading, error: null }),

  setError: (error) =>
    set({ error, isLoading: false }),

  clearVideo: () =>
    set({
      videoPath: null,
      videoUrl: null,
      videoInfo: null,
      isLoading: false,
      error: null,
    }),
}));
