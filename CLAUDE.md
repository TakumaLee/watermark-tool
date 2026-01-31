# CLAUDE.md — 影片浮水印工具

## 專案概述

跨平台桌面應用程式，用於在影片上疊加浮水印圖片。支援浮水印位置拖放、大小調整、透明度設定、動態移動效果及批次處理。

- **目標平台**：macOS / Windows / Linux
- **狀態**：Phase 0 完成（技術研究 + UI 設計），待進入 Phase 1 開發

## 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **框架** | Tauri 2.0 | 2.x |
| **前端** | React + TypeScript | React 19, TS 5.x |
| **建構** | Vite | 6.x |
| **樣式** | Tailwind CSS | 4.x |
| **狀態管理** | Zustand 或 Jotai | 最新穩定版 |
| **後端** | Rust (Tauri Core) | 隨 Tauri 版本 |
| **影片處理** | FFmpeg (CLI) | 7.x static build |
| **打包** | Tauri Bundler | 內建 |
| **CI/CD** | GitHub Actions + tauri-action | - |

## 專案結構（預期）

```
watermark-tool/
├── CLAUDE.md               # 本檔案
├── SPEC.md                 # 產品規格書
├── PROGRESS.md             # 開發進度追蹤
├── docs/
│   ├── TECH-RESEARCH.md    # 技術研究報告
│   └── UI-DESIGN.md        # UI/UX 設計文件
├── src-tauri/              # Rust 後端
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/       # Tauri commands（前端可呼叫）
│   │   │   ├── ffmpeg.rs   # FFmpeg 呼叫邏輯
│   │   │   ├── file.rs     # 檔案操作
│   │   │   └── preset.rs   # 設定檔管理
│   │   └── ffmpeg/         # FFmpeg 命令組裝
│   │       ├── overlay.rs  # 浮水印 filter 組裝
│   │       ├── batch.rs    # 批次處理
│   │       └── probe.rs    # 影片資訊讀取
│   └── resources/          # FFmpeg 二進位（各平台）
├── src/                    # React 前端
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── VideoPreview/
│   │   ├── WatermarkPanel/
│   │   ├── WatermarkOverlay/
│   │   ├── BottomToolbar/
│   │   └── dialogs/
│   ├── hooks/
│   ├── stores/             # Zustand stores
│   ├── utils/
│   └── styles/
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## 開發規範

### 通用

- 語言：TypeScript（前端），Rust（後端）
- 所有程式碼以英文命名，註解可用中文
- 使用 ESLint + Prettier（前端）、cargo fmt + clippy（Rust）
- 不使用 `any` 型別，所有介面明確定義型別
- 錯誤處理：前端用 try/catch + toast 通知；Rust 用 `Result<T, E>`

### 前端（React + TypeScript）

- 函式組件 + hooks，不使用 class 組件
- 檔案命名：PascalCase（組件），camelCase（工具函式/hooks）
- CSS：Tailwind utility classes 優先，複雜樣式用 CSS Modules
- 狀態：local state 用 `useState`，跨組件共享用 Zustand store
- 所有 Tauri command 呼叫封裝在 `src/hooks/` 或 `src/utils/` 中

### 後端（Rust）

- 所有與前端互動的函式標記 `#[tauri::command]`
- FFmpeg 呼叫使用 `std::process::Command`，非同步執行
- 檔案路徑處理使用 `std::path::PathBuf`，確保跨平台相容
- 錯誤型別統一定義，實作 `Serialize` 以回傳前端

### Git

- 分支策略：`main`（穩定） + `dev`（開發） + `feature/*`（功能）
- Commit 格式：`type(scope): description`
  - type: feat, fix, docs, style, refactor, test, chore
  - 範例：`feat(overlay): add linear movement watermark support`
- PR 合併前需通過 CI 建構

### 測試

- 前端：Vitest + React Testing Library
- 後端：Rust 內建 `#[test]`
- E2E：WebdriverIO（Tauri 支援）

## 關鍵設計決策

1. **預覽與輸出分離**：預覽用 HTML5 Video + DOM 疊加（即時互動），輸出用 FFmpeg CLI（最終渲染品質）
2. **FFmpeg CLI 模式**：不使用 FFmpeg library binding，降低編譯複雜度，CLI 模式足夠滿足需求
3. **浮水印座標系統**：前端使用比例座標（0–1），轉換為 FFmpeg 像素座標時根據輸出解析度計算
4. **設定檔格式**：JSON，存放在使用者 app data 目錄

## 常用指令

```bash
# 開發
npm run tauri dev          # 啟動開發環境（前端 + Tauri）

# 建構
npm run tauri build        # 建構生產版本

# 前端獨立開發
npm run dev                # 僅啟動 Vite dev server

# 程式碼品質
npm run lint               # ESLint 檢查
npm run format             # Prettier 格式化
cargo fmt                  # Rust 格式化
cargo clippy               # Rust lint

# 測試
npm run test               # 前端測試
cargo test                 # Rust 測試
```

## 相關文件

- [SPEC.md](./SPEC.md) — 產品需求規格書
- [docs/TECH-RESEARCH.md](./docs/TECH-RESEARCH.md) — 技術研究報告
- [docs/UI-DESIGN.md](./docs/UI-DESIGN.md) — UI/UX 設計文件
- [PROGRESS.md](./PROGRESS.md) — 開發進度追蹤
