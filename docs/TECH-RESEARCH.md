# 技術研究報告

> Phase 0 — 技術選型分析與推薦
> 日期：2026-01-31
> 狀態：已完成

---

## 1. 跨平台桌面框架

### 需求

- 支援 macOS / Windows / Linux
- 能嵌入影片預覽（含即時浮水印疊加）
- 支援拖放操作（浮水印定位、縮放）
- 打包為各平台原生安裝檔
- 深色主題 UI

### 比較分析

| 評估項目 | Electron | Tauri 2.0 | Flutter Desktop | Qt (Python) | .NET MAUI |
|---------|----------|-----------|-----------------|-------------|-----------|
| **語言** | JS/TS + Node.js | JS/TS + Rust | Dart | Python + C++ | C# + XAML |
| **UI 技術** | Chromium WebView | OS 原生 WebView | 自繪引擎 (Skia) | Qt Widgets/QML | 原生控件 |
| **打包大小** | 80–150 MB | 2.5–10 MB | 20–40 MB | 30–80 MB | 40–100 MB |
| **記憶體佔用（空閒）** | 200–300 MB | 30–40 MB | 80–150 MB | 50–100 MB | 60–120 MB |
| **啟動速度** | 1–2 秒 | < 0.5 秒 | 1–2 秒 | 1–3 秒 | 1–2 秒 |
| **跨平台一致性** | 極高（自帶 Chromium） | 中（各平台 WebView 差異） | 高（自繪引擎） | 高（Qt 引擎） | 中（原生控件差異） |
| **影片預覽能力** | 優（HTML5 Video + Canvas） | 良（HTML5 Video + Canvas） | 中（需第三方插件） | 良（Qt Multimedia） | 差（需第三方 SDK） |
| **拖放/Canvas 操作** | 優（完整 Web API） | 優（完整 Web API） | 中（自繪需自行實現） | 良（QGraphicsScene） | 中 |
| **生態/社群** | 極成熟（10+ 年） | 快速成長中 | 中等（桌面端較新） | 成熟但小眾 | 中等 |
| **開發效率** | 極高 | 高 | 中 | 中 | 中 |
| **Linux 支援** | 優 | 優 | 良 | 優 | 不支援 |

### 各框架詳細分析

#### Electron (v33+)

**Pros:**
- Web 技術棧（HTML/CSS/JS），前端開發者零學習曲線
- Chromium 引擎確保跨平台 UI 完全一致
- HTML5 `<video>` + `<canvas>` 可直接實現影片預覽與浮水印疊加
- 成熟的拖放 API、Canvas 繪圖 API
- 大量成功案例（VS Code、Figma Desktop、Slack）
- 豐富的 npm 生態，`fluent-ffmpeg` 等現成封裝
- 打包工具成熟（electron-builder、electron-forge）

**Cons:**
- 打包體積大（100+ MB），因捆綁完整 Chromium
- 記憶體佔用高（200+ MB 空閒）
- 安全性相對較低（Node.js 完整權限）
- 對系統資源需求較高

#### Tauri 2.0

**Pros:**
- 極小打包體積（2.5–10 MB），使用系統原生 WebView
- 極低記憶體佔用（30–40 MB）
- Rust 後端，效能優異且記憶體安全
- 前端仍使用 Web 技術（React/Vue/Svelte 均可）
- 內建跨平台打包（DMG / NSIS / AppImage / DEB / RPM）
- 支援自動更新機制
- 安全沙箱模型，權限系統完善
- 2.0 版穩定發布（2024 年底），社群快速成長（17,700+ Discord 成員）

**Cons:**
- 各平台 WebView 引擎不同（macOS: WebKit, Windows: WebView2, Linux: WebKitGTK），可能有渲染差異
- Rust 學習曲線（但前端部分不需要）
- 生態相比 Electron 仍較年輕
- 影片相關插件仍在發展中（但 HTML5 Video API 可用）

#### Flutter Desktop

