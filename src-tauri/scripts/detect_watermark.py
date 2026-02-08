#!/usr/bin/env python3
"""
Detect watermark regions in a video by analyzing static, semi-transparent areas.

Algorithm:
1. Extract N frames uniformly from the video using FFmpeg
2. Compute per-pixel standard deviation across all frames
3. Low-std + high-brightness regions = candidate watermarks
4. Threshold + contour detection to find bounding boxes
5. Output JSON: [{"x": int, "y": int, "width": int, "height": int, "confidence": float}]

Dependencies: opencv-python-headless, numpy
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import shutil

import cv2
import numpy as np


def extract_frames(video_path: str, num_frames: int, tmp_dir: str) -> list[str]:
    """Extract frames uniformly from the video using FFmpeg."""
    # Get duration
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", video_path],
        capture_output=True, text=True
    )
    duration = float(json.loads(probe.stdout)["format"]["duration"])

    frame_paths = []
    for i in range(num_frames):
        t = duration * i / max(num_frames, 1)
        out_path = os.path.join(tmp_dir, f"frame_{i:04d}.png")
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", video_path,
             "-frames:v", "1", "-q:v", "2", out_path],
            capture_output=True
        )
        if os.path.exists(out_path):
            frame_paths.append(out_path)

    return frame_paths


def detect_watermark_regions(frame_paths: list[str], threshold: float) -> list[dict]:
    """Analyze frames to find static, semi-transparent (watermark) regions."""
    if len(frame_paths) < 2:
        return []

    # Load all frames as float32 grayscale
    frames = []
    for p in frame_paths:
        img = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
        if img is not None:
            frames.append(img.astype(np.float32))

    if len(frames) < 2:
        return []

    h, w = frames[0].shape
    stack = np.stack(frames, axis=0)  # (N, H, W)

    # Per-pixel std across frames — low std = static region
    std_map = np.std(stack, axis=0)  # (H, W)

    # Per-pixel mean — high mean = bright / semi-transparent overlay
    mean_map = np.mean(stack, axis=0)  # (H, W)

    # Candidate mask: low variance AND relatively bright
    static_mask = (std_map < threshold).astype(np.uint8)

    # Brightness threshold: above median + 20 (semi-transparent watermarks tend to be brighter)
    median_brightness = np.median(mean_map)
    bright_mask = (mean_map > median_brightness + 20).astype(np.uint8)

    # Combined
    candidate_mask = cv2.bitwise_and(static_mask, bright_mask) * 255

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_CLOSE, kernel)
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_OPEN, kernel)

    # Ignore large regions (>30% of frame) — probably not watermarks
    # Also ignore tiny regions (<0.1% of frame)
    total_pixels = h * w
    min_area = total_pixels * 0.001
    max_area = total_pixels * 0.3

    # Ignore center region (watermarks are usually at edges/corners)
    # Mask out center 60%
    edge_mask = np.ones((h, w), dtype=np.uint8) * 255
    cy, cx = h // 2, w // 2
    margin_y, margin_x = int(h * 0.3), int(w * 0.3)
    edge_mask[cy - margin_y:cy + margin_y, cx - margin_x:cx + margin_x] = 0
    candidate_mask = cv2.bitwise_and(candidate_mask, edge_mask)

    # Find contours
    contours, _ = cv2.findContours(candidate_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    results = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)

        # Confidence based on how static and bright the region is
        roi_std = std_map[y:y+bh, x:x+bw]
        roi_mean = mean_map[y:y+bh, x:x+bw]

        avg_std = float(np.mean(roi_std))
        avg_brightness = float(np.mean(roi_mean))

        # Lower std → higher confidence; higher brightness → higher confidence
        std_score = max(0, 1.0 - avg_std / (threshold * 2))
        bright_score = min(1.0, avg_brightness / 200.0)
        confidence = round((std_score * 0.7 + bright_score * 0.3), 3)

        # Add padding (10px)
        pad = 10
        x = max(0, x - pad)
        y = max(0, y - pad)
        bw = min(w - x, bw + pad * 2)
        bh = min(h - y, bh + pad * 2)

        results.append({
            "x": int(x),
            "y": int(y),
            "width": int(bw),
            "height": int(bh),
            "confidence": confidence,
        })

    # Sort by confidence descending
    results.sort(key=lambda r: r["confidence"], reverse=True)

    # Limit to top 5
    return results[:5]


def main():
    parser = argparse.ArgumentParser(description="Detect watermark regions in a video")
    parser.add_argument("--input", required=True, help="Input video path")
    parser.add_argument("--frames", type=int, default=30, help="Number of frames to sample")
    parser.add_argument("--threshold", type=float, default=15.0, help="Std deviation threshold for static detection")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(json.dumps({"error": f"File not found: {args.input}"}), file=sys.stderr)
        sys.exit(1)

    tmp_dir = tempfile.mkdtemp(prefix="wm_detect_")
    try:
        frame_paths = extract_frames(args.input, args.frames, tmp_dir)
        regions = detect_watermark_regions(frame_paths, args.threshold)
        print(json.dumps(regions))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
