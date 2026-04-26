import { describe, it, expect } from 'vitest';
import type { TimelineClip } from '../types';
import {
  resolveActiveClip,
  applyReorder,
  computeDropIndex,
  isMultiSourceTimeline,
} from './timelineLogic';

// ─── helpers ────────────────────────────────────────────────────────────────

function clip(
  id: string,
  duration: number,
  opts: { sourcePath?: string; startTime?: number; sourceStart?: number; sourceEnd?: number } = {},
): TimelineClip {
  const { sourcePath = '/video.mp4', startTime = 0 } = opts;
  return {
    id,
    sourcePath,
    sourceUrl: `asset://localhost${sourcePath}`,
    startTime,
    endTime: startTime + duration,
    duration,
    name: id,
    sourceStart: opts.sourceStart ?? 0,
    sourceEnd: opts.sourceEnd ?? (startTime + duration),
  };
}

// ─── resolveActiveClip ───────────────────────────────────────────────────────

describe('resolveActiveClip', () => {
  it('returns null for empty clips', () => {
    expect(resolveActiveClip([], 0)).toBeNull();
  });

  it('returns first clip at t=0', () => {
    const clips = [clip('a', 10), clip('b', 5)];
    const r = resolveActiveClip(clips, 0);
    expect(r?.clip.id).toBe('a');
    expect(r?.index).toBe(0);
    expect(r?.offsetInClip).toBe(0);
    expect(r?.timelineStart).toBe(0);
    expect(r?.seekTarget).toBe(0);
  });

  it('returns correct clip mid-way through first clip', () => {
    const clips = [clip('a', 10), clip('b', 5)];
    const r = resolveActiveClip(clips, 7);
    expect(r?.clip.id).toBe('a');
    expect(r?.offsetInClip).toBe(7);
    expect(r?.seekTarget).toBe(7); // startTime(0) + offset(7)
  });

  it('transitions to second clip at exact boundary', () => {
    const clips = [clip('a', 10), clip('b', 5)];
    const r = resolveActiveClip(clips, 10);
    expect(r?.clip.id).toBe('b');
    expect(r?.index).toBe(1);
    expect(r?.offsetInClip).toBe(0);
    expect(r?.timelineStart).toBe(10);
  });

  it('handles trimmed clips (startTime != 0)', () => {
    // Clip trimmed: source 5s→15s, so startTime=5, endTime=15, duration=10
    const clips = [clip('a', 10, { startTime: 5 })];
    const r = resolveActiveClip(clips, 3); // 3 seconds into clip
    expect(r?.seekTarget).toBe(8); // source startTime(5) + offset(3)
  });

  it('clamps past the end to last clip at endTime', () => {
    const clips = [clip('a', 10)];
    const r = resolveActiveClip(clips, 999);
    expect(r?.clip.id).toBe('a');
    expect(r?.seekTarget).toBe(10); // endTime
  });

  it('resolves correctly after reorder', () => {
    // Original order: [a(10s), b(5s)]
    // Reordered to:   [b(5s), a(10s)]
    // At playheadTime=12: b occupies 0-5, a occupies 5-15 → should resolve to clip a at offset 7
    const before = [clip('a', 10), clip('b', 5)];
    const after = applyReorder(before, 'b', 0);
    const r = resolveActiveClip(after, 12);
    expect(r?.clip.id).toBe('a');
    expect(r?.index).toBe(1);
    expect(r?.offsetInClip).toBe(7);
    expect(r?.timelineStart).toBe(5);
  });
});

// ─── applyReorder ────────────────────────────────────────────────────────────

describe('applyReorder', () => {
  it('moves clip from first to last', () => {
    const clips = [clip('a', 5), clip('b', 5), clip('c', 5)];
    const result = applyReorder(clips, 'a', 2);
    expect(result.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves clip from last to first', () => {
    const clips = [clip('a', 5), clip('b', 5), clip('c', 5)];
    const result = applyReorder(clips, 'c', 0);
    expect(result.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('moves middle clip backward', () => {
    const clips = [clip('a', 5), clip('b', 5), clip('c', 5)];
    const result = applyReorder(clips, 'b', 0);
    expect(result.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('returns the same array reference for a no-op (same index)', () => {
    const clips = [clip('a', 5), clip('b', 5)];
    expect(applyReorder(clips, 'a', 0)).toBe(clips);
  });

  it('returns the same array reference for unknown clipId', () => {
    const clips = [clip('a', 5)];
    expect(applyReorder(clips, 'unknown', 0)).toBe(clips);
  });

  it('does not mutate the original array', () => {
    const clips = [clip('a', 5), clip('b', 5)];
    const copy = [...clips];
    applyReorder(clips, 'a', 1);
    expect(clips.map((c) => c.id)).toEqual(copy.map((c) => c.id));
  });
});

// ─── computeDropIndex ────────────────────────────────────────────────────────

describe('computeDropIndex', () => {
  // Two clips, each 10s wide at zoom=10px/s → each 100px wide, midpoints at 50px and 150px

  it('returns 0 when before midpoint of first clip', () => {
    const clips = [clip('a', 10), clip('b', 10)];
    expect(computeDropIndex(clips, 10, 40)).toBe(0); // 40 < mid(50)
  });

  it('returns 1 when past midpoint of first clip but before midpoint of second', () => {
    const clips = [clip('a', 10), clip('b', 10)];
    expect(computeDropIndex(clips, 10, 110)).toBe(1); // 110 < mid(150)
  });

  it('returns 2 when past midpoint of second clip', () => {
    const clips = [clip('a', 10), clip('b', 10)];
    expect(computeDropIndex(clips, 10, 160)).toBe(2); // past all midpoints
  });

  it('returns clips.length when dragged far past all clips', () => {
    const clips = [clip('a', 10)];
    expect(computeDropIndex(clips, 10, 9999)).toBe(1);
  });
});

// ─── isMultiSourceTimeline ───────────────────────────────────────────────────

describe('isMultiSourceTimeline', () => {
  it('returns false for empty array', () => {
    expect(isMultiSourceTimeline([])).toBe(false);
  });

  it('returns false for single clip', () => {
    expect(isMultiSourceTimeline([clip('a', 10)])).toBe(false);
  });

  it('returns false when all clips share the same source', () => {
    const clips = [
      clip('a', 5, { sourcePath: '/v.mp4' }),
      clip('b', 5, { sourcePath: '/v.mp4' }),
    ];
    expect(isMultiSourceTimeline(clips)).toBe(false);
  });

  it('returns true when clips have different sources', () => {
    const clips = [
      clip('a', 5, { sourcePath: '/v1.mp4' }),
      clip('b', 5, { sourcePath: '/v2.mp4' }),
    ];
    expect(isMultiSourceTimeline(clips)).toBe(true);
  });

  it('returns true even with one different source among many same', () => {
    const clips = [
      clip('a', 5, { sourcePath: '/v.mp4' }),
      clip('b', 5, { sourcePath: '/v.mp4' }),
      clip('c', 5, { sourcePath: '/other.mp4' }),
    ];
    expect(isMultiSourceTimeline(clips)).toBe(true);
  });
});
