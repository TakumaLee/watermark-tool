import type { AspectRatioType } from '../types';

/**
 * Determine the aspect ratio category of a video.
 */
export function getAspectRatioType(width: number, height: number): AspectRatioType {
  const ratio = width / height;
  if (ratio > 1.1) return 'landscape';
  if (ratio < 0.9) return 'portrait';
  return 'square';
}

/**
 * Get a human-readable aspect ratio string like "16:9", "9:16", "1:1".
 */
export function getAspectRatioLabel(width: number, height: number): string {
  const gcd = greatestCommonDivisor(width, height);
  const w = width / gcd;
  const h = height / gcd;

  // Simplify common ratios
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  if (Math.abs(ratio - 21 / 9) < 0.1) return '21:9';

  return `${w}:${h}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}
