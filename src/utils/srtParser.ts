import type { SubtitleEntry } from '../types/text';

/**
 * Parse an SRT time string into seconds.
 * Format: HH:MM:SS,mmm (e.g., "00:01:23,456")
 */
function parseSrtTime(timeStr: string): number {
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length !== 3) return 0;

  const hours = parseFloat(parts[0]) || 0;
  const minutes = parseFloat(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds into SRT time string.
 * Output: HH:MM:SS,mmm
 */
export function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.round((s - Math.floor(s)) * 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Parse SRT file content into subtitle entries.
 *
 * SRT format:
 * ```
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * First subtitle line
 * Optional second line
 *
 * 2
 * 00:00:05,000 --> 00:00:08,000
 * Second subtitle
 * ```
 */
export function parseSrt(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by double newline (blank line separator between entries)
  const blocks = normalized.split(/\n\n+/).filter((b) => b.trim().length > 0);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // First line: sequence number
    const index = parseInt(lines[0].trim(), 10);
    if (isNaN(index)) continue;

    // Second line: time range
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = parseSrtTime(timeMatch[1]);
    const endTime = parseSrtTime(timeMatch[2]);

    // Remaining lines: subtitle text
    const text = lines.slice(2).join('\n').trim();
    if (text.length === 0) continue;

    entries.push({ index, startTime, endTime, text });
  }

  return entries;
}

/**
 * Serialize subtitle entries back to SRT format string.
 */
export function serializeSrt(entries: SubtitleEntry[]): string {
  return entries
    .map((entry, i) => {
      const idx = entry.index > 0 ? entry.index : i + 1;
      const start = formatSrtTime(entry.startTime);
      const end = formatSrtTime(entry.endTime);
      return `${idx}\n${start} --> ${end}\n${entry.text}`;
    })
    .join('\n\n') + '\n';
}
