#!/usr/bin/env node
/**
 * watermark-tool CLI
 * 
 * AI agent-friendly command-line interface for adding watermarks to videos.
 * Uses FFmpeg under the hood (same logic as the Tauri desktop app).
 * 
 * Usage:
 *   node cli.js --input video.mp4 --watermark logo.png --output out.mp4
 *   node cli.js --input ./videos/ --watermark logo.png --output ./out/ --batch
 */

import { parseArgs } from 'node:util';
import { execFileSync, execFile } from 'node:child_process';
import { existsSync, statSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, basename, extname, dirname } from 'node:path';
import { createInterface } from 'node:readline';

// ── Constants ────────────────────────────────────────────────────────────────
const VERSION = '0.1.0';
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

const SUPPORTED_VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v', '.ts']);
const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const QUALITY_PRESETS = {
  original: { crf: 0,  preset: 'veryslow' },
  high:     { crf: 18, preset: 'slow' },
  medium:   { crf: 23, preset: 'medium' },
  low:      { crf: 28, preset: 'fast' },
};

// ── Help Text ────────────────────────────────────────────────────────────────
const HELP = `
watermark-tool CLI v${VERSION}
Add image watermarks to videos using FFmpeg.

USAGE
  node cli.js [options]

REQUIRED
  --input,     -i   <path>   Input video file or directory (for batch mode)
  --watermark, -w   <path>   Watermark image file (PNG/JPG/WebP/GIF/SVG)
  --output,    -o   <path>   Output video file or directory

WATERMARK OPTIONS
  --position   <preset>  Shortcut position: top-left | top-right | bottom-left |
                         bottom-right | center  (default: bottom-right)
  --x          <float>   X position as fraction of video width  (0.0–1.0, overrides --position)
  --y          <float>   Y position as fraction of video height (0.0–1.0, overrides --position)
  --width      <float>   Watermark width  as fraction of video width  (default: 0.15)
  --height     <float>   Watermark height as fraction of video height (default: 0.08)
  --opacity    <float>   Opacity 0.0–1.0  (default: 0.8)

MOVEMENT OPTIONS
  --movement   <mode>    static | linear | random  (default: static)

  Linear movement:
    --speed      <float>     Pixels/sec  (default: 80)
    --direction  <dir>       horizontal | vertical | diagonal  (default: diagonal)

  Random movement:
    --interval       <float>  Seconds between repositions  (default: 3.0)
    --fade-duration  <float>  Seconds of fade transition   (default: 0.5)

BATCH OPTIONS
  --batch        Process all videos in --input directory
  --recursive    Also scan subdirectories (requires --batch)
  --suffix       <str>  Suffix to append to output filename (default: _watermarked)
  --format       <ext>  Output format override: mp4 | mov | mkv (default: same as input)

QUALITY OPTIONS
  --quality  <level>  original | high | medium | low  (default: high)

GENERAL
  --overwrite       Overwrite existing output files without asking
  --dry-run         Print FFmpeg commands without executing them
  --json            Output results as JSON (useful for AI agents)
  --config  <path>  Load settings from a JSON config file
  --help, -h        Show this help message
  --version, -v     Show version

EXAMPLES
  # Basic watermark (bottom-right, 80% opacity)
  node cli.js -i video.mp4 -w logo.png -o output.mp4

  # Custom position and size
  node cli.js -i video.mp4 -w logo.png -o output.mp4 \\
    --position top-left --opacity 0.6 --width 0.2

  # Moving watermark (linear, horizontal bounce)
  node cli.js -i video.mp4 -w logo.png -o output.mp4 \\
    --movement linear --direction horizontal --speed 120

  # Batch: watermark all MP4s in a folder
  node cli.js --batch -i ./videos/ -w logo.png -o ./output/

  # AI agent usage (JSON output + no prompts)
  node cli.js -i video.mp4 -w logo.png -o out.mp4 --json --overwrite

  # Dry run to preview FFmpeg command
  node cli.js -i video.mp4 -w logo.png -o out.mp4 --dry-run
`;

// ── Argument Parsing ─────────────────────────────────────────────────────────
function parseCliArgs() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      // Required
      input:          { type: 'string',  short: 'i' },
      watermark:      { type: 'string',  short: 'w' },
      output:         { type: 'string',  short: 'o' },
      // Position
      position:       { type: 'string' },
      x:              { type: 'string' },
      y:              { type: 'string' },
      width:          { type: 'string' },
      height:         { type: 'string' },
      opacity:        { type: 'string' },
      // Movement
      movement:       { type: 'string' },
      speed:          { type: 'string' },
      direction:      { type: 'string' },
      interval:       { type: 'string' },
      'fade-duration':{ type: 'string' },
      // Batch
      batch:          { type: 'boolean' },
      recursive:      { type: 'boolean' },
      suffix:         { type: 'string' },
      format:         { type: 'string' },
      // Quality
      quality:        { type: 'string' },
      // General
      overwrite:      { type: 'boolean' },
      'dry-run':      { type: 'boolean' },
      json:           { type: 'boolean' },
      config:         { type: 'string' },
      help:           { type: 'boolean', short: 'h' },
      version:        { type: 'boolean', short: 'v' },
    },
  });
  return values;
}

