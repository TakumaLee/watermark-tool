# 影片浮水印工具 — PRD

## 概述
跨平台桌面應用程式，用於在影片上疊加浮水印圖片——支援拖放定位、尺寸調整、透明度、動態移動效果，以及批次處理多個影片檔案。

## 目標用戶
- 影片創作者（YouTuber/IG Reels），需要批次添加 Logo/版權標記
- 企業行銷人員，需要在大量影片上加品牌浮水印
- 個人開發者徐士桓（原始需求方），日常工作流需求

## 核心功能
### 必備功能（Must Have）
- [x] 影片匯入 — 支援 mp4/mov/avi/mkv，自動偵測比例（16:9/9:16/1:1）✅
- [x] 浮水印管理 — 匯入 png/jpg/svg/gif，多浮水印支援 ✅
- [x] 拖放定位 — 滑鼠拖放設定浮水印位置 ✅
- [x] 尺寸調整 — 拖拉邊角 + 輸入框精確設定，支援比例鎖定 ✅
- [x] 透明度設定 — 0-100% 滑桿，即時預覽 ✅
- [x] 移動效果 — 固定 / 線性移動（px/s）/ 隨機出現（閃爍頻率）三種模式 ✅
- [x] 「同上」功能 — 複製前一個浮水印的透明度與尺寸 ✅
- [x] 儲存/載入設定 — JSON 格式設定檔持久化 ✅
- [x] 批次處理 — 套用設定至整個資料夾，自訂/自動命名 ✅
- [x] 輸出設定 — 格式選擇（原始/mp4/mov）+ 品質選擇 ✅
- [x] 深色主題 UI — Final Cut Pro 風格 ✅
- [x] 跨平台打包 — macOS (.dmg) / Windows (.exe) / Linux (AppImage) ✅
- [x] 文字疊加 — 文字/字幕疊加功能 ✅
- [x] 音訊處理 — 音訊軌道處理 ✅
- [x] 進階剪輯 — 基礎剪輯功能模組 ✅
- [x] AI 功能 — AI 相關輔助功能 ✅

### 進階功能（Nice to Have）
- [ ] 雲端設定同步 — 跨裝置設定備份
- [ ] 模板市場 — 預設浮水印配置分享
- [ ] GPU 加速 — 利用 GPU 加速 FFmpeg 渲染

## 技術架構
- Tauri 2.0（跨平台桌面框架）
- React 19 + TypeScript（前端 UI）
- Tailwind CSS（深色主題樣式）
- FFmpeg CLI（影片處理引擎）
- HTML5 Video + DOM 疊加（即時預覽）
- Vite（前端打包）
- Vitest（測試框架）
- Rust（Tauri 後端）

## 上架/變現計畫
- 平台：GitHub Releases（直接下載）/ 未來考慮 Gumroad / Lemon Squeezy
- 定價：TBD（目前私人開發工具）
- 目前狀態：開發完成（Phase 0-11 全部完成，2026-02-03）

## 競品
- Final Cut Pro（macOS 專用，昂貴）
- DaVinci Resolve（功能複雜）
- Kapwing（線上版，無法批次）
- FFmpeg CLI（無 GUI）

## 成功指標
- 主要使用者（徐士桓）日常工作流可完全取代手動 FFmpeg
- 批次處理 100 個影片無錯誤
- macOS + Windows 打包穩定

## 測試計畫
| 類型 | 工具 | 涵蓋範圍 |
|------|------|---------|
| 單元測試 | Vitest | FFmpeg 指令生成邏輯、設定檔 JSON 序列化 |
| 整合測試 | Vitest + Tauri test | 浮水印疊加輸出檔案驗證 |
| 手動驗收 | 實際影片輸出 | 各移動效果 + 批次處理 + 跨平台一致性 |
| E2E | 手動 | 匯入→設定→批次→輸出完整流程 |

## 部署方案
| 服務 | 平台 | 說明 |
|------|------|------|
| macOS 安裝包 | GitHub Releases | `.dmg` 格式 |
| Windows 安裝包 | GitHub Releases | `.exe` NSIS 格式 |
| Linux 安裝包 | GitHub Releases | `.AppImage` 格式 |
| CI | GitHub Actions | 自動 build + release |

**本地開發**：`npm run dev`（Tauri Dev 模式，熱重載）  
**打包**：`npm run tauri build`（產生對應平台安裝包）  
**FFmpeg 依賴**：Bundled FFmpeg（`docs/FFMPEG-BUNDLING.md`）  
**環境需求**：Node.js 18+, Rust stable, FFmpeg

---
*最後更新：2026-02-18（自動生成，依 SPEC.md + PROGRESS.md 推斷）*