**Pros:**
- 自繪引擎（Skia），跨平台 UI 高度一致
- Dart 語言相對易學
- 支援 macOS / Windows / Linux
- 熱重載開發體驗好

**Cons:**
- 桌面端相對不成熟，穩定性問題
- FFmpegKit 已於 2025 年 1 月退役，主要 Flutter FFmpeg 封裝失去維護
- 影片預覽/Canvas 互動不如 Web 技術直觀
- 桌面端第三方套件較少
- 自行實現拖放浮水印交互工程量大

#### Qt (Python - PySide6/PyQt6)

**Pros:**
- 成熟穩定的桌面框架（20+ 年歷史）
- Qt Multimedia 支援影片播放
- QGraphicsScene 可實現拖放疊加
- Python 開發效率高
- 跨平台一致性好

**Cons:**
- UI 風格較傳統，實現現代深色主題需大量 QSS 調整
- 商用授權複雜（GPL/LGPL/Commercial）
- 打包（PyInstaller/cx_Freeze）體驗不如 Web 框架
- Python 效能瓶頸（影片處理需依賴 C 擴展）
- 社群規模較小且偏企業

#### .NET MAUI

**Pros:**
- 微軟支持，企業級框架
- C# 語言成熟

**Cons:**
- **不支援 Linux**（僅 macOS + Windows + 移動端）— 直接不符合需求
- 影片處理能力極差，需完全依賴第三方 SDK
- 桌面端功能仍在追趕中
- 社群反饋 Bug 較多，穩定性存疑

### 框架推薦：Tauri 2.0

**推薦理由：**

1. **開發效率**：前端使用 Web 技術（推薦 React + TypeScript），開發者可使用熟悉的 HTML5 Canvas / Video API 實現預覽和拖放
2. **效能優勢**：Rust 後端處理 FFmpeg 呼叫，效能遠優於 Node.js；打包體積小（< 10 MB vs Electron 100+ MB）
3. **跨平台打包**：內建 DMG / NSIS(.exe) / AppImage / DEB / RPM 打包支援，配合 GitHub Actions CI/CD
4. **安全性**：沙箱模型 + 權限系統，適合處理用戶檔案
5. **未來擴展**：Tauri 2.0 支援移動端，若未來需要可擴展

**風險與緩解：**
- WebView 差異 → 使用標準 Web API，避免瀏覽器特定功能；重點測試三平台
- Rust 學習曲線 → 後端邏輯（呼叫 FFmpeg CLI）相對簡單，不需深入 Rust
- 影片預覽 → 使用 HTML5 `<video>` 元素播放 + `<canvas>` 疊加浮水印層，已有成功案例

**備選方案：Electron**（若團隊對 Rust 完全不熟悉或跨平台一致性為最高優先級）

---

## 2. 影片處理引擎

### 需求

- 浮水印圖片疊加到影片上
- 支援固定位置、線性移動、隨機出現三種模式
- 批次處理多個影片
- 支援常見格式（mp4, mov, avi, mkv）
- 跨平台運行

### 比較分析

| 評估項目 | FFmpeg (CLI) | GStreamer | MoviePy | OpenCV |
|---------|-------------|----------|---------|--------|
| **浮水印疊加** | 優（overlay filter） | 優（compositor element） | 良 | 良（逐幀處理） |
| **動態移動效果** | 優（表達式驅動） | 良（需自訂 pipeline） | 中（逐幀手動） | 中（逐幀手動） |
| **批次處理效能** | 極優 | 良 | 差（Python 瓶頸） | 差（逐幀處理慢） |
| **格式支援** | 極廣 | 廣 | 依賴 FFmpeg | 中等 |
| **跨平台** | 優 | 優（但安裝複雜） | 優（Python） | 優 |
| **安裝/整合難度** | 低（單一二進位） | 高（複雜依賴鏈） | 中 | 中 |
| **社群/文件** | 極豐富 | 豐富但較技術性 | 中等 | 豐富 |
| **授權** | LGPL/GPL | LGPL | MIT | Apache 2.0 |