// ── Config File Loading ───────────────────────────────────────────────────────
function loadConfig(configPath) {
  const absPath = resolve(configPath);
  if (!existsSync(absPath)) {
    die(`Config file not found: ${absPath}`);
  }
  try {
    return JSON.parse(readFileSync(absPath, 'utf-8'));
  } catch (e) {
    die(`Failed to parse config file: ${e.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function die(msg, jsonMode = false) {
  if (jsonMode) {
    console.log(JSON.stringify({ success: false, error: msg }));
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${msg}`);
  }
  process.exit(1);
}

function log(msg, jsonMode = false) {
  if (!jsonMode) console.log(msg);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ── Position Presets ──────────────────────────────────────────────────────────
const POSITION_PRESETS = {
  'top-left':     { x: 0.02, y: 0.02 },
  'top-right':    { x: 0.83, y: 0.02 },
  'bottom-left':  { x: 0.02, y: 0.90 },
  'bottom-right': { x: 0.83, y: 0.90 },
  'center':       { x: 0.425, y: 0.46 },
};

// ── Video Probe ───────────────────────────────────────────────────────────────
function probeVideo(inputPath) {
  try {
    const out = execFileSync(FFPROBE_BIN, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      inputPath,
    ], { encoding: 'utf-8' });

    const info = JSON.parse(out);
    const stream = info.streams?.[0];
    if (!stream) throw new Error('No video stream found');

    return {
      width:  stream.width  || 1920,
      height: stream.height || 1080,
    };
  } catch (e) {
    // Fallback to 1920x1080 if probe fails
    return { width: 1920, height: 1080 };
  }
}

// ── Filter Complex Builder ────────────────────────────────────────────────────
// Mirrors src-tauri/src/ffmpeg/overlay.rs logic

function buildOverlayExpression(opts, vidW, vidH, wmW, wmH) {
  const { movement, x, y, speed, direction, interval, fadeDuration } = opts;

  if (movement === 'linear') {
    const sx = Math.round(x * vidW);
    const sy = Math.round(y * vidH);
    const spd = speed;

    if (direction === 'horizontal') {
      return `x='if(eq(W-w,0),0,abs(mod(${sx}+t*${spd},2*(W-w))-(W-w)))':y=${sy}`;
    } else if (direction === 'vertical') {
      return `x=${sx}:y='if(eq(H-h,0),0,abs(mod(${sy}+t*${spd},2*(H-h))-(H-h)))'`;
    } else {
      // diagonal
      return `x='if(eq(W-w,0),0,abs(mod(${sx}+t*${spd},2*(W-w))-(W-w)))':y='if(eq(H-h,0),0,abs(mod(${sy}+t*${spd},2*(H-h))-(H-h)))'`;
    }
  }

  if (movement === 'random') {
    const maxX = Math.max(1, vidW - wmW);
    const maxY = Math.max(1, vidH - wmH);
    const visibleDuration = Math.max(interval * 0.2, interval - fadeDuration);
    return `x='mod(floor(t/${interval})*7919,${maxX})':y='mod(floor(t/${interval})*6271,${maxY})':enable='between(mod(t,${interval}),0,${visibleDuration})'`;
  }

  // static
  const px = Math.round(x * vidW);
  const py = Math.round(y * vidH);
  return `x=${px}:y=${py}`;
}

function buildFilterComplex(watermarks, vidW, vidH) {
  if (watermarks.length === 0) {
    return { inputArgs: [], filterComplex: '', outputLabel: '0:v' };
  }

  const inputArgs = [];
  const filters = [];
  const total = watermarks.length;

  for (let i = 0; i < total; i++) {
    const wm = watermarks[i];
    const inputIndex = i + 1;

    inputArgs.push('-i', wm.imagePath);

    const wmW = Math.round(wm.width  * vidW);
    const wmH = Math.round(wm.height * vidH);
    const opacity = clamp(wm.opacity, 0.0, 1.0);
    const prepLabel = `wm${i}`;

    // Scale, format, apply opacity
    filters.push(
      `[${inputIndex}]scale=${wmW}:${wmH},format=rgba,colorchannelmixer=aa=${opacity}[${prepLabel}]`
    );

    const overlayExpr = buildOverlayExpression(wm, vidW, vidH, wmW, wmH);

    const baseLabel = i === 0 ? '0:v' : `tmp${i - 1}`;
    const outLabel  = i === total - 1 ? 'vout' : `tmp${i}`;

    filters.push(`[${baseLabel}][${prepLabel}]overlay=${overlayExpr}[${outLabel}]`);
  }

  return {
    inputArgs,
    filterComplex: filters.join(';'),
    outputLabel: '[vout]',
  };
}

