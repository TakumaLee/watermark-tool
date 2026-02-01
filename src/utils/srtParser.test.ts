import { describe, it, expect } from 'vitest';
import { parseSrt, serializeSrt, formatSrtTime } from './srtParser';

describe('parseSrt', () => {
  it('should parse basic SRT content', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello World

2
00:00:05,500 --> 00:00:08,200
Second subtitle
`;
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(2);
    expect(entries[0].index).toBe(1);
    expect(entries[0].startTime).toBeCloseTo(1.0, 2);
    expect(entries[0].endTime).toBeCloseTo(4.0, 2);
    expect(entries[0].text).toBe('Hello World');
    expect(entries[1].index).toBe(2);
    expect(entries[1].startTime).toBeCloseTo(5.5, 2);
    expect(entries[1].endTime).toBeCloseTo(8.2, 2);
    expect(entries[1].text).toBe('Second subtitle');
  });

  it('should handle multi-line subtitles', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Line one
Line two
Line three
`;
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('Line one\nLine two\nLine three');
  });

  it('should handle Windows line endings', () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nWorld\r\n";
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe('Hello');
    expect(entries[1].text).toBe('World');
  });

  it('should skip invalid blocks', () => {
    const srt = `not a number
00:00:01,000 --> 00:00:04,000
Skip me

2
00:00:05,000 --> 00:00:08,000
Keep me
`;
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('Keep me');
  });

  it('should return empty for empty input', () => {
    expect(parseSrt('')).toHaveLength(0);
    expect(parseSrt('   ')).toHaveLength(0);
  });

  it('should handle hours in timestamps', () => {
    const srt = `1
01:30:00,000 --> 02:00:00,000
Long video subtitle
`;
    const entries = parseSrt(srt);
    expect(entries[0].startTime).toBeCloseTo(5400.0, 1);
    expect(entries[0].endTime).toBeCloseTo(7200.0, 1);
  });
});

describe('formatSrtTime', () => {
  it('should format seconds to SRT time', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000');
    expect(formatSrtTime(1.5)).toBe('00:00:01,500');
    expect(formatSrtTime(90.5)).toBe('00:01:30,500');
    expect(formatSrtTime(3661.123)).toBe('01:01:01,123');
  });
});

describe('serializeSrt', () => {
  it('should serialize entries back to SRT format', () => {
    const entries = [
      { index: 1, startTime: 1.0, endTime: 4.0, text: 'Hello' },
      { index: 2, startTime: 5.5, endTime: 8.2, text: 'World' },
    ];
    const srt = serializeSrt(entries);
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:04,000\nHello');
    expect(srt).toContain('2\n00:00:05,500 --> 00:00:08,200\nWorld');
  });

  it('should roundtrip parse and serialize', () => {
    const original = `1
00:00:01,000 --> 00:00:04,000
Hello World

2
00:00:05,500 --> 00:00:08,200
Second subtitle
`;
    const entries = parseSrt(original);
    const serialized = serializeSrt(entries);
    const reparsed = parseSrt(serialized);
    expect(reparsed).toHaveLength(2);
    expect(reparsed[0].text).toBe('Hello World');
    expect(reparsed[1].text).toBe('Second subtitle');
  });
});
