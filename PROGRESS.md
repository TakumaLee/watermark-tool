# 開發進度追蹤

## 總覽

| 階段 | 內容 | 狀態 | 完成日期 |
|------|------|------|---------|
| **Phase 0** | 技術研究 + UI/UX 設計 | ✅ 已完成 | 2026-01-31 |
| **Phase 1** | 基礎框架 + 影片匯入 + 預覽 | ✅ 已完成 | 2026-02-01 |
| **Phase 2** | 浮水印匯入 + 拖放定位 + 尺寸調整 | ✅ 已完成 | 2026-02-01 |
| **Phase 3** | 透明度 + 移動效果 | ✅ 已完成 | 2026-02-02 |
| **Phase 4** | 儲存設定 + 批次處理 | ✅ 已完成 | 2026-02-02 |
| **Phase 5** | 跨平台打包 + 測試 | ✅ 已完成 | 2026-02-02 |
| **Phase 6** | 模組化系統 + 基礎剪輯功能 | ✅ 已完成 | 2026-02-02 |
| **Phase 7** | 文字疊加 + 字幕 | ✅ 已完成 | 2026-02-02 |

---

## Phase 0 — 技術研究 + UI/UX 設計

**狀態：✅ 已完成**
**日期：2026-01-31**

### 交付物

| 文件 | 路徑 | 狀態 |
|------|------|------|
| 技術研究報告 | `docs/TECH-RESEARCH.md` | ✅ |
| UI/UX 設計文件 | `docs/UI-DESIGN.md` | ✅ |
| 專案設定檔 | `CLAUDE.md` | ✅ |
| 進度追蹤 | `PROGRESS.md` | ✅ |

### 技術決策摘要

| 項目 | 選定方案 | 理由 |
|------|---------|------|
| 桌面框架 | **Tauri 2.0** | 打包小、效能優、Web 前端開發效率高 |
| 前端框架 | **React 19 + TypeScript** | 生態成熟、開發效率最高 |
| 樣式方案 | **Tailwind CSS** | 深色主題實作方便、開發快速 |
| 影片處理 | **FFmpeg CLI** | 浮水印功能完備、效能最優、跨平台 |
| 預覽引擎 | **HTML5 Video + DOM 疊加** | 即時互動、無需額外依賴 |
| 打包方式 | **Tauri 內建** | DMG / NSIS(.exe) / AppImage |

### 完成項目

- [x] 比較 Electron / Tauri / Flutter / Qt / .NET MAUI 五個框架
- [x] 比較 FFmpeg / GStreamer / MoviePy / OpenCV 四個影片處理引擎
- [x] 設計預覽引擎方案（HTML5 Video + DOM/Canvas 疊加）
- [x] 確認各平台打包方式
- [x] 設計深色主題色彩系統
- [x] 設計主畫面佈局（影片預覽 + 浮水印面板）
- [x] 設計所有對話框（輸出、批次處理、設定、速度、頻率）
- [x] 設計選單結構與鍵盤快速鍵
- [x] 設計完整 User Flow（匯入 → 編輯 → 輸出）
- [x] 設計響應式佈局策略
- [x] 建立 CLAUDE.md 專案規範

---

## Phase 1 — 基礎框架 + 影片匯入 + 預覽

**狀態：✅ 已完成**
**日期：2026-02-01**

### 完成項目

- [x] 初始化 Tauri 2.0 + React 19 + TypeScript 專案（確認結構完整）
- [x] 設定 Tailwind CSS 4.x 深色主題（自訂色彩系統 via @theme）
- [x] 實作主畫面佈局（AppShell：標題列 + 左側影片預覽 + 右側面板 + 底部工具列）
- [x] 實作影片匯入功能（Tauri 原生拖放 + 檔案選擇對話框）
- [x] 實作影片預覽播放（HTML5 Video，含播放/暫停/seek/進度條拖動）
- [x] 實作影片比例自適應（object-fit: contain，支援直式/橫式/正方形）
- [x] 整合 FFmpeg CLI（Rust 端：probe_video 命令讀取影片資訊）
- [x] 實作空狀態 UI（拖放提示 + 支援格式說明）

### 技術細節

#### 前端架構
| 項目 | 實作方式 |
|------|---------|
| 狀態管理 | Zustand store（`videoStore.ts`） |
| 影片匯入 | `useVideoImport` hook，封裝 Tauri dialog + invoke |
| 拖放 | Tauri 2.0 `onDragDropEvent` API（原生拖放） |
| 預覽播放 | HTML5 `<video>` + 自訂播放控制列 |
| 比例適應 | `object-fit: contain` + letterbox 深色背景 |
| 樣式系統 | Tailwind CSS 4.x `@theme` 自訂 tokens |
| 鍵盤快捷鍵 | Space 播放/暫停 |

