# 開發進度追蹤

## 總覽

| 階段 | 內容 | 狀態 | 完成日期 |
|------|------|------|---------|
| **Phase 0** | 技術研究 + UI/UX 設計 | ✅ 已完成 | 2026-01-31 |
| **Phase 1** | 基礎框架 + 影片匯入 + 預覽 | ✅ 已完成 | 2026-02-01 |
| **Phase 2** | 浮水印匯入 + 拖放定位 + 尺寸調整 | ✅ 已完成 | 2026-02-01 |
| **Phase 3** | 透明度 + 移動效果 | ⏳ 待開始 | - |
| **Phase 4** | 儲存設定 + 批次處理 | ⏳ 待開始 | - |
| **Phase 5** | 跨平台打包 + 測試 | ⏳ 待開始 | - |

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

## Phase 3 — 透明度 + 移動效果（待開始）

### 預計工作

- [ ] 實作透明度滑桿（即時預覽）
- [ ] 實作固定模式 FFmpeg 命令組裝
- [ ] 實作線性移動模式（速度設定 + FFmpeg 表達式）
- [ ] 實作隨機出現模式（頻率設定 + FFmpeg 表達式）
- [ ] 實作單檔輸出流程
- [ ] 實作輸出設定對話框
- [ ] 實作渲染進度顯示

---

## Phase 4 — 儲存設定 + 批次處理（待開始）

### 預計工作

- [ ] 實作設定檔儲存（JSON）
- [ ] 實作設定檔載入
- [ ] 實作儲存/載入對話框
- [ ] 實作批次處理對話框
- [ ] 實作批次命名邏輯
- [ ] 實作批次處理進度追蹤
- [ ] 實作系統通知（完成提醒）

---

## Phase 5 — 跨平台打包 + 測試（待開始）

### 預計工作

- [ ] 設定 GitHub Actions CI/CD
- [ ] macOS 打包 + Code Signing + Notarization
- [ ] Windows 打包 (NSIS .exe)
- [ ] Linux 打包 (AppImage + .deb)
- [ ] FFmpeg 二進位各平台打包
- [ ] 跨平台 UI 測試
- [ ] E2E 測試
- [ ] 自動更新機制
