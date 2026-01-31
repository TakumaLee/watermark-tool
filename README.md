# 影片浮水印工具 (Video Watermark Tool)

<p align="center">
  <img src="docs/screenshots/app-preview.png" alt="App Preview" width="800" />
</p>

> 跨平台桌面應用程式，用於在影片上疊加圖片浮水印。支援拖放定位、大小調整、透明度、動態移動效果及批次處理。

[![Build Status](https://github.com/YOUR_ORG/watermark-tool/actions/workflows/build.yml/badge.svg)](https://github.com/YOUR_ORG/watermark-tool/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ 功能特色

- 🎬 **影片匯入** — 支援 MP4、MOV、AVI、MKV 等常見格式，拖放或選擇檔案
- 🖼️ **浮水印疊加** — 支援 PNG、JPG、SVG、GIF、WebP 圖片
- 🖱️ **拖放定位** — 直接在預覽畫面上拖動浮水印到任意位置
- 📐 **縮放調整** — 四角拖動調整大小，支援鎖定/自由比例
- 🔲 **透明度控制** — 滑桿即時調整浮水印透明度
- ↔️ **動態移動** — 三種模式：固定、線性移動（水平/垂直/對角線，bounce 效果）、隨機出現
- 📦 **批次處理** — 一次對多個影片套用相同浮水印設定
- 💾 **設定檔** — 儲存/載入浮水印配置，快速重複使用
- 🎨 **深色主題** — 專為影片編輯設計的深色 UI
- 🔄 **自動更新** — 內建更新機制，自動檢查新版本

## 📸 截圖

| 主畫面 | 浮水印編輯 | 批次處理 |
|--------|-----------|---------|
| ![Main](docs/screenshots/main.png) | ![Edit](docs/screenshots/edit.png) | ![Batch](docs/screenshots/batch.png) |

> 📌 *截圖 placeholder — 正式版本發布時更新*

## 📥 安裝

### 下載安裝包

前往 [Releases](https://github.com/YOUR_ORG/watermark-tool/releases) 頁面下載對應平台的安裝包：

| 平台 | 格式 | 檔案 |
|------|------|------|
| **macOS** | DMG | `watermark-tool_x.x.x_x64.dmg` / `_aarch64.dmg` |
| **Windows** | NSIS 安裝程式 | `watermark-tool_x.x.x_x64-setup.exe` |
| **Linux** | AppImage | `watermark-tool_x.x.x_amd64.AppImage` |
| **Linux** | Debian | `watermark-tool_x.x.x_amd64.deb` |

### 系統需求

- **作業系統**：macOS 10.15+、Windows 10+、Ubuntu 20.04+ / 主流 Linux 發行版
- **FFmpeg**：需要安裝 FFmpeg 7.x（或使用應用內建的 FFmpeg）

#### 安裝 FFmpeg

```bash
# macOS (Homebrew)
brew install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Windows (Scoop)
scoop install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

## 🚀 使用方式

### 基本流程

1. **匯入影片** — 拖放影片到主畫面，或點擊「匯入影片」選擇檔案
2. **新增浮水印** — 在右側面板點擊「選擇圖片」匯入浮水印圖片
3. **調整位置** — 在預覽畫面上拖動浮水印到想要的位置
4. **調整屬性** — 透過右側面板調整大小、透明度、移動效果
5. **輸出** — 點擊底部「開始輸出」，選擇格式和品質

### 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Space` | 播放 / 暫停 |
| `Delete` / `Backspace` | 刪除選中浮水印 |
| `Escape` | 取消選取 |
| `Arrow Keys` | 微調浮水印位置（~1px） |
| `Shift + Arrow Keys` | 大幅調整位置（~10px） |

### 移動效果

| 模式 | 說明 |
|------|------|
| **固定** | 浮水印固定在指定位置 |
| **線性移動** | 沿水平/垂直/對角線方向來回移動，可調速度 |
| **隨機出現** | 定期在不同位置出現，可調頻率和淡入淡出 |

### 批次處理

1. 先設定好浮水印配置
2. 點擊「批次處理」按鈕
3. 選擇多個影片檔案
4. 設定輸出命名規則和品質
5. 開始處理，進度條顯示每個檔案狀態

### 設定檔

- **儲存設定** — 將當前浮水印配置儲存為 `.json` 檔案
- **快速儲存** — 儲存到應用資料目錄，方便下次載入
- **載入設定** — 從檔案或已儲存列表載入配置

## 🛠️ 開發指南

### 環境需求

- **Node.js** 20+
- **Rust** 1.77+
- **FFmpeg** 7.x（系統安裝）
- **系統依賴**（Linux）：
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev
  ```

### 快速開始

```bash
# Clone
git clone https://github.com/YOUR_ORG/watermark-tool.git
cd watermark-tool

# 安裝前端依賴
npm install

# 啟動開發環境（前端 + Tauri）
npm run tauri dev

# 前端獨立開發（僅 Vite dev server）
npm run dev
```

### 專案結構

```
watermark-tool/
├── .github/workflows/     # CI/CD 設定
├── docs/                  # 技術文件
├── src/                   # React 前端
│   ├── components/        # UI 組件
│   ├── hooks/             # 自訂 hooks
│   ├── stores/            # Zustand 狀態管理
│   ├── types/             # TypeScript 型別
│   ├── utils/             # 工具函式
│   └── test/              # 測試設定
├── src-tauri/             # Rust 後端
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   └── ffmpeg/        # FFmpeg 命令組裝
│   └── icons/             # 應用圖示
├── vitest.config.ts       # 前端測試設定
├── CLAUDE.md              # 開發規範
├── SPEC.md                # 產品規格
└── PROGRESS.md            # 開發進度
```

### 常用指令

```bash
# 開發
npm run tauri dev          # 啟動完整開發環境
npm run dev                # 僅前端 dev server

# 建構
npm run tauri build        # 建構生產版本

# 測試
npm run test               # 前端單元測試（Vitest）
npm run test:watch         # 前端測試（watch 模式）
npm run test:coverage      # 前端測試覆蓋率報告
cd src-tauri && cargo test # Rust 後端測試

# 程式碼品質
npm run lint               # ESLint 檢查
cargo fmt                  # Rust 格式化
cargo clippy               # Rust lint
```

### 技術棧

| 層級 | 技術 |
|------|------|
| 框架 | [Tauri 2.0](https://v2.tauri.app/) |
| 前端 | React 19 + TypeScript 5 |
| 建構 | Vite 7 |
| 樣式 | Tailwind CSS 4 |
| 狀態 | Zustand |
| 後端 | Rust |
| 影片處理 | FFmpeg CLI |
| 測試 | Vitest + React Testing Library (前端) / cargo test (Rust) |
| CI/CD | GitHub Actions + tauri-action |

### Git 分支

- `main` — 穩定版本
- `dev` — 開發分支
- `feature/*` — 功能分支

### Commit 格式

```
type(scope): description

# Examples:
feat(overlay): add diagonal movement support
fix(batch): handle FFmpeg timeout error
docs(readme): update installation guide
test(store): add watermarkStore unit tests
```

## 📄 授權

MIT License — 詳見 [LICENSE](LICENSE)

## 🙏 致謝

- [Tauri](https://tauri.app/) — 跨平台桌面框架
- [FFmpeg](https://ffmpeg.org/) — 影片處理引擎
- [React](https://react.dev/) — UI 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 工具