#### 元件結構
```
src/
├── App.tsx                      # AppShell 主佈局
├── components/
│   ├── VideoPreview/
│   │   ├── VideoPreview.tsx     # 預覽容器（拖放 + 狀態切換）
│   │   ├── VideoPlayer.tsx      # 影片播放器 + 控制列
│   │   ├── EmptyState.tsx       # 空狀態提示
│   │   └── LoadingState.tsx     # 載入中動畫
│   ├── WatermarkPanel/
│   │   └── WatermarkPanel.tsx   # 右側面板（影片資訊 + 浮水印欄位預留）
│   └── BottomToolbar/
│       └── BottomToolbar.tsx    # 底部工具列
├── stores/
│   └── videoStore.ts            # 影片狀態 Zustand store
├── hooks/
│   └── useVideoImport.ts       # 影片匯入邏輯
├── types/
│   ├── video.ts                # VideoInfo 等型別定義
│   └── index.ts
└── utils/
    ├── formatTime.ts           # 時間/檔案大小格式化
    └── aspectRatio.ts          # 比例判斷工具
```

#### Rust 後端（Phase 0 已建立，Phase 1 驗證整合）
- `commands/ffmpeg.rs` — `probe_video` 命令，呼叫 ffprobe 讀取影片資訊
- `ffmpeg/probe.rs` — ffprobe JSON 解析
- `ffmpeg/overlay.rs` — filter_complex 組裝（Phase 3 使用）
- `ffmpeg/batch.rs` — 批次處理邏輯（Phase 4 使用）

### 色彩系統

| 用途 | CSS Variable | 色碼 |
|------|-------------|------|
| 背景（主） | `--color-bg-primary` | `#1a1a2e` |
| 背景（次） | `--color-bg-secondary` | `#16213e` |
| 背景（元件） | `--color-bg-component` | `#0f3460` |
| 強調色 | `--color-accent` | `#e94560` |
| 文字（主） | `--color-text-primary` | `#eaeaea` |
| 文字（次） | `--color-text-secondary` | `#8892b0` |
| 邊框 | `--color-border` | `#2a2a4a` |

---

## Phase 2 — 浮水印匯入 + 拖放定位 + 尺寸調整

**狀態：✅ 已完成**
**日期：2026-02-01**

### 完成項目

- [x] 實作浮水印圖片匯入（png, jpg, jpeg, svg, gif, webp）
- [x] 實作浮水印預覽疊加層（WatermarkOverlay 組件）
- [x] 實作拖放定位（mouse events，限制在影片範圍內）
- [x] 實作縮放 handle（四角拖動調整大小）
- [x] 實作鎖定比例 / 自由調整切換
- [x] 實作浮水印面板卡片（右側，含位置/尺寸/透明度控制項）
- [x] 實作座標/尺寸雙向同步（拖放改變 → 面板更新，面板輸入 → 預覽更新）
- [x] 實作「同上」功能（套用前一個浮水印的透明度和尺寸）
- [x] 實作新增/刪除浮水印（預設 3 個欄位 + 「更多」按鈕可新增）
- [x] 用 Zustand 管理浮水印狀態（watermarkStore）

### 技術細節

#### 新增元件
| 元件 | 路徑 | 功能 |
|------|------|------|
| WatermarkOverlay | `src/components/WatermarkOverlay/` | 疊加層容器，計算影片實際顯示區域（考慮 letterbox） |
| WatermarkOverlayItem | `src/components/WatermarkOverlay/` | 單個浮水印：拖動定位 + 四角 resize handle |
| WatermarkCard | `src/components/WatermarkPanel/` | 浮水印屬性卡片（位置/尺寸/透明度/同上） |

#### 新增 Store / Hooks / Types
| 項目 | 路徑 | 功能 |
|------|------|------|
| watermarkStore | `src/stores/watermarkStore.ts` | Zustand store，管理浮水印列表、選取、CRUD |
| useWatermarkImport | `src/hooks/useWatermarkImport.ts` | 浮水印圖片匯入（Tauri dialog + Image 載入） |
| WatermarkItem type | `src/types/watermark.ts` | 浮水印型別定義 |

#### 座標系統
- 所有座標使用比例值（0–1），相對於影片解析度
- 預覽時根據影片實際顯示區域（考慮 letterbox/pillarbox）轉換為像素
- 面板顯示像素值（基於原始影片解析度），輸入時自動轉換回比例
- ResizeObserver 監聽容器尺寸變化，即時重新計算疊加位置

