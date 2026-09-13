import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineStore } from '../stores/timelineStore';
import type { TimelineClip } from '../types';
import { useTimelinePreview } from './useTimelinePreview';

function clip(id: string, startTime = 0): TimelineClip {
  return {
    id, name: id, sourcePath: `/${id}.mp4`, sourceUrl: `http://localhost/${id}.mp4`,
    startTime, endTime: startTime + 10, duration: 10, sourceStart: 0, sourceEnd: 60,
  };
}

function media() {
  const video = document.createElement('video');
  let time = 0;
  Object.defineProperties(video, {
    paused: { value: false, writable: true },
    ended: { value: false, writable: true },
    readyState: { value: 0, writable: true },
    seeking: { value: false, writable: true },
    currentTime: {
      get: () => time,
      set: (next: number) => {
        if (time !== next) Object.defineProperty(video, 'seeking', { value: true });
        time = next;
      },
    },
  });
  const load = vi.spyOn(video, 'load').mockImplementation(() => {
    time = 0;
    Object.defineProperty(video, 'readyState', { value: 0 });
    Object.defineProperty(video, 'paused', { value: true });
  });
  const play = vi.spyOn(video, 'play').mockImplementation(async () => {
    Object.defineProperty(video, 'paused', { value: false });
  });
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
    Object.defineProperty(video, 'paused', { value: true });
  });
  return { video, load, play, pause };
}

function canPlay(video: HTMLVideoElement) {
  Object.defineProperty(video, 'readyState', { value: 4 });
  video.dispatchEvent(new Event('canplay'));
}

function seeked(video: HTMLVideoElement) {
  Object.defineProperty(video, 'seeking', { value: false });
  video.dispatchEvent(new Event('seeked'));
}

function setup(clips: TimelineClip[]) {
  useTimelineStore.setState({ clips, totalDuration: clips.length * 10 });
  const first = media();
  const second = media();
  const swaps = vi.fn();
  const hook = renderHook(() => {
    const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
    const primary = useRef<HTMLVideoElement | null>(first.video);
    const secondary = useRef<HTMLVideoElement | null>(second.video);
    useLayoutEffect(() => {
      primary.current = activeSlot === 0 ? first.video : second.video;
      secondary.current = activeSlot === 0 ? second.video : first.video;
    }, [activeSlot]);
    const swap = useCallback(() => {
      swaps();
      setActiveSlot(slot => slot === 0 ? 1 : 0);
    }, []);
    useTimelinePreview(primary, secondary, swap, activeSlot);
    return { primary, secondary };
  });
  act(() => canPlay(first.video));
  const enter = (time: number) => act(() => useTimelineStore.getState().setPlayheadTime(time));
  return { first, second, swaps, enter, ...hook };
}

beforeEach(() => useTimelineStore.getState().clearTimeline());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('preloaded clip transitions', () => {
  it.each([2, 3])('uses prepared B in a %i-clip timeline without reloading it', count => {
    const h = setup([clip('A'), clip('B'), clip('C')].slice(0, count));
    act(() => { canPlay(h.second.video); seeked(h.second.video); });
    h.enter(10.001);
    expect(h.swaps).toHaveBeenCalledTimes(1);
    expect(h.result.current.primary.current).toBe(h.second.video);
    expect(h.second.video.src).toBe(clip('B').sourceUrl);
    expect(h.second.load).toHaveBeenCalledTimes(1);
    expect(h.first.pause).toHaveBeenCalled();
    expect(h.first.video.muted).toBe(true);
    expect(h.second.play).toHaveBeenCalledTimes(1);
    if (count === 3) {
      expect(h.first.video.src).toBe(clip('C').sourceUrl);
      act(() => { canPlay(h.first.video); seeked(h.first.video); });
      h.enter(20.001);
      expect(h.swaps).toHaveBeenCalledTimes(2);
      expect(h.result.current.primary.current).toBe(h.first.video);
      expect(h.first.load).toHaveBeenCalledTimes(2);
    }
  });

  it('accepts an already-ready zero start without a no-op seeked event', () => {
    const h = setup([clip('A'), clip('B')]);
    act(() => canPlay(h.second.video));
    h.enter(10.001);
    expect(h.swaps).toHaveBeenCalledTimes(1);
  });

  it('waits for a nonzero trim in-point to finish seeking', () => {
    const h = setup([clip('A'), clip('B', 3)]);
    act(() => canPlay(h.second.video));
    expect(h.second.video.currentTime).toBe(3);
    expect(h.second.video.seeking).toBe(true);
    act(() => seeked(h.second.video));
    h.enter(10.001);
    expect(h.swaps).toHaveBeenCalledTimes(1);
    expect(h.second.video.currentTime).toBe(3);
  });

  it('keeps a paused transition paused and honors a seek into the middle of B', () => {
    const h = setup([clip('A'), clip('B')]);
    act(() => { canPlay(h.second.video); seeked(h.second.video); });
    h.first.video.pause();
    h.enter(15);
    expect(h.result.current.primary.current?.currentTime).toBe(5);
    expect(h.second.play).not.toHaveBeenCalled();
    expect(h.result.current.primary.current?.paused).toBe(true);
  });

  it('resumes after a natural ended event', () => {
    const h = setup([clip('A'), clip('B')]);
    act(() => { canPlay(h.second.video); seeked(h.second.video); });
    Object.defineProperty(h.first.video, 'paused', { value: true });
    Object.defineProperty(h.first.video, 'ended', { value: true });
    h.enter(10.001);
    expect(h.second.play).toHaveBeenCalledTimes(1);
  });

  it('keeps fallback readiness listeners across a playhead update', () => {
    const h = setup([clip('A'), clip('B', 3)]);
    h.enter(10.001); // B has not emitted canplay yet.
    expect(h.swaps).not.toHaveBeenCalled();
    h.enter(10.002);
    act(() => canPlay(h.first.video));
    expect(h.first.video.currentTime).toBeCloseTo(3.001);
    expect(h.first.play).toHaveBeenCalledTimes(2);
  });

  it('does not use a buffer whose seek is still pending', () => {
    const h = setup([clip('A'), clip('B', 3)]);
    act(() => canPlay(h.second.video));
    h.enter(10.001);
    expect(h.swaps).not.toHaveBeenCalled();
    expect(h.first.video.src).toBe(clip('B').sourceUrl);
  });

  it('removes pending media listeners on unmount', () => {
    const h = setup([clip('A'), clip('B', 3)]);
    h.enter(10.001);
    h.unmount();
    act(() => { canPlay(h.first.video); canPlay(h.second.video); });
    expect(h.first.play).toHaveBeenCalledTimes(1);
    expect(h.second.video.currentTime).toBe(0);
  });
});