// ── FFmpeg Command Builder ────────────────────────────────────────────────────
function buildFFmpegArgs(inputFile, outputFile, watermarks, quality, overwrite) {
  const vidInfo = probeVideo(inputFile);
  const { inputArgs, filterComplex, outputLabel } = buildFilterComplex(
    watermarks, vidInfo.width, vidInfo.height
  );

  const { crf, preset } = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  const args = [];

  if (overwrite) args.push('-y');

  // Input: video first, then watermark images
  args.push('-i', inputFile);
  args.push(...inputArgs);

  if (filterComplex) {
    args.push('-filter_complex', filterComplex);
    args.push('-map', outputLabel);
    args.push('-map', '0:a?'); // keep audio if present
  }

  // Encoding
  if (crf === 0) {
    args.push('-c:v', 'libx264', '-preset', preset, '-qp', '0');
  } else {
    args.push('-c:v', 'libx264', '-crf', String(crf), '-preset', preset);
  }
  args.push('-c:a', 'copy');
  args.push(outputFile);

  return { args, vidInfo };
}

// ── Single File Processing ────────────────────────────────────────────────────
function processFile(inputFile, outputFile, watermarks, opts) {
  const { quality, overwrite, dryRun, jsonMode } = opts;

  // Check output existence
  if (existsSync(outputFile) && !overwrite && !dryRun) {
    log(`\x1b[33mSkipping\x1b[0m (output exists, use --overwrite): ${outputFile}`, jsonMode);
    return { skipped: true, input: inputFile, output: outputFile };
  }

  // Ensure output directory exists
  const outDir = dirname(outputFile);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const { args, vidInfo } = buildFFmpegArgs(inputFile, outputFile, watermarks, quality, overwrite);

  if (dryRun) {
    const cmd = `${FFMPEG_BIN} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;
    log(`\x1b[36m[dry-run]\x1b[0m ${cmd}`, jsonMode);
    return { dryRun: true, command: `${FFMPEG_BIN} ${args.join(' ')}`, input: inputFile, output: outputFile, vidInfo };
  }

  log(`\x1b[32mProcessing\x1b[0m ${basename(inputFile)} → ${basename(outputFile)}`, jsonMode);

  try {
    execFileSync(FFMPEG_BIN, args, { stdio: jsonMode ? 'pipe' : 'inherit' });
    return { success: true, input: inputFile, output: outputFile };
  } catch (e) {
    return { success: false, input: inputFile, output: outputFile, error: e.message };
  }
}

// ── Collect Videos From Directory ────────────────────────────────────────────
function collectVideos(dir, recursive = false) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...collectVideos(fullPath, recursive));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (SUPPORTED_VIDEO_EXTS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  let args;
  try {
    args = parseCliArgs();
  } catch (e) {
    console.error(`Argument error: ${e.message}`);
    console.log('Run with --help for usage.');
    process.exit(1);
  }

  const jsonMode = !!args.json;

  if (args.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Merge config file if provided
  let fileConfig = {};
  if (args.config) {
    fileConfig = loadConfig(args.config);
  }

  const merged = { ...fileConfig, ...args };

  // Validate required args
  if (!merged.input)     die('--input is required', jsonMode);
  if (!merged.watermark) die('--watermark is required', jsonMode);
  if (!merged.output)    die('--output is required', jsonMode);

  const inputPath     = resolve(merged.input);
  const watermarkPath = resolve(merged.watermark);
  const outputPath    = resolve(merged.output);

  // Validate watermark
  if (!existsSync(watermarkPath)) die(`Watermark file not found: ${watermarkPath}`, jsonMode);
  const wmExt = extname(watermarkPath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTS.has(wmExt)) {
    die(`Unsupported watermark format: ${wmExt}. Supported: ${[...SUPPORTED_IMAGE_EXTS].join(', ')}`, jsonMode);
  }

  // Validate input
  if (!existsSync(inputPath)) die(`Input not found: ${inputPath}`, jsonMode);
  const isBatch = !!merged.batch || statSync(inputPath).isDirectory();

  // Parse watermark config
  const positionPreset = merged.position || 'bottom-right';
  const preset = POSITION_PRESETS[positionPreset] || POSITION_PRESETS['bottom-right'];

  const wmX       = merged.x        != null ? parseFloat(merged.x)        : preset.x;
  const wmY       = merged.y        != null ? parseFloat(merged.y)        : preset.y;
  const wmWidth   = merged.width    != null ? parseFloat(merged.width)    : 0.15;
  const wmHeight  = merged.height   != null ? parseFloat(merged.height)   : 0.08;
  const wmOpacity = merged.opacity  != null ? parseFloat(merged.opacity)  : 0.8;
  const movement  = merged.movement || 'static';
  const speed     = parseFloat(merged.speed || '80');
  const direction = merged.direction || 'diagonal';
  const interval  = parseFloat(merged.interval || '3.0');
  const fadeDuration = parseFloat(merged['fade-duration'] || '0.5');

  const quality = merged.quality && QUALITY_PRESETS[merged.quality]
    ? merged.quality
    : 'high';

  const overwrite = !!merged.overwrite;
  const dryRun    = !!merged['dry-run'];
  const recursive = !!merged.recursive;
  const suffix    = merged.suffix || '_watermarked';
  const formatOverride = merged.format || null;

  // Build watermark config
  const watermarks = [{
    imagePath:    watermarkPath,
    x:            clamp(wmX,      0, 1),
    y:            clamp(wmY,      0, 1),
    width:        clamp(wmWidth,  0.01, 1),
    height:       clamp(wmHeight, 0.01, 1),
    opacity:      clamp(wmOpacity, 0, 1),
    movement,
    speed,
    direction,
    interval,
    fadeDuration,
  }];

  const processOpts = { quality, overwrite, dryRun, jsonMode };
  const results = [];

  if (isBatch) {
    // ── Batch Mode ──
    const inputDir = inputPath;
    if (!statSync(inputDir).isDirectory()) {
      die(`--batch mode requires --input to be a directory: ${inputDir}`, jsonMode);
    }

    // Ensure output is a directory
    if (!existsSync(outputPath)) {
      mkdirSync(outputPath, { recursive: true });
    } else if (!statSync(outputPath).isDirectory()) {
      die(`In batch mode, --output must be a directory: ${outputPath}`, jsonMode);
    }

    const videos = collectVideos(inputDir, recursive);
    if (videos.length === 0) {
      die(`No supported video files found in: ${inputDir}`, jsonMode);
    }

    log(`\x1b[34mBatch mode:\x1b[0m Found ${videos.length} video(s)`, jsonMode);

    for (const videoFile of videos) {
      const ext = extname(videoFile);
      const name = basename(videoFile, ext);
      const outExt = formatOverride ? `.${formatOverride}` : ext;

      // Preserve relative subdir structure
      const relPath = videoFile.slice(inputDir.length).replace(/^\//, '');
      const relDir  = dirname(relPath);
      const outDir  = relDir === '.' ? outputPath : join(outputPath, relDir);

      const outputFile = join(outDir, `${name}${suffix}${outExt}`);
      const result = processFile(videoFile, outputFile, watermarks, processOpts);
      results.push(result);
    }

    const summary = {
      total:     results.length,
      succeeded: results.filter(r => r.success).length,
      failed:    results.filter(r => r.success === false).length,
      skipped:   results.filter(r => r.skipped).length,
      dryRun:    results.filter(r => r.dryRun).length,
    };

    if (jsonMode) {
      console.log(JSON.stringify({ success: true, batch: true, summary, results }));
    } else {
      log(`\n\x1b[32m✓ Done:\x1b[0m ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped`);
    }
  } else {
    // ── Single File Mode ──
    const vidExt = extname(inputPath);
    if (!SUPPORTED_VIDEO_EXTS.has(vidExt.toLowerCase())) {
      die(`Unsupported video format: ${vidExt}. Supported: ${[...SUPPORTED_VIDEO_EXTS].join(', ')}`, jsonMode);
    }

    const result = processFile(inputPath, outputPath, watermarks, processOpts);
    results.push(result);

    if (jsonMode) {
      const r = results[0];
      console.log(JSON.stringify({
        success: r.success ?? (r.dryRun ? true : undefined) ?? (r.skipped ? true : false),
        ...r,
      }));
    } else if (results[0].success) {
      log(`\n\x1b[32m✓ Output:\x1b[0m ${outputPath}`);
    } else if (!results[0].skipped && !results[0].dryRun) {
      log(`\n\x1b[31m✗ Failed:\x1b[0m ${results[0].error}`);
    }
  }

  const hasFailures = results.some(r => r.success === false);
  process.exit(hasFailures ? 1 : 0);
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