#### 鍵盤快捷鍵
| 快捷鍵 | 功能 |
|--------|------|
| Delete / Backspace | 刪除選中浮水印 |
| Escape | 取消選取 |
| Arrow Keys | 微調位置（~1px） |
| Shift + Arrow Keys | 微調位置（~10px） |

---

## Phase 3 — 透明度 + 移動效果

**狀態：✅ 已完成**
**日期：2026-02-02**

### 完成項目

- [x] 實作透明度滑桿（即時預覽，CSS opacity 直接套用在 WatermarkOverlayItem）
- [x] 實作移動方式選擇（三選一 radio：固定 / 線性移動 / 隨機出現）
- [x] 實作固定模式 FFmpeg overlay 命令組裝（Rust 端，靜態 x/y 座標）
- [x] 實作線性移動模式（速度滑桿 + 慢/中/快預設 + 方向選擇，FFmpeg ping-pong bounce 表達式）
- [x] 實作隨機出現模式（頻率滑桿 + 淡入淡出選項，FFmpeg enable + 偽隨機座標表達式）
- [x] 實作單檔輸出流程（點擊「輸出」→ 輸出設定對話框 → Rust render_video → FFmpeg 渲染）
- [x] 實作輸出設定對話框（格式 mp4/mov、品質四級選擇、Tauri save dialog 選擇路徑）
- [x] 實作渲染進度顯示（FFmpeg stderr 解析 out_time_us/time= 百分比，前端 polling 進度條）
- [x] 移動方式預覽動畫（useMovementPreview hook，前端 requestAnimationFrame 模擬移動效果）

### 技術細節

#### 新增 / 修改的前端檔案
| 檔案 | 變更 |
|------|------|
| `src/types/watermark.ts` | 新增 MovementMode、OutputQuality、RenderState 等型別 |
| `src/stores/watermarkStore.ts` | 新增 `updateMovement` action |
| `src/stores/renderStore.ts` | **新增** — 渲染狀態 Zustand store |
| `src/hooks/useRender.ts` | **新增** — 渲染流程 hook（invoke render_video + polling 進度） |
| `src/hooks/useWatermarkImport.ts` | 新增 movement 預設值 |
| `src/components/WatermarkPanel/WatermarkCard.tsx` | 啟用透明度滑桿、啟用移動方式 radio + 設定面板 |
| `src/components/WatermarkOverlay/WatermarkOverlayItem.tsx` | 新增 useMovementPreview hook（動畫預覽） |
| `src/components/BottomToolbar/BottomToolbar.tsx` | 連接輸出對話框 + 渲染進度 |
| `src/components/dialogs/OutputDialog.tsx` | **新增** — 輸出設定對話框 |
| `src/components/dialogs/RenderProgress.tsx` | **新增** — 渲染進度條元件 |

#### Rust 後端（Phase 1 已建立，Phase 3 驗證整合）
| 功能 | 位置 |
|------|------|
| FFmpeg overlay filter 組裝 | `ffmpeg/overlay.rs` — build_filter_complex、三種 movement 表達式 |
| 渲染命令執行 + 進度追蹤 | `commands/ffmpeg.rs` — render_video、get_render_progress |
| 透明度 | `colorchannelmixer=aa={opacity}` 在 filter chain 中 |
| 線性移動 | `overlay=x='abs(mod(...)-(W-w))':y=...` ping-pong bounce |
| 隨機出現 | `overlay=x='mod(floor(t/interval)*prime, max)':enable='between(...)'` |

#### 移動方式預覽動畫
- 使用 `requestAnimationFrame` 在前端即時計算浮水印位移
- 線性移動：模擬 FFmpeg 的 ping-pong bounce 邏輯
- 隨機出現：模擬 FFmpeg 的偽隨機座標 + 顯隱切換
- 選中浮水印時顯示移動模式 badge（↔ 線性移動 / ⚡ 隨機出現）

#### 輸出流程
1. 使用者點擊「開始輸出」→ 開啟 OutputDialog
2. 選擇格式（mp4/mov）、品質（原始/高/中/低）
3. 點擊「選擇路徑並輸出」→ Tauri save dialog 選路徑
4. invoke `render_video` → Rust 組裝 FFmpeg 命令並非同步執行
5. 前端每 500ms polling `get_render_progress` 更新進度條
6. 完成/失敗後顯示結果通知

---

## Phase 4 — 儲存設定 + 批次處理

**狀態：✅ 已完成**
**日期：2026-02-02**

### 完成項目

