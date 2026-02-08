use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub is_valid: bool,
    pub tier: String,
    pub features: Vec<String>,
}

impl LicenseInfo {
    pub fn free() -> Self {
        Self {
            is_valid: false,
            tier: "free".to_string(),
            features: vec![],
        }
    }

    pub fn pro() -> Self {
        Self {
            is_valid: true,
            tier: "pro".to_string(),
            features: vec!["watermark_removal".to_string()],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredLicense {
    key_b64: String,
}

fn license_file_path() -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or_else(|| "Cannot determine app data directory".to_string())?
        .join("com.watermark-tool.app");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    Ok(dir.join("license.json"))
}

/// CRC-16/CCITT-FALSE
fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    crc
}

fn validate_key_format(key: &str) -> bool {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    if parts[0] != "WMT" || parts[1] != "PRO" {
        return false;
    }
    let allowed: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for &p in &parts[2..] {
        if p.len() != 4 || !p.bytes().all(|b| allowed.contains(&b)) {
            return false;
        }
    }
    // Checksum: last group = CRC16 of prefix part
    let prefix_part = format!("{}-{}-{}-{}-", parts[0], parts[1], parts[2], parts[3]);
    let expected = crc16(prefix_part.as_bytes());
    let actual = u16::from_str_radix(parts[4], 16).unwrap_or(0);
    expected == actual
}

fn read_stored_key() -> Option<String> {
    let path = license_file_path().ok()?;
    let content = std::fs::read_to_string(&path).ok()?;
    let stored: StoredLicense = serde_json::from_str(&content).ok()?;
    let decoded = String::from_utf8(
        base64_decode(&stored.key_b64)?
    ).ok()?;
    Some(decoded)
}

fn store_key(key: &str) -> Result<(), String> {
    let path = license_file_path()?;
    let b64 = base64_encode(key.as_bytes());
    let stored = StoredLicense { key_b64: b64 };
    let json = serde_json::to_string_pretty(&stored)
        .map_err(|e| format!("Serialization error: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write license file: {}", e))?;
    Ok(())
}

// Simple base64 encode/decode (no external dep needed)
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn base64_decode(s: &str) -> Option<Vec<u8>> {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let s = s.trim_end_matches('=');
    let mut result = Vec::new();
    let bytes: Vec<u8> = s.bytes().collect();
    for chunk in bytes.chunks(4) {
        let vals: Vec<u32> = chunk.iter().map(|&b| {
            CHARS.iter().position(|&c| c == b).unwrap_or(0) as u32
        }).collect();
        let v0 = vals.first().copied().unwrap_or(0);
        let v1 = vals.get(1).copied().unwrap_or(0);
        let v2 = vals.get(2).copied().unwrap_or(0);
        let v3 = vals.get(3).copied().unwrap_or(0);
        let triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
        result.push(((triple >> 16) & 0xFF) as u8);
        if chunk.len() > 2 {
            result.push(((triple >> 8) & 0xFF) as u8);
        }
        if chunk.len() > 3 {
            result.push((triple & 0xFF) as u8);
        }
    }
    Some(result)
}

#[tauri::command]
pub async fn validate_license(key: String) -> Result<LicenseInfo, String> {
    let key = key.trim().to_uppercase();
    if !validate_key_format(&key) {
        return Ok(LicenseInfo::free());
    }
    store_key(&key)?;
    Ok(LicenseInfo::pro())
}

#[tauri::command]
pub async fn get_license_status() -> Result<LicenseInfo, String> {
    match read_stored_key() {
        Some(key) if validate_key_format(&key) => Ok(LicenseInfo::pro()),
        _ => Ok(LicenseInfo::free()),
    }
}

#[tauri::command]
pub async fn clear_license() -> Result<(), String> {
    let path = license_file_path()?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove license file: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crc16() {
        let data = b"WMT-PRO-ABCD-EF12-";
        let crc = crc16(data);
        assert!(crc > 0);
    }

    #[test]
    fn test_base64_roundtrip() {
        let original = "WMT-PRO-ABCD-1234-FF00";
        let encoded = base64_encode(original.as_bytes());
        let decoded = base64_decode(&encoded).unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), original);
    }

    #[test]
    fn test_validate_key_format_valid() {
        // Generate a valid key: prefix + CRC16
        let prefix = "WMT-PRO-AAAA-BBBB-";
        let crc = crc16(prefix.as_bytes());
        let key = format!("WMT-PRO-AAAA-BBBB-{:04X}", crc);
        assert!(validate_key_format(&key));
    }

    #[test]
    fn test_validate_key_format_invalid() {
        assert!(!validate_key_format("INVALID-KEY"));
        assert!(!validate_key_format("WMT-PRO-AAAA-BBBB-0000"));
    }
}
