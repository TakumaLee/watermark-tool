# FFmpeg 二進位打包策略

## 概述

本應用使用 FFmpeg CLI 進行影片處理（浮水印疊加、影片探測）。由於 FFmpeg 是外部二進位檔案，需要為各平台分別處理打包策略。

## 策略：Sidecar Static Binary

使用 **Tauri sidecar** 機制，將 FFmpeg static binary 作為應用的附帶資源分發。

### 各平台 FFmpeg Static Binary 來源

| 平台 | 來源 | 下載方式 |
|------|------|---------|
| **macOS (Intel)** | [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) | 下載 `ffmpeg` + `ffprobe` static builds |
| **macOS (Apple Silicon)** | [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) | ARM64 builds available |
| **Windows** | [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/) | `ffmpeg-release-essentials.zip` |
| **Linux** | [johnvansickle.com/ffmpeg](https://johnvansickle.com/ffmpeg/) | Static builds (amd64) |

### 目錄結構

```
src-tauri/
├── binaries/
│   ├── ffmpeg-x86_64-apple-darwin       # macOS Intel
│   ├── ffprobe-x86_64-apple-darwin
│   ├── ffmpeg-aarch64-apple-darwin      # macOS ARM
│   ├── ffprobe-aarch64-apple-darwin
│   ├── ffmpeg-x86_64-pc-windows-msvc.exe  # Windows
│   ├── ffprobe-x86_64-pc-windows-msvc.exe
│   ├── ffmpeg-x86_64-unknown-linux-gnu  # Linux
│   └── ffprobe-x86_64-unknown-linux-gnu
```

### Tauri Sidecar 設定

在 `tauri.conf.json` 的 `bundle.externalBin` 中加入：

```json
{
  "bundle": {
    "externalBin": [
      "binaries/ffmpeg",
      "binaries/ffprobe"
    ]
  }
}
```

Tauri 會自動根據編譯目標的 triple（如 `x86_64-apple-darwin`）選擇對應的二進位檔案。

### Rust 端使用 Sidecar

```rust
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

// 使用 sidecar 呼叫 ffmpeg
let sidecar = app.shell().sidecar("ffmpeg").unwrap();
let (mut rx, _child) = sidecar
    .args(["-i", "input.mp4", "-y", "output.mp4"])
    .spawn()
    .expect("Failed to spawn ffmpeg sidecar");
```

### 替代方案：系統 PATH 回退

如果 sidecar 不可用（開發環境），回退到系統 `$PATH` 中的 FFmpeg：

```rust
fn get_ffmpeg_path(app: &tauri::AppHandle) -> String {
    // 優先使用 sidecar
    if let Ok(sidecar_path) = app.path().resource_dir() {
        let ffmpeg = sidecar_path.join("ffmpeg");
        if ffmpeg.exists() {
            return ffmpeg.to_string_lossy().to_string();
        }
    }
    // 回退到系統 PATH
    "ffmpeg".to_string()
}
```

### CI/CD 自動下載

在 GitHub Actions 中，可在 build step 前自動下載 FFmpeg static binary：

```yaml
- name: Download FFmpeg (macOS)
  if: runner.os == 'macOS'
  run: |
    mkdir -p src-tauri/binaries
    curl -L "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/7.0" -o ffmpeg.7z
    7z x ffmpeg.7z -o src-tauri/binaries/
    mv src-tauri/binaries/ffmpeg src-tauri/binaries/ffmpeg-${{ matrix.platform.target }}
    chmod +x src-tauri/binaries/ffmpeg-${{ matrix.platform.target }}
    # Repeat for ffprobe

- name: Download FFmpeg (Windows)
  if: runner.os == 'Windows'
  run: |
    mkdir -p src-tauri/binaries
    Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile ffmpeg.zip
    Expand-Archive ffmpeg.zip -DestinationPath ffmpeg-tmp
    Copy-Item "ffmpeg-tmp/ffmpeg-*-essentials_build/bin/ffmpeg.exe" "src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe"
    Copy-Item "ffmpeg-tmp/ffmpeg-*-essentials_build/bin/ffprobe.exe" "src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe"

- name: Download FFmpeg (Linux)
  if: runner.os == 'Linux'
  run: |
    mkdir -p src-tauri/binaries
    curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o ffmpeg.tar.xz
    tar xf ffmpeg.tar.xz
    cp ffmpeg-*-amd64-static/ffmpeg src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu
    cp ffmpeg-*-amd64-static/ffprobe src-tauri/binaries/ffprobe-x86_64-unknown-linux-gnu
    chmod +x src-tauri/binaries/*
```

### 開發環境

開發時不需要 sidecar，只需確保系統已安裝 FFmpeg：

```bash
# macOS
brew install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

### 檔案大小考量

| 平台 | FFmpeg + FFprobe 大小 |
|------|--------------------|
| macOS | ~70-80 MB |
| Windows | ~80-90 MB |
| Linux | ~70-80 MB |

**注意**：Static build 較大。如需減小，可使用自訂編譯的 minimal FFmpeg（僅含必要 codecs）。

### 未來優化

1. **首次啟動下載**：應用首次啟動時自動下載 FFmpeg，避免增大安裝包
2. **自訂 FFmpeg build**：只編譯 libx264、libx265、aac 等常用 codec
3. **共享 FFmpeg**：偵測系統已安裝的 FFmpeg，避免重複