- [x] 實作設定檔儲存（JSON 格式，含版本號 + 所有浮水印配置：位置、尺寸、透明度、移動方式）
- [x] 實作設定檔載入（讀取 JSON → 還原所有浮水印狀態，含圖片重載 + 尺寸偵測）
- [x] 實作儲存/載入對話框（PresetDialog：儲存為檔案 / 從檔案載入 / 快速儲存到 app data / 已儲存清單管理）
- [x] 實作批次處理對話框（BatchDialog：選取多個影片 / 全選取消全選 / 不支援檔案標記）
- [x] 實作批次命名邏輯（自動命名 _watermarked / 自訂前綴 / 自訂後綴）
- [x] 實作批次處理進度追蹤（BatchProgressDialog：整體進度條 + 單檔進度 + 檔案狀態圖示）
- [x] 實作系統通知（tauri-plugin-notification，批次處理完成後發送通知）
- [x] 底部工具列「儲存設定」和「批次處理」按鈕接上功能
- [x] 實作批次取消功能（Rust 端 cancel set + 前端 cancel 按鈕）
- [x] 實作設定檔刪除功能（從 app data 清除）

### 技術細節

#### 設定檔 JSON Schema（version 1）
```json
{
  "version": 1,
  "name": "設定名稱",
  "createdAt": "2026-02-02T12:00:00.000Z",
  "watermarks": [
    {
      "name": "logo.png",
      "filePath": "/path/to/logo.png",
      "x": 0.05,
      "y": 0.05,
      "width": 0.15,
      "height": 0.08,
      "opacity": 80,
      "lockAspectRatio": true,
      "sameAsAbove": false,
      "movement": { "type": "Static" }
    }
  ]
}
```

#### 新增 / 修改的前端檔案
| 檔案 | 說明 |
|------|------|
| `src/types/preset.ts` | **新增** — PresetConfig, BatchFileItem, BatchProgressEvent 等型別 |
| `src/types/index.ts` | 新增 preset 型別匯出 |
| `src/stores/batchStore.ts` | **新增** — 批次處理狀態 Zustand store |
| `src/hooks/usePreset.ts` | **新增** — 儲存/載入/列表/刪除設定檔 |
| `src/hooks/useBatch.ts` | **新增** — 批次處理邏輯（選檔 + 命名 + 啟動 + 取消 + 通知） |
| `src/components/dialogs/PresetDialog.tsx` | **新增** — 設定檔儲存/載入對話框 |
| `src/components/dialogs/BatchDialog.tsx` | **新增** — 批次處理設定對話框 |
| `src/components/dialogs/BatchProgressDialog.tsx` | **新增** — 批次處理進度對話框 |
| `src/components/dialogs/index.ts` | 新增 PresetDialog, BatchDialog, BatchProgressDialog 匯出 |
| `src/components/BottomToolbar/BottomToolbar.tsx` | 連接儲存設定 + 批次處理對話框 |

#### Rust 後端修改
| 功能 | 位置 |
|------|------|
| 批次渲染命令 | `commands/ffmpeg.rs` — `batch_render_video`：非同步遍歷影片，emit 進度事件 |
| 批次進度事件 | `ffmpeg/mod.rs` — `BatchProgressEvent`：透過 Tauri event 推送到前端 |
| 渲染取消機制 | `commands/ffmpeg.rs` — `cancel_render` + `CANCELLED` set |
| 設定檔刪除 | `commands/preset.rs` — `delete_preset` |
| 通知插件 | `lib.rs` — `tauri_plugin_notification::init()` |

#### 批次處理架構
```
前端 BatchDialog (選檔 + 設定)
    ↓ invoke batch_render_video
Rust 端 tokio::spawn async task
    ↓ 遍歷每個影片
    ↓ spawn_blocking → FFmpeg 渲染
    ↓ emit "batch-progress" 事件 (每個 progress line)
前端 listen("batch-progress")
    ↓ 更新 batchStore
    ↓ BatchProgressDialog 顯示進度
    ↓ 完成後 sendNotification()
```

---

## Phase 5 — 跨平台打包 + 測試

**狀態：✅ 已完成**
**日期：2026-02-02**

### 完成項目

- [x] 設定 GitHub Actions CI/CD（`.github/workflows/build.yml`）
  - macOS (Intel + Apple Silicon)、Windows、Linux 三平台 build matrix
  - 使用 `tauri-apps/tauri-action@v0` 自動建構 + release
  - `dtolnay/rust-toolchain` + `actions/setup-node` + Cargo 快取
  - 前端測試 + Rust 測試 + Clippy lint 獨立 jobs
- [x] macOS 打包設定（DMG，`tauri.conf.json` bundler config）
  - `minimumSystemVersion: "10.15"`
  - Apple Code Signing / Notarization 支援（透過 GitHub Secrets）
- [x] Windows 打包設定（NSIS .exe）
  - 多語言安裝器（English + 繁體中文）
  - DigiCert timestamp、SHA-256 digest
