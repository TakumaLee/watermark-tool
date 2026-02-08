#!/usr/bin/env python3
"""
Generate valid license keys for the watermark tool.

Format: WMT-PRO-XXXX-XXXX-XXXX
- Prefix: WMT-PRO-
- 3 groups of 4 alphanumeric chars (uppercase)
- Last 4 chars = CRC16 hex of everything before it

Usage: python generate_license.py --count 10
"""

import argparse
import random
import string


def crc16(data: bytes) -> int:
    """CRC-16/CCITT-FALSE"""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc = crc << 1
            crc &= 0xFFFF
    return crc


def generate_key() -> str:
    chars = string.ascii_uppercase + string.digits
    # Generate first 2 groups randomly
    g1 = ''.join(random.choices(chars, k=4))
    g2 = ''.join(random.choices(chars, k=4))

    # Compute checksum for prefix + first 2 groups
    prefix_part = f"WMT-PRO-{g1}-{g2}-"
    checksum = crc16(prefix_part.encode('ascii'))
    g3 = f"{checksum:04X}"

    return f"WMT-PRO-{g1}-{g2}-{g3}"


def validate_key(key: str) -> bool:
    """Validate a license key."""
    if not key.startswith("WMT-PRO-"):
        return False
    parts = key.split("-")
    if len(parts) != 5:
        return False
    # parts: ["WMT", "PRO", "XXXX", "XXXX", "XXXX"]
    allowed = set(string.ascii_uppercase + string.digits)
    for p in parts[2:]:
        if len(p) != 4 or not all(c in allowed for c in p):
            return False
    # Checksum: last 4 chars = CRC16 of everything before
    prefix_part = f"{parts[0]}-{parts[1]}-{parts[2]}-{parts[3]}-"
    expected = crc16(prefix_part.encode('ascii'))
    actual = int(parts[4], 16)
    return expected == actual


def main():
    parser = argparse.ArgumentParser(description="Generate license keys")
    parser.add_argument("--count", type=int, default=1, help="Number of keys to generate")
    parser.add_argument("--validate", type=str, help="Validate a key instead of generating")
    args = parser.parse_args()

    if args.validate:
        valid = validate_key(args.validate)
        print(f"Key: {args.validate}")
        print(f"Valid: {valid}")
        return

    for _ in range(args.count):
        key = generate_key()
        assert validate_key(key), f"Generated invalid key: {key}"
        print(key)


if __name__ == "__main__":
    main()