### 各引擎詳細分析

#### FFmpeg (CLI 模式)

**Pros:**
- 業界標準，幾乎所有影片工具的底層引擎
- `overlay` 濾鏡直接支援浮水印疊加，語法成熟
- 動態移動浮水印可透過表達式實現：
  ```bash
  # 線性移動
  overlay='x=if(gte(t,1), -w+(t-1)*200, NAN):y=(main_h-overlay_h)/2'

  # 隨機位置（定時切換）
  overlay='x=if(lt(mod(t,16),8), W-w-W*10/100, W*10/100):y=...'
  ```
- 支援透明度調整（`colorchannelmixer=aa=0.5`）
- 支援 PNG/JPG/GIF 浮水印，含透明通道
- 批次處理效能極高，可充分利用硬體加速（NVENC/VAAPI/VideoToolbox）
- 跨平台預編譯二進位檔直接可用
- 解析度無關的位置公式（使用 `W`/`H`/`w`/`h` 變數）

**Cons:**
- CLI 語法複雜，filter_complex 表達式學習曲線陡
- 錯誤訊息不太友好
- 非即時互動（不適合做預覽引擎，僅適合最終渲染）

#### GStreamer

**Pros:**
- 模組化 pipeline 架構，適合即時串流
- 支援即時影片處理
- 濾鏡種類豐富

**Cons:**
- 安裝和依賴管理複雜，尤其在 Windows 上
- 批次處理效能不如 FFmpeg
- 學習曲線陡峭
- 對簡單的浮水印任務來說過於複雜
- macOS 上已知存在相容性問題

#### MoviePy (Python)

**Pros:**
- Python API 簡潔易用
- 底層使用 FFmpeg
- 適合快速原型

**Cons:**
- Python 效能瓶頸，批次處理慢
- 不適合生產環境的大量影片處理
- 不適合與 Tauri/Rust 整合

#### OpenCV

**Pros:**
- 強大的圖像處理能力
- 逐幀控制精確

**Cons:**
- 影片處理需逐幀讀寫，效能差
- 不支援音訊處理（需額外處理）
- 浮水印動態效果需完全手動實現
- 對影片編解碼支援有限

### 引擎推薦：FFmpeg (CLI 模式)

**推薦理由：**

1. **浮水印功能完備**：overlay 濾鏡原生支援靜態/動態浮水印，表達式系統可實現線性移動和隨機出現效果
2. **效能最優**：C 語言實現，支援硬體加速，批次處理速度遠超其他方案
3. **整合簡單**：Tauri 的 Rust 後端可透過 `std::process::Command` 呼叫 FFmpeg CLI，無需複雜 binding
4. **跨平台**：各平台均有預編譯版本，可隨應用打包分發
5. **格式支援最廣**：幾乎支援所有影片/圖片格式

**整合方式：**
```
Tauri App
├── 前端 (React/TS) → UI、預覽
├── Rust 後端 → 組裝 FFmpeg 命令、管理行程
└── FFmpeg 二進位 → 實際影片處理
```

**三種浮水印模式的 FFmpeg 實現方案：**

| 模式 | FFmpeg filter 表達式 |
|------|---------------------|
| 固定 | `overlay=x:y` |
| 線性移動 | `overlay='x=mod(t*speed, W):y=...'` + 邊界反彈邏輯 |
| 隨機出現 | `overlay='x=...:y=...:enable=between(t, start, end)'` 搭配多段隨機位置 |

---

## 3. 預覽引擎

### 需求

- 即時預覽影片 + 浮水印疊加效果
- 支援浮水印拖放定位
- 支援浮水印縮放（拖拽邊角）
- 即時反映透明度調整
- 適應不同影片比例（9:16 / 16:9 / 1:1）

### 方案分析