- [x] Linux 打包設定（AppImage + .deb）
  - Debian 依賴：libwebkit2gtk-4.1-0, libgtk-3-0
  - Section: video, Priority: optional
- [x] FFmpeg 二進位各平台打包策略文件（`docs/FFMPEG-BUNDLING.md`）
  - Tauri sidecar 機制說明
  - 各平台 static binary 來源 + CI 自動下載腳本
  - 開發環境 vs 生產環境策略
- [x] 前端單元測試（Vitest + React Testing Library）— **31 tests**
  - VideoPreview 組件測試（5 tests）：空狀態、載入中、影片播放、錯誤、關閉錯誤
  - WatermarkStore 測試（12 tests）：CRUD、選取、同上、清除、ID 唯一性、propagation
  - BatchStore 測試（9 tests）：生命週期、進度更新、完成/失敗、重置、idle 防護
  - Preset hook 測試（5 tests）：序列化/反序列化、移動模式保留、invoke 驗證
- [x] Rust 後端測試 — **30 tests**
  - FFmpeg overlay 命令組裝測試（11 tests）：靜態/線性/隨機/多浮水印/品質對應
  - 批次處理邏輯測試（5 tests）：目錄掃描、過濾、排序、錯誤處理
  - Preset / 型別序列化測試（7 tests）：MovementMode、WatermarkConfig、BatchProgressEvent
  - FFprobe 解析測試（3 tests）：JSON 解析、幀率處理
  - FFmpeg 進度解析測試（4 tests）：out_time_us、time= 解析
- [x] 自動更新機制設定（Tauri updater plugin）
  - `tauri-plugin-updater` 整合（Cargo.toml + lib.rs + tauri.conf.json）
  - 對話框式更新通知
  - GitHub Releases endpoint 設定
- [x] 更新 README.md（安裝說明、使用說明、截圖 placeholder、開發指南）
- [x] 更新 PROGRESS.md

### 技術細節

#### 新增 / 修改的檔案
| 檔案 | 說明 |
|------|------|
| `.github/workflows/build.yml` | **新增** — CI/CD 三平台 build matrix + 測試 |
| `vitest.config.ts` | **新增** — Vitest 測試設定（jsdom 環境） |
| `src/test/setup.ts` | **新增** — 測試環境設定（Tauri API mock + ResizeObserver mock） |
| `src/components/VideoPreview/VideoPreview.test.tsx` | **新增** — VideoPreview 組件測試 |
| `src/stores/watermarkStore.test.ts` | **新增** — WatermarkStore 單元測試 |
| `src/stores/batchStore.test.ts` | **新增** — BatchStore 單元測試 |
| `src/hooks/usePreset.test.ts` | **新增** — Preset 序列化邏輯測試 |
| `src-tauri/tauri.conf.json` | **修改** — 新增 bundler 設定（macOS/Windows/Linux）+ updater plugin |
| `src-tauri/Cargo.toml` | **修改** — 新增 `tauri-plugin-updater` |
| `src-tauri/src/lib.rs` | **修改** — 註冊 updater plugin |
| `src-tauri/src/ffmpeg/mod.rs` | **修改** — 新增型別序列化測試 |
| `src-tauri/src/ffmpeg/overlay.rs` | **修改** — 新增線性/隨機/多浮水印/opacity 測試 |
| `src-tauri/src/ffmpeg/batch.rs` | **修改** — 新增批次處理邏輯測試 |
| `docs/FFMPEG-BUNDLING.md` | **新增** — FFmpeg 各平台打包策略文件 |
| `docs/screenshots/.gitkeep` | **新增** — 截圖 placeholder 目錄 |
| `README.md` | **新增** — 完整安裝/使用/開發說明 |

#### 測試基礎設施
| 項目 | 設定 |
|------|------|
| 前端測試框架 | Vitest 3.x + jsdom |
| 組件測試 | @testing-library/react + @testing-library/jest-dom |
| Tauri API Mock | 全域 mock（`@tauri-apps/api/core` 等） |
| Rust 測試 | 內建 `#[cfg(test)]` + `#[test]` |
| CI 測試 | 前端 + Rust 測試獨立 jobs，build 依賴測試通過 |

#### npm 新增依賴（devDependencies）
```
vitest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
jsdom
```

#### 自動更新架構
```
GitHub Release (tag v*)
    → tauri-action 建構各平台安裝包
    → 產生 latest.json (updater manifest)
    → 應用啟動時檢查 endpoint
    → 彈出更新對話框
    → 自動下載 + 安裝
```

---

## Phase 6 — 模組化系統 + 基礎剪輯功能

