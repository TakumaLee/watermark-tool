#!/usr/bin/env python3
"""
Generate a binary mask PNG for watermark removal.
White regions = areas to inpaint (watermark), Black = preserve.

Usage:
  python generate_mask.py --width 1920 --height 1080 --regions "10,20,100,50;300,400,200,80" --output mask.png

Optional OpenCV inpainting fallback:
  python generate_mask.py --inpaint --input-dir ./frames --output-dir ./output \
    --width 1920 --height 1080 --regions "10,20,100,50" --method opencv-telea
"""

import argparse
import os
import sys

def create_mask(width: int, height: int, regions: list[tuple[int, int, int, int]]) -> "Image":
    """Create a black image with white rectangles for each region."""
    from PIL import Image, ImageDraw

    mask = Image.new("L", (width, height), 0)  # black background
    draw = ImageDraw.Draw(mask)
    for x, y, w, h in regions:
        draw.rectangle([x, y, x + w, y + h], fill=255)  # white = inpaint
    return mask


def parse_regions(regions_str: str) -> list[tuple[int, int, int, int]]:
    """Parse 'x,y,w,h;x,y,w,h' into list of tuples."""
    regions = []
    for part in regions_str.split(";"):
        part = part.strip()
        if not part:
            continue
        vals = [int(v) for v in part.split(",")]
        if len(vals) != 4:
            raise ValueError(f"Invalid region: {part}, expected x,y,w,h")
        regions.append(tuple(vals))
    return regions


def inpaint_opencv(input_dir: str, output_dir: str, width: int, height: int,
                   regions: list[tuple[int, int, int, int]], method: str = "opencv-telea"):
    """Fallback: use OpenCV inpainting on each frame."""
    import cv2
    import numpy as np

    # Create mask as numpy array
    mask = np.zeros((height, width), dtype=np.uint8)
    for x, y, w, h in regions:
        mask[y:y+h, x:x+w] = 255

    inpaint_method = cv2.INPAINT_TELEA if "telea" in method else cv2.INPAINT_NS

    os.makedirs(output_dir, exist_ok=True)

    frames = sorted([f for f in os.listdir(input_dir) if f.endswith(".png")])
    for i, fname in enumerate(frames):
        img = cv2.imread(os.path.join(input_dir, fname))
        if img is None:
            continue
        result = cv2.inpaint(img, mask, inpaintRadius=3, flags=inpaint_method)
        cv2.imwrite(os.path.join(output_dir, fname), result)

        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1}/{len(frames)} frames", flush=True)

    print(f"Done: {len(frames)} frames processed", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Generate mask PNG for watermark removal")
    parser.add_argument("--width", type=int, required=True, help="Image width")
    parser.add_argument("--height", type=int, required=True, help="Image height")
    parser.add_argument("--regions", type=str, required=True, help="Regions: x,y,w,h;x,y,w,h")
    parser.add_argument("--output", type=str, default="mask.png", help="Output mask path")

    # OpenCV inpainting fallback mode
    parser.add_argument("--inpaint", action="store_true", help="Run OpenCV inpainting on frames")
    parser.add_argument("--input-dir", type=str, help="Input frames directory")
    parser.add_argument("--output-dir", type=str, help="Output frames directory")
    parser.add_argument("--method", type=str, default="opencv-telea",
                        help="Inpainting method: opencv-telea or opencv-ns")

    args = parser.parse_args()
    regions = parse_regions(args.regions)

    if args.inpaint:
        if not args.input_dir or not args.output_dir:
            print("Error: --input-dir and --output-dir required for --inpaint mode", file=sys.stderr)
            sys.exit(1)
        inpaint_opencv(args.input_dir, args.output_dir, args.width, args.height, regions, args.method)
    else:
        mask = create_mask(args.width, args.height, regions)
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        mask.save(args.output)
        print(f"Mask saved to {args.output}")


if __name__ == "__main__":
    main()
