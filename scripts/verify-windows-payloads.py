"""Compare unsigned Tauri 2.9.6 Windows payloads, allowing only its bundle marker.

Reference: tauri-apps/tauri at tauri-cli-v2.9.6,
crates/tauri-bundler/src/bundle/windows/util.rs::patch_binary.
Uses only Python's standard library (available on windows-latest).
"""

import hashlib
from pathlib import Path
import struct
import sys


def normalized_payload(path: Path, expected_marker: bytes) -> tuple[bytes, int]:
    data = bytearray(path.read_bytes())
    if data[:2] != b"MZ":
        raise ValueError("Missing DOS executable header")
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe:pe + 4] != b"PE\0\0":
        raise ValueError("Missing PE header")
    machine, count = struct.unpack_from("<HH", data, pe + 4)
    optional_size = struct.unpack_from("<H", data, pe + 20)[0]
    optional = pe + 24
    if machine != 0x8664 or struct.unpack_from("<H", data, optional)[0] != 0x20B:
        raise ValueError("Expected Windows x64 PE32+ payload")
    image_base = struct.unpack_from("<Q", data, optional + 24)[0]
    sections = {}
    for index in range(count):
        header = optional + optional_size + index * 40
        name = bytes(data[header:header + 8]).rstrip(b"\0")
        if name in sections:
            raise ValueError("Duplicate PE section")
        sections[name] = struct.unpack_from("<IIII", data, header + 8)
    _, _, bundle_size, bundle_raw = sections[b".taubndl"]
    _, rdata_rva, rdata_size, rdata_raw = sections[b".rdata"]
    if bundle_size < 8 or bundle_raw + 8 > len(data):
        raise ValueError("Invalid Tauri bundle pointer")
    pointer = struct.unpack_from("<Q", data, bundle_raw)[0]
    relative = pointer - image_base - rdata_rva
    offset = rdata_raw + relative
    if relative < 0 or relative + 3 > rdata_size or offset + 3 > len(data):
        raise ValueError("Bundle marker is outside .rdata")
    if data[offset:offset + 3] != expected_marker:
        raise ValueError(f"Expected bundle marker {expected_marker!r}")
    data[offset:offset + 3] = b"UNK"
    return bytes(data), offset


def verify(nsis: Path, msi: Path) -> str:
    nsis_data, nsis_offset = normalized_payload(nsis, b"NSS")
    msi_data, msi_offset = normalized_payload(msi, b"MSI")
    if nsis_offset != msi_offset or nsis_data != msi_data:
        raise ValueError("Application payload differs beyond the Tauri bundle marker")
    digest = hashlib.sha256(nsis_data).hexdigest()
    print(f"App payloads match except NSS/MSI at byte {nsis_offset}; normalized SHA256 {digest}")
    return digest


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify-windows-payloads.py NSIS_APP MSI_APP")
    verify(Path(sys.argv[1]), Path(sys.argv[2]))