**狀態：✅ 已完成**
**日期：2026-02-02**

### 完成項目

#### Part A — 模組化系統
- [x] 建立 `moduleStore.ts`（Zustand），管理啟用的功能模組
- [x] 預設模組：watermark（預設開啟）
- [x] 可選模組：trim（剪輯）、text（文字字幕）、audio（音訊）、filters（濾鏡）、ai（AI工具）
- [x] 首次啟動的功能選擇畫面（WelcomeScreen）
  - 列出所有模組，watermark 預設勾選，分類顯示
  - 「開始使用」按鈕
  - 設定存到 Tauri app data `modules.json`
- [x] 設定頁面中的「功能模組」區塊（ModuleSettings dialog），可隨時開關
- [x] UI 條件渲染：各面板/工具根據模組啟用狀態顯示隱藏

#### Part B — 基礎剪輯功能（trim 模組）
- [x] 時間軸 UI（Timeline）— 底部可縮放的時間軸條
  - 播放頭（Playhead）指示目前播放位置，三角形 + 紅線
  - 可拖動 playhead seek 影片
  - 縮放控制（放大/縮小時間軸，Ctrl+滾輪 或按鈕）
  - 時間刻度尺（TimelineRuler）自動根據 zoom 調整間隔
- [x] 影片裁切（Trim）— 在時間軸上設定 in/out 點
  - 拖動起點/終點 handle（clip 左右邊緣）
  - 顯示選取範圍（clip 以彩色區塊呈現）
  - FFmpeg `-ss -to` 裁切（Rust 後端）
- [x] 影片分割（Split）— 在 playhead 位置切割
  - 分割按鈕 + S 鍵快捷鍵 → 分成兩段
  - 時間軸上顯示多個片段
  - 自動命名片段（(1), (2)）
- [x] 片段管理
  - 刪除片段（選取後點擊刪除按鈕）
  - 片段排序（拖放重新排列）
- [x] 影片合併輸出（Concat）
  - 多片段 → FFmpeg concat demuxer → 單一影片輸出
  - 進度事件推送到前端

### 技術細節

#### 新增的前端檔案
| 檔案 | 說明 |
|------|------|
| `src/types/module.ts` | **新增** — ModuleDefinition, ModuleId, ModuleConfig 型別，ALL_MODULES 常數 |
| `src/types/timeline.ts` | **新增** — TimelineClip, TimelineState, TrimMode 型別，TIMELINE_ZOOM 常數 |
| `src/stores/moduleStore.ts` | **新增** — 模組管理 Zustand store（啟用/停用/持久化） |
| `src/stores/timelineStore.ts` | **新增** — 時間軸 Zustand store（clips/playhead/zoom/split/trim/reorder） |
| `src/hooks/useTimeline.ts` | **新增** — 時間軸操作 hook（匯出/裁切/進度監聽） |
| `src/components/WelcomeScreen/WelcomeScreen.tsx` | **新增** — 首次啟動功能選擇畫面 |
| `src/components/SettingsPanel/ModuleSettings.tsx` | **新增** — 模組設定對話框（toggle switches） |
| `src/components/Timeline/Timeline.tsx` | **新增** — 主時間軸組件（playhead/clips/toolbar） |
| `src/components/Timeline/TimelineRuler.tsx` | **新增** — 時間刻度尺 |
| `src/components/Timeline/TimelineClipItem.tsx` | **新增** — 單個片段 UI（trim handles/拖放） |

#### 修改的前端檔案
| 檔案 | 說明 |
|------|------|
| `src/App.tsx` | 整合 WelcomeScreen、ModuleSettings、Timeline，模組條件渲染 |
| `src/components/VideoPreview/VideoPreview.tsx` | 接受 videoRef prop 向下傳遞 |
| `src/components/VideoPreview/VideoPlayer.tsx` | 使用共享 videoRef，模組感知（隱藏進度條當 timeline 啟用），初始化 timeline |
| `src/components/BottomToolbar/BottomToolbar.tsx` | 模組感知按鈕，新增「匯出剪輯」按鈕 |
| `src/types/index.ts` | 匯出新型別 |

#### 新增的 Rust 後端檔案
| 檔案 | 說明 |
|------|------|
| `src-tauri/src/ffmpeg/trim.rs` | **新增** — trim_video + concat_videos + ClipSegment 型別（5 tests） |
| `src-tauri/src/commands/timeline.rs` | **新增** — trim_video_clip、concat_video_clips、get_timeline_progress commands |

#### 修改的 Rust 後端檔案
| 檔案 | 說明 |
|------|------|
| `src-tauri/src/ffmpeg/mod.rs` | 註冊 trim 模組 |
| `src-tauri/src/commands/mod.rs` | 註冊 timeline 模組 |
| `src-tauri/src/lib.rs` | 註冊 3 個新 Tauri commands |