| 方案 | 說明 | 可行性 |
|------|------|--------|
| HTML5 Video + Canvas 疊加 | 影片用 `<video>` 播放，浮水印用 Canvas/DOM 層疊加 | **推薦** |
| Canvas 逐幀繪製 | 將影片幀繪製到 Canvas 上，再疊加浮水印 | 效能風險 |
| WebGL 渲染 | GPU 加速渲染 | 過度設計 |
| 原生影片播放器嵌入 | 嵌入 MPV/VLC | 難以疊加 UI 層 |

### 推薦方案：HTML5 Video + DOM/Canvas 疊加層

**架構設計：**

```
┌───────────────────────────────────┐
│        預覽容器 (relative)         │
│  ┌─────────────────────────────┐  │
│  │     <video> 元素             │  │
│  │     （影片播放層）             │  │
│  │                             │  │
│  │  ┌─────────────────────┐    │  │
│  │  │  浮水印疊加層         │    │  │
│  │  │  (absolute position) │    │  │
│  │  │  - 拖放 (drag)       │    │  │
│  │  │  - 縮放 (resize)     │    │  │
│  │  │  - 透明度 (opacity)  │    │  │
│  │  └─────────────────────┘    │  │
│  │                             │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**實現細節：**

1. **影片播放**：使用 HTML5 `<video>` 元素，支援 mp4/webm；其他格式由 FFmpeg 在匯入時轉為 mp4 預覽用
2. **浮水印疊加**：每個浮水印為一個 `<img>` 元素（absolute positioning），疊在影片上方
3. **拖放**：使用 `pointer events` 或 `react-dnd` 等庫實現拖放定位
4. **縮放**：在浮水印四角/邊緣放置 resize handle，拖動時更新寬高
5. **透明度**：直接使用 CSS `opacity` 屬性，即時生效
6. **座標映射**：預覽區域與實際影片解析度的座標比例換算

**比例適應策略：**
```
影片比例       預覽區行為
16:9 橫式  →  寬度填滿，上下留黑邊
9:16 直式  →  高度填滿，左右留黑邊
1:1 方形   →  取高度/寬度較小值
其他比例    →  contain 模式自適應
```

**前端推薦函式庫：**
- `react-draggable` 或 `@dnd-kit/core`：浮水印拖放
- `re-resizable`：浮水印縮放
- CSS `opacity`：透明度控制
- 原生 HTML5 `<video>`：影片播放

**注意事項：**
- 預覽時不呼叫 FFmpeg，純前端渲染（即時性）
- 最終輸出時才由 Rust 後端呼叫 FFmpeg 進行實際合成
- 預覽座標需精確映射到 FFmpeg overlay 參數

---

## 4. 打包與發布

### Tauri 2.0 內建打包方案

Tauri 內建完整的跨平台打包系統，無需額外工具：

| 平台 | 格式 | 工具 | 說明 |
|------|------|------|------|
| **macOS** | `.dmg` / `.app` | 內建 | 支援 Code Signing + Notarization |
| **Windows** | `.exe` (NSIS) / `.msi` (WiX) | 內建 | 自動處理 WebView2 Runtime 安裝 |
| **Linux** | `.AppImage` / `.deb` / `.rpm` | 內建 | AppImage 免安裝，DEB/RPM 適合包管理器 |

### FFmpeg 二進位打包策略

由於應用依賴 FFmpeg，需將其隨應用一起分發：

| 策略 | 說明 | 推薦度 |
|------|------|--------|
| **捆綁靜態編譯版** | 將 FFmpeg 二進位打包進應用 resources | **推薦** |
| 系統 FFmpeg | 依賴用戶已安裝的 FFmpeg | 不推薦（用戶體驗差） |
| 首次啟動下載 | 應用首次啟動時自動下載 | 備選（需處理網路問題） |

**推薦做法：**
- 使用 [FFmpeg Static Builds](https://github.com/BtbN/FFmpeg-Builds) 預編譯二進位
- macOS: `ffmpeg` 放入 `.app/Contents/Resources/`
- Windows: `ffmpeg.exe` 放入安裝目錄
- Linux: `ffmpeg` 放入 AppImage 的 resources
- Tauri 的 `tauri.bundle.resources` 配置可自動處理

### 預估打包大小

| 組件 | 大小 |
|------|------|
| Tauri 應用本體 | 2–5 MB |
| FFmpeg 靜態二進位 | 70–100 MB |
| **總計** | **~75–105 MB** |

> 注意：FFmpeg 佔了大部分體積。若使用 Electron 則總計約 170–250 MB。

### CI/CD 建議

使用 `tauri-action` GitHub Action 自動化建構：
- Push / Tag 時自動建構三平台安裝檔
- 自動上傳到 GitHub Releases
- 支援 Code Signing（macOS / Windows）

### 自動更新

Tauri 內建 Updater 插件：
- 支援靜默更新或提示更新
- 檢查 JSON endpoint 取得最新版本資訊
- 各平台自動產生更新用封裝檔

---

## 5. 最終推薦技術棧

```
┌─────────────────────────────────────────────┐
│           影片浮水印工具 — 技術棧             │
├─────────────────────────────────────────────┤
│                                             │
│  前端 (UI)                                   │
│  ├── React 19 + TypeScript                   │
│  ├── Vite（建構工具）                         │
│  ├── Tailwind CSS（深色主題樣式）              │
│  ├── HTML5 <video>（影片預覽）                │
│  ├── DOM/CSS（浮水印疊加 + 拖放 + 縮放）       │
│  └── Zustand / Jotai（狀態管理）              │
│                                             │
│  後端 (核心邏輯)                              │
│  ├── Tauri 2.0 (Rust)                        │
│  ├── FFmpeg CLI 呼叫（影片合成）               │
│  ├── 檔案系統操作（匯入/匯出/設定檔）           │
│  └── 批次處理任務管理                          │
│                                             │
│  打包                                        │
│  ├── macOS: .dmg（Code Signing + Notarize）  │
│  ├── Windows: .exe (NSIS)                    │
│  └── Linux: .AppImage + .deb                 │
│                                             │
│  CI/CD                                       │
│  └── GitHub Actions + tauri-action           │
│                                             │
└─────────────────────────────────────────────┘
```

### 優先級排序（依需求規格）

1. **開發效率** → React + TypeScript，Web 開發者即可上手
2. **效能** → Rust 後端 + FFmpeg，影片處理效能最優
3. **打包大小** → Tauri ~5 MB（含 FFmpeg 約 100 MB，仍遠低於 Electron 方案）

---

## 參考來源

- [Tauri 2.0 官方文件](https://v2.tauri.app/)
- [Tauri vs Electron 比較 — Hopp Blog](https://www.gethopp.app/blog/tauri-vs-electron)
- [Tauri vs Electron — DoltHub 2025](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Tauri 打包與分發指南](https://v2.tauri.app/distribute/)
- [FFmpeg Overlay Filter 文件](https://ffmpeg.org/ffmpeg-filters.html#overlay)
- [FFmpeg 動態浮水印教學 — Bannerbear](https://www.bannerbear.com/blog/how-to-add-watermark-to-videos-using-ffmpeg/)
- [FFmpeg 移動浮水印 — corbpie](https://write.corbpie.com/creating-a-shifting-watermark-overlay-with-ffmpeg/)
- [FFmpeg vs GStreamer 比較 — Medium](https://medium.com/@contact_45426/ffmpeg-vs-gstreamer-a-comprehensive-comparison-23217be772d3)
- [FFmpegKit 退役公告](https://www.itpathsolutions.com/ffmpegkit-shutdown-what-to-do-next)
- [FFmpeg Static Builds](https://github.com/BtbN/FFmpeg-Builds)
- [tauri-action GitHub Action](https://github.com/tauri-apps/tauri-action)
- [.NET MAUI 限制分析](https://www.itpathsolutions.com/dotnet-maui-development-guide)
