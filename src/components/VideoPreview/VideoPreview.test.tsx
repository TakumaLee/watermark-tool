import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoPreview } from './VideoPreview';
import { useVideoStore } from '../../stores/videoStore';

describe('VideoPreview', () => {
  beforeEach(() => {
    // Reset store state before each test
    useVideoStore.setState({
      videoPath: null,
      videoUrl: null,
      videoInfo: null,
      isLoading: false,
      error: null,
    });
  });

  it('renders empty state when no video is loaded', () => {
    render(<VideoPreview />);
    // EmptyState should show drag-and-drop prompt
    expect(screen.getByText(/拖放影片/i) || screen.getByText(/匯入/i)).toBeTruthy();
  });

  it('renders loading state when isLoading is true', () => {
    useVideoStore.setState({ isLoading: true });
    render(<VideoPreview />);
    // Should show some loading indicator
    const el = document.querySelector('[class*="animate"]');
    expect(el).toBeTruthy();
  });

  it('renders video player when videoUrl is set', () => {
    useVideoStore.setState({
      videoPath: '/test/video.mp4',
      videoUrl: 'blob:http://localhost/test-video',
      videoInfo: {
        width: 1920,
        height: 1080,
        duration: 120.5,
        fps: 30,
        codec: 'h264',
        file_size: 50000000,
      },
    });
    render(<VideoPreview />);
    // VideoPlayer should render a <video> element
    const video = document.querySelector('video');
    expect(video).toBeTruthy();
  });

  it('shows error message when error is set', () => {
    useVideoStore.setState({ error: '不支援的影片格式' });
    render(<VideoPreview />);
    expect(screen.getByText(/不支援的影片格式/)).toBeTruthy();
  });

  it('error can be dismissed', async () => {
    useVideoStore.setState({ error: '測試錯誤' });
    render(<VideoPreview />);
    const closeBtn = screen.getByText('✕');
    closeBtn.click();
    expect(useVideoStore.getState().error).toBeNull();
  });
});