#### 模組系統架構
```
首次啟動 → modules.json 不存在
    → WelcomeScreen 顯示
    → 用戶選擇模組 + 「開始使用」
    → moduleStore.setModules() + completeSetup()
    → 寫入 modules.json 到 Tauri app data
    → App 主畫面根據 isEnabled() 條件渲染

之後啟動 → 讀取 modules.json
    → 直接進入主畫面
    → 標題列 ⚙️ 模組 按鈕 → ModuleSettings 對話框
    → toggle 即時生效 + 自動存檔
```

#### 時間軸架構
```
VideoPlayer onLoadedMetadata
    → timelineStore.initFromVideo(path, url, duration, name)
    → 建立單一 clip 覆蓋整個影片

Timeline 組件
    ├── TimelineRuler（時間刻度）
    ├── TimelineClipItem[] （片段）
    │   ├── 左右 trim handles
    │   └── 拖放重排
    └── Playhead（播放頭）
        ├── 拖動 → setPlayheadTime → video.currentTime
        └── video timeupdate → setPlayheadTime（雙向同步）

操作流程：
    Split → splitAtPlayhead() → 找到 playhead 所在 clip → 分成兩段
    Trim → handleTrimMouseDown → trimClip(id, newStart, newEnd)
    Delete → deleteClip(id) → 移除片段
    Reorder → drag & drop → reorderClip(id, newIndex)
    Export → useTimeline.exportTimeline()
        → invoke concat_video_clips
        → Rust: trim 每段 → concat demuxer → 輸出
```

#### 測試結果
- Rust 測試：**35 tests passed**（新增 5 個 trim 模組測試）
- TypeScript 編譯：零錯誤

#### 鍵盤快捷鍵（新增）
| 快捷鍵 | 功能 |
|--------|------|
| S | 在播放頭位置分割片段（trim 模組啟用時） |

---

## Phase 7 — 文字疊加 + 字幕

**狀態：✅ 已完成**
**日期：2026-02-02**

### 完成項目

#### 文字疊加層
- [x] TextOverlayItem 組件（類似 WatermarkOverlayItem，但用於文字）
- [x] 文字內容輸入（雙擊 contentEditable 編輯 + 面板 textarea 編輯）
- [x] 字體選擇（內建 8 款：Noto Sans TC、Noto Serif TC、PingFang TC、Arial、Times New Roman 等）
- [x] 字體大小調整（8–200px，基於 1080p 基準自動縮放）
- [x] 文字顏色選擇（color picker + hex 輸入）
- [x] 文字描邊（stroke color + width 0–10px）
- [x] 文字背景色（半透明底，bgColor + bgOpacity 0–100%）
- [x] 文字對齊（左/中/右按鈕切換）
- [x] 拖放定位（同浮水印方式，mouse events 限制在影片範圍內）
- [x] 水平寬度調整（左右 resize handles）
- [x] 文字在時間軸上的顯示時間範圍（startTime ~ endTime，-1 = 全程）

#### 字幕功能
- [x] SRT 字幕檔匯入（自寫 parser，解析序號 + 時間 + 多行文字）
- [x] 字幕列表顯示（面板中列出所有字幕條目，含時間碼）
- [x] 字幕時間編輯（修改每條字幕的開始/結束時間）
- [x] 字幕內容編輯（點擊展開，inline textarea 編輯）
- [x] 字幕預覽（在影片上即時顯示對應時間的字幕，SubtitleDisplay 組件）
- [x] 字幕樣式統一設定（字體、大小、顏色、描邊、垂直位置）
- [x] 新增字幕條目（手動添加）
- [x] 刪除字幕條目（含自動重新編號）
- [x] 字幕顯示開關

#### FFmpeg 整合
- [x] Rust 端：drawtext filter 命令組裝（fontfile/font、text、fontsize、fontcolor、borderw、box）
- [x] 支援中文字體路徑（macOS/Windows/Linux 多路徑搜尋）
- [x] 字幕燒錄（subtitles filter + ASS force_style）
- [x] 時間範圍 enable 表達式（between/gte）
- [x] 多個文字層 + 字幕同時輸出（drawtext chain + subtitles filter 組合）
- [x] 與浮水印 filter_complex 正確串接（wmout → text → vout）
- [x] 無浮水印時使用 -vf 簡化路徑

#### 狀態管理
- [x] textStore.ts（Zustand）— 管理文字層列表、選取、CRUD + 字幕列表、樣式、開關
- [x] TextPanel 組件（右側面板，text 模組啟用時顯示）

### 技術細節

#### 新增的前端檔案
| 檔案 | 說明 |
|------|------|
| `src/types/text.ts` | **新增** — TextOverlayItem、SubtitleEntry、SubtitleStyle、FontOption、TextRenderConfig 等型別 |
| `src/stores/textStore.ts` | **新增** — 文字 & 字幕 Zustand store |
| `src/utils/srtParser.ts` | **新增** — SRT 解析器（parseSrt/serializeSrt/formatSrtTime） |
| `src/components/TextOverlay/TextOverlay.tsx` | **新增** — 文字疊加層容器（含影片時間追蹤） |
| `src/components/TextOverlay/TextOverlayItem.tsx` | **新增** — 單個文字：拖動 + resize + 雙擊編輯 + 時間範圍可見性 |
| `src/components/TextOverlay/SubtitleDisplay.tsx` | **新增** — 字幕顯示器（即時根據影片時間顯示對應字幕） |
| `src/components/TextPanel/TextPanel.tsx` | **新增** — 文字 & 字幕右側面板 |
| `src/components/TextPanel/TextCard.tsx` | **新增** — 文字屬性卡片（完整編輯控制項） |
| `src/components/TextPanel/SubtitlePanel.tsx` | **新增** — 字幕管理面板（匯入/編輯/樣式） |

#### 修改的前端檔案
| 檔案 | 說明 |
|------|------|
| `src/types/index.ts` | 匯出新型別 |
| `src/App.tsx` | 新增 TextPanel 條件渲染 |
| `src/components/VideoPreview/VideoPlayer.tsx` | 新增 TextOverlay 條件渲染 |
| `src/components/BottomToolbar/BottomToolbar.tsx` | 新增 text 模組感知 |

#### 新增的 Rust 後端檔案
| 檔案 | 說明 |
|------|------|
| `src-tauri/src/ffmpeg/text.rs` | **新增** — drawtext filter 組裝 + subtitles filter + 字體路徑解析（11 tests） |
| `src-tauri/src/commands/text.rs` | **新增** — render_with_text 統一渲染命令（watermarks + texts + subtitles） |

#### 修改的 Rust 後端檔案
| 檔案 | 說明 |
|------|------|
| `src-tauri/src/ffmpeg/mod.rs` | 註冊 text 模組 |
| `src-tauri/src/commands/mod.rs` | 註冊 text 模組 |
| `src-tauri/src/commands/ffmpeg.rs` | 公開 progress map + progress parser（供 text commands 使用） |
| `src-tauri/src/lib.rs` | 註冊 render_with_text command |

#### 前端測試（新增）
| 檔案 | 測試數 |
|------|--------|
| `src/utils/srtParser.test.ts` | **10 tests** — SRT 解析/序列化/時間格式化/Windows 換行/邊界情況 |
| `src/stores/textStore.test.ts` | **14 tests** — 文字 CRUD/選取/清除/字幕設定/更新/刪除重編號/樣式更新 |

#### Rust 測試（新增）
| 範圍 | 測試數 |
|------|--------|
| hex 色碼轉換 | 2 tests |
| drawtext 轉義 | 1 test |
| drawtext filter 組裝 | 4 tests（靜態/描邊/時間範圍/背景） |
| filter chain | 2 tests（空/多個） |
| enable 表達式 | 1 test |
| subtitles filter | 1 test |

#### 測試結果
- Rust 測試：**46 tests passed**（35 existing + 11 新增 text 模組測試）
- 前端測試：**55 tests passed**（31 existing + 24 新增 text/SRT 測試）
- TypeScript 編譯：零錯誤

#### 座標系統
- 文字位置使用比例值（0–1），與浮水印一致
- 字體大小基於 1080p 解析度，預覽時按影片顯示高度等比縮放
- 描邊寬度同樣按比例縮放

#### FFmpeg 命令架構
```
無浮水印時：
  ffmpeg -i input.mp4 -vf "drawtext=...,drawtext=...,subtitles=..." output.mp4

有浮水印時：
  ffmpeg -i input.mp4 -i wm1.png -i wm2.png \
    -filter_complex "[1]scale...→[wm0];[0:v][wm0]overlay→[wmout]; \
                     [wmout]drawtext=...,drawtext=...,subtitles=...[vout]" \
    -map [vout] -map 0:a? output.mp4
```

#### SRT 解析流程
```
用戶點擊「匯入 SRT」
    → Tauri dialog 選檔（.srt filter）
    → invoke load_preset 讀取檔案內容
    → parseSrt() 解析為 SubtitleEntry[]
    → setSubtitles(entries, filePath)
    → SubtitleDisplay 根據 currentTime 即時顯示
```
