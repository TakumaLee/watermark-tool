# 架構研究：MVVM 適用性分析報告

> 日期：2025-07-15  
> 狀態：✅ 完成  
> 技術棧：Tauri 2.0 + React 19 + TypeScript + Zustand + FFmpeg  
> 專案：影片浮水印桌面工具

---

## 目錄

1. [MVVM 概述與核心概念](#1-mvvm-概述與核心概念)
2. [MVVM 在本專案的優勢與劣勢](#2-mvvm-在本專案的優勢與劣勢)
3. [React 生態中的 MVVM 實踐](#3-react-生態中的-mvvm-實踐)
4. [與其他架構比較](#4-與其他架構比較)
5. [具體推薦方案](#5-具體推薦方案)
6. [推薦資料夾結構](#6-推薦資料夾結構)
7. [各層實作範例](#7-各層實作範例)
8. [結論](#8-結論)

---

## 1. MVVM 概述與核心概念

MVVM（Model-View-ViewModel）源自微軟 WPF 生態，核心思想是：

```
View  ←──雙向綁定──→  ViewModel  ←──→  Model
（UI 渲染）            （狀態+邏輯）      （資料層）
```

- **Model**：領域資料與業務規則（浮水印設定、影片元資料、FFmpeg 參數）
- **View**：純 UI 渲染，不含業務邏輯
- **ViewModel**：橋接 View 和 Model，持有 UI 狀態、轉換邏輯、命令（commands）

關鍵特徵：**雙向資料綁定**（two-way data binding）—— View 的變化自動同步到 ViewModel，反之亦然。

---

## 2. MVVM 在本專案的優勢與劣勢

### 2.1 優勢

| 優勢 | 具體場景 |
|------|---------|
| **關注點分離** | 浮水印拖放邏輯（ViewModel）與渲染（View）清楚分開，利於測試 |
| **可測試性** | ViewModel 是純 JS/TS 邏輯，可脫離 DOM 做單元測試（拖放座標計算、透明度轉換、FFmpeg 參數組裝） |
| **多視圖共享邏輯** | 同一個浮水印 ViewModel 可驅動預覽區拖放 + 右側屬性面板 + 設定檔匯出 |
| **序列化友善** | Model 層天然對應 JSON 設定檔，ViewModel 負責 Model ↔ UI 狀態轉換 |
| **Tauri 分層對應** | Model 可以映射到 Rust 後端的資料結構，ViewModel 處理前後端通訊 |

### 2.2 劣勢

| 劣勢 | 具體影響 |
|------|---------|
| **React 天然是單向流** | React 的設計哲學是 `state → render`，沒有原生雙向綁定。硬做 MVVM 會與框架慣例衝突 |
| **高頻更新的效能風險** | 拖放操作需要 60fps，經典 MVVM 的雙向綁定如果觸發多餘 re-render 會造成卡頓 |
| **過度抽象** | 中型專案（預估 30-50 個元件）套完整 MVVM 會增加大量 boilerplate |
| **團隊學習成本** | React 社群幾乎不使用 MVVM 術語，新成員理解成本高 |
| **與 Zustand 定位衝突** | Zustand 本身就是輕量狀態管理，再包一層 ViewModel 可能變成「管理狀態的狀態」 |
| **雙向綁定除錯困難** | 數據流方向不明確時，追蹤 bug 來源更複雜 |

### 2.3 關鍵矛盾：高頻拖放 vs 雙向綁定

浮水印拖放是本專案最關鍵的互動。分析資料流：

```
滑鼠移動 → 計算新座標 → 更新預覽位置 → 同步屬性面板 X/Y 值
                                          ↘ 同步 Zustand store（低頻 throttle）
```

- **60fps 更新**需要 `requestAnimationFrame` 或 React 19 的 `useTransition`，避免每幀都觸發完整狀態更新
- 經典 MVVM 的雙向綁定在這裡會造成 **不必要的同步開銷**
- 更好的做法：拖放期間用 **local ref state**（非受控），拖放結束才寫回 store

**結論：嚴格 MVVM 的雙向綁定在高頻互動場景是反模式。**

---

## 3. React 生態中的 MVVM 實踐

### 3.1 方案比較

| 方案 | MVVM 程度 | 效能 | 複雜度 | 適合本專案？ |
|------|----------|------|--------|------------|
| **MobX + React** | ⭐⭐⭐⭐⭐ 最接近傳統 MVVM | ⭐⭐⭐⭐ 細粒度響應式 | ⭐⭐⭐ 需學 observable/action | ⚠️ 可行但引入大量概念 |
| **Custom Hooks as ViewModel** | ⭐⭐⭐ MVVM-like | ⭐⭐⭐⭐⭐ 原生 React | ⭐⭐ 低 | ✅ 推薦 |
| **Zustand slices + hooks** | ⭐⭐ 半 MVVM | ⭐⭐⭐⭐⭐ 極輕量 | ⭐ 最低 | ✅ 推薦 |
| **Redux Toolkit + selectors** | ⭐⭐ Flux 流 | ⭐⭐⭐ 較重 | ⭐⭐⭐ | ❌ 對本專案過重 |
| **Valtio (proxy-based)** | ⭐⭐⭐⭐ 類 MobX | ⭐⭐⭐⭐ | ⭐⭐ | ⚠️ 可行但換掉 Zustand |

### 3.2 MobX：最接近 MVVM，但不推薦

MobX 的 `observable` + `computed` + `action` 模式完美對應 MVVM 的 ViewModel。
但本專案已選擇 Zustand，替換成本高，且 MobX 的 proxy 魔法在 React 19 的 concurrent features 下有相容性風險。

### 3.3 Custom Hooks as ViewModel：推薦

React 的 custom hooks 天然就是 ViewModel 的角色：

```typescript
// useWatermarkViewModel.ts — 這就是 ViewModel
function useWatermarkViewModel(watermarkId: string) {
  // 從 store (Model) 讀取
  const watermark = useWatermarkStore(s => s.watermarks[watermarkId]);
  
  // 衍生狀態 (computed)
  const displayPosition = useMemo(() => 
    toDisplayCoords(watermark.position, previewSize), [watermark.position, previewSize]);
  
  // 命令 (commands)
  const updatePosition = useCallback((pos: Position) => {
    store.updateWatermark(watermarkId, { position: pos });
  }, [watermarkId]);
  
  return { watermark, displayPosition, updatePosition };
}
```

這種模式：
- ✅ 符合 React 慣例
- ✅ 可測試（用 `renderHook` 測試）
- ✅ 自然分離 View 和邏輯
- ✅ 不需要額外依賴

---

## 4. 與其他架構比較

### 4.1 架構比較矩陣

| 架構 | 資料流 | 適合規模 | 高頻互動 | 序列化 | Tauri 適配 | 推薦度 |
|------|--------|---------|---------|--------|-----------|--------|
| **MVVM（嚴格）** | 雙向 | 大型 | ❌ 綁定開銷 | ✅ | ⚠️ 概念衝突 | ❌ |
| **MVC** | 三角依賴 | 小型 | ⚠️ | ⚠️ | ❌ 無明確對應 | ❌ |
| **MVP** | Presenter 中介 | 中型 | ⚠️ | ✅ | ⚠️ | ❌ |
| **Flux/Redux 單向流** | 單向 | 大型 | ⚠️ 全局 dispatch 瓶頸 | ✅ | ✅ | ⚠️ 過重 |
| **Clean Architecture** | 分層 | 企業級 | ✅ 靈活 | ✅ | ✅ | ⚠️ 過度 |
| **Feature-Sliced + Hooks** | 單向為主 | 中型 | ✅ | ✅ | ✅ | ✅ **推薦** |

### 4.2 逐一分析

#### MVC — 不適合

React 本身打破了 MVC 的 View-Controller 邊界。在 React 中 component 既是 View 也是 Controller。
強行套用 MVC 只會造成職責混亂。

#### MVP — 不適合

MVP 的 Presenter 持有 View 的引用來更新 UI，這在 React 的宣告式範式中完全不合理。
React 的 `state → render` 不需要手動操控 View。

#### Flux/Redux 單向流 — 可行但過重

Redux Toolkit 對大型應用（數百個 action）很合適，但本專案預估 action 數量 < 30。
Zustand 已能滿足需求，引入 Redux 是殺雞用牛刀。

#### Clean Architecture — 概念可借鑑

Clean Architecture 的 **Use Case 層** 概念值得借鑑：把「套用浮水印到影片」「載入設定檔」等業務邏輯封裝為獨立的 use case。
但完整的 Clean Architecture（Entity / Use Case / Interface Adapter / Framework）在前端專案中層數過多。

#### Feature-Sliced Design + Custom Hooks — 最適合 ✅

結合 Feature-Sliced Design（按功能切割模組）+ Custom Hooks（作為 ViewModel 角色）+ Zustand（全局狀態）：
- 符合 React 慣例
- 功能模組化
- 自然分層但不過度抽象

---

## 5. 具體推薦方案

### 🏆 推薦：MVVM-Inspired Feature-Sliced Architecture

**不用嚴格 MVVM，但借鑑其分層思想**，結合 React 生態最佳實踐。

### 5.1 三層架構

```
┌──────────────────────────────────────────────────┐
│                    View Layer                     │
│  React Components（純渲染 + 事件委派）              │
│  只關心「長什麼樣」和「使用者做了什麼」               │
├──────────────────────────────────────────────────┤
│               ViewModel Layer                     │
│  Custom Hooks + Zustand Selectors                 │
│  業務邏輯、狀態轉換、Tauri IPC 呼叫               │
│  「把 Model 翻譯成 View 需要的格式」               │
├──────────────────────────────────────────────────┤
│                   Model Layer                     │
│  Zustand Store（前端狀態） + Rust 後端（持久化+處理）│
│  純資料、型別定義、序列化格式                       │
└──────────────────────────────────────────────────┘
```

### 5.2 各層職責

#### Model 層

```
定義：                  範例：
─────────────────────   ──────────────────────────────
資料型別（types）        WatermarkConfig, VideoMeta, ExportSettings
Zustand store slices    watermarkStore, videoStore, settingsStore
Tauri IPC 呼叫封裝      invoke('process_video', {...})
JSON 設定檔 schema      settings.schema.ts
```

#### ViewModel 層（Custom Hooks）

```
定義：                  範例：
─────────────────────   ──────────────────────────────
UI 狀態衍生             useWatermarkViewModel → displayPosition, scaledSize
業務邏輯               useBatchProcessor → start, pause, progress
座標轉換               預覽座標 ↔ 實際像素座標
命令封裝               useExportCommand → validate → invoke Rust
複合操作               useSettingsManager → save/load/apply
```

#### View 層

```
定義：                  範例：
─────────────────────   ──────────────────────────────
React 元件              WatermarkOverlay, PropertyPanel, BatchDialog
只接收 props 和回呼      <DragHandle onDrag={vm.handleDrag} />
CSS/動畫               Tailwind classes, Framer Motion
```

### 5.3 高頻拖放的特殊處理

```typescript
// 拖放使用「雙層狀態」策略
function useWatermarkDrag(watermarkId: string) {
  // Layer 1: Local ref（60fps，不觸發 re-render）
  const localPos = useRef<Position>({ x: 0, y: 0 });
  const rafId = useRef<number>(0);
  
  // Layer 2: Store state（throttled，更新屬性面板）
  const commitPosition = useThrottledCallback((pos: Position) => {
    store.updateWatermark(watermarkId, { position: pos });
  }, 100); // 每 100ms 同步一次到 store
  
  const onPointerMove = useCallback((e: PointerEvent) => {
    localPos.current = { x: e.clientX, y: e.clientY };
    // 直接操作 DOM transform（跳過 React render）
    rafId.current = requestAnimationFrame(() => {
      elementRef.current!.style.transform = 
        `translate(${localPos.current.x}px, ${localPos.current.y}px)`;
    });
    commitPosition(localPos.current);
  }, []);
  
  const onPointerUp = useCallback(() => {
    // 拖放結束：最終值寫入 store
    store.updateWatermark(watermarkId, { position: localPos.current });
  }, []);
  
  return { onPointerMove, onPointerUp };
}
```

**關鍵：拖放過程中繞過 React 的 reconciliation，用 `ref` + `rAF` 直接操作 DOM。只在拖放結束時和 throttled 間隔寫回 Zustand store。**

### 5.4 Tauri 跨平台通訊層

```
React (ViewModel hooks)
    │
    ├── invoke('get_video_info', { path })     → Rust 回傳 VideoMeta
    ├── invoke('process_video', { config })     → Rust 啟動 FFmpeg，回傳 task_id
    ├── listen('batch:progress', callback)      → Rust 持續推送進度
    └── invoke('save_settings', { json })       → Rust 寫入檔案
```

Model 層負責封裝 Tauri IPC，ViewModel 層負責呼叫時機和結果處理：

```typescript
// model/services/tauriVideoService.ts（Model 層）
export const videoService = {
  getInfo: (path: string) => invoke<VideoMeta>('get_video_info', { path }),
  process: (config: ProcessConfig) => invoke<string>('process_video', { config }),
};

// viewmodels/useBatchProcessor.ts（ViewModel 層）
export function useBatchProcessor() {
  const videos = useVideoStore(s => s.selectedVideos);
  const settings = useSettingsStore(s => s.currentConfig);
  const [progress, setProgress] = useState<BatchProgress>({ total: 0, done: 0 });
  
  const startBatch = useCallback(async () => {
    for (const video of videos) {
      await videoService.process({ video, watermarks: settings.watermarks });
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }
  }, [videos, settings]);
  
  return { progress, startBatch };
}
```

---

## 6. 推薦資料夾結構

```
src/
├── main.tsx                          # 入口
├── App.tsx                           # 根元件 + 路由
│
├── models/                           # ═══ Model 層 ═══
│   ├── types/                        # 所有型別定義
│   │   ├── watermark.ts              #   WatermarkConfig, Position, Size...
│   │   ├── video.ts                  #   VideoMeta, VideoFormat...
│   │   ├── settings.ts               #   ProjectSettings, ExportConfig...
│   │   └── batch.ts                  #   BatchJob, BatchProgress...
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── watermarkStore.ts         #   浮水印狀態（CRUD、排序）
│   │   ├── videoStore.ts             #   影片列表、選取狀態
│   │   ├── settingsStore.ts          #   設定檔、偏好設定
│   │   ├── uiStore.ts               #   UI 暫態（modal 開關、選取高亮）
│   │   └── batchStore.ts            #   批次處理佇列與進度
│   │
│   ├── services/                     # 外部服務封裝（Tauri IPC）
│   │   ├── tauriVideoService.ts      #   影片處理相關 invoke
│   │   ├── tauriFileService.ts       #   檔案讀寫、設定檔 I/O
│   │   └── tauriSystemService.ts     #   系統通知、路徑查詢
│   │
│   └── schemas/                      # 序列化 schema（Zod）
│       ├── settingsSchema.ts         #   設定檔 JSON 驗證
│       └── watermarkSchema.ts        #   浮水印配置驗證
│
├── viewmodels/                       # ═══ ViewModel 層 ═══
│   ├── useWatermarkViewModel.ts      #   浮水印屬性管理（位置、大小、透明度）
│   ├── useWatermarkDrag.ts           #   拖放互動邏輯（60fps 優化）
│   ├── useWatermarkResize.ts         #   縮放互動邏輯
│   ├── useVideoPreview.ts           #   影片預覽（載入、幀擷取）
│   ├── useBatchProcessor.ts          #   批次處理（開始、暫停、進度）
│   ├── useSettingsManager.ts         #   設定儲存/載入/套用
│   ├── useExportConfig.ts            #   輸出設定組裝
│   └── useProjectCoordinates.ts      #   預覽座標 ↔ 實際像素轉換
│
├── views/                            # ═══ View 層 ═══
│   ├── layouts/                      # 佈局元件
│   │   └── MainLayout.tsx            #   三欄佈局
│   │
│   ├── panels/                       # 主要面板
│   │   ├── PreviewPanel/             #   影片預覽區
│   │   │   ├── PreviewPanel.tsx
│   │   │   ├── VideoCanvas.tsx       #     影片渲染
│   │   │   └── WatermarkOverlay.tsx  #     浮水印疊加層
│   │   │
│   │   ├── PropertyPanel/            #   右側屬性面板
│   │   │   ├── PropertyPanel.tsx
│   │   │   ├── WatermarkCard.tsx     #     單一浮水印設定卡
│   │   │   ├── PositionInput.tsx     #     X/Y 座標輸入
│   │   │   ├── SizeInput.tsx         #     尺寸輸入
│   │   │   ├── OpacitySlider.tsx     #     透明度滑桿
│   │   │   └── MotionSelector.tsx    #     移動方式選擇器
│   │   │
│   │   └── ToolbarPanel/             #   底部工具列
│   │       ├── ToolbarPanel.tsx
│   │       ├── ImportButton.tsx
│   │       └── ExportButton.tsx
│   │
│   ├── dialogs/                      # 對話框
│   │   ├── BatchDialog.tsx           #   批次處理設定
│   │   ├── ExportDialog.tsx          #   輸出設定
│   │   └── SettingsDialog.tsx        #   應用程式設定
│   │
│   └── components/                   # 通用 UI 元件
│       ├── DragHandle.tsx
│       ├── ResizeHandle.tsx
│       ├── ProgressBar.tsx
│       ├── Slider.tsx
│       └── FileDropZone.tsx
│
├── shared/                           # 跨層共用
│   ├── constants.ts                  #   常數定義
│   ├── utils/                        #   工具函式
│   │   ├── coordinates.ts            #     座標數學
│   │   ├── format.ts                 #     格式化
│   │   └── throttle.ts              #     節流/防抖
│   └── hooks/                        #   通用 hooks（非業務邏輯）
│       ├── useAnimationFrame.ts
│       ├── useThrottledCallback.ts
│       └── useKeyboard.ts
│
└── styles/                           # 樣式
    ├── globals.css
    ├── theme.ts
    └── tokens.ts
```

### 6.1 命名慣例

| 層 | 檔案命名 | 匯出形式 |
|---|---------|---------|
| Model - types | `camelCase.ts` | `export type/interface` |
| Model - stores | `camelCaseStore.ts` | `export const useXxxStore = create(...)` |
| Model - services | `tauriXxxService.ts` | `export const xxxService = { ... }` |
| ViewModel | `useXxxViewModel.ts` 或 `useXxx.ts` | `export function useXxx()` |
| View | `PascalCase.tsx` | `export function XxxComponent()` |

### 6.2 依賴方向（嚴格單向）

```
View → ViewModel → Model
 │         │         │
 │         │         └── types, stores, services
 │         └── custom hooks (import from models/)
 └── React components (import from viewmodels/)
 
 ❌ Model 不得 import ViewModel
 ❌ ViewModel 不得 import View
 ❌ View 不得直接 import Model（必須經過 ViewModel）
```

例外：View 可直接使用 `models/types/` 中的型別定義（純型別不違反分層）。

---

## 7. 各層實作範例

### 7.1 Model 層 — Zustand Store

```typescript
// models/stores/watermarkStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WatermarkConfig, Position, Size } from '../types/watermark';

interface WatermarkState {
  watermarks: Record<string, WatermarkConfig>;
  order: string[];  // 顯示順序
  selectedId: string | null;
}

interface WatermarkActions {
  addWatermark: (config: WatermarkConfig) => void;
  removeWatermark: (id: string) => void;
  updatePosition: (id: string, position: Position) => void;
  updateSize: (id: string, size: Size) => void;
  updateOpacity: (id: string, opacity: number) => void;
  selectWatermark: (id: string | null) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  loadFromConfig: (watermarks: WatermarkConfig[]) => void;
}

export const useWatermarkStore = create<WatermarkState & WatermarkActions>()(
  immer((set) => ({
    watermarks: {},
    order: [],
    selectedId: null,

    addWatermark: (config) => set((state) => {
      state.watermarks[config.id] = config;
      state.order.push(config.id);
    }),

    updatePosition: (id, position) => set((state) => {
      if (state.watermarks[id]) {
        state.watermarks[id].position = position;
      }
    }),

    updateOpacity: (id, opacity) => set((state) => {
      if (state.watermarks[id]) {
        state.watermarks[id].opacity = Math.max(0, Math.min(1, opacity));
      }
    }),

    // ... 其他 actions
  }))
);
```

### 7.2 ViewModel 層 — Custom Hook

```typescript
// viewmodels/useWatermarkViewModel.ts
import { useMemo, useCallback } from 'react';
import { useWatermarkStore } from '../models/stores/watermarkStore';
import { useVideoStore } from '../models/stores/videoStore';
import { previewToActual, actualToPreview } from '../shared/utils/coordinates';

export function useWatermarkViewModel(watermarkId: string) {
  const watermark = useWatermarkStore(s => s.watermarks[watermarkId]);
  const updatePosition = useWatermarkStore(s => s.updatePosition);
  const updateOpacity = useWatermarkStore(s => s.updateOpacity);
  const updateSize = useWatermarkStore(s => s.updateSize);
  const videoMeta = useVideoStore(s => s.currentVideo);

  // 衍生狀態：實際像素座標 → 預覽區顯示座標
  const displayPosition = useMemo(() => {
    if (!watermark || !videoMeta) return { x: 0, y: 0 };
    return actualToPreview(watermark.position, videoMeta.resolution, previewSize);
  }, [watermark?.position, videoMeta?.resolution]);

  // 衍生狀態：百分比顯示
  const opacityPercent = useMemo(() => 
    Math.round((watermark?.opacity ?? 1) * 100), [watermark?.opacity]);

  // 命令：更新位置（從預覽座標轉換回實際座標）
  const setDisplayPosition = useCallback((displayPos: Position) => {
    if (!videoMeta) return;
    const actualPos = previewToActual(displayPos, videoMeta.resolution, previewSize);
    updatePosition(watermarkId, actualPos);
  }, [watermarkId, videoMeta]);

  // 命令：更新透明度（百分比 → 0-1）
  const setOpacityPercent = useCallback((percent: number) => {
    updateOpacity(watermarkId, percent / 100);
  }, [watermarkId]);

  // 衍生：「同上」功能
  const canCopyFromPrevious = useMemo(() => {
    // 判斷是否有前一個浮水印可複製設定
    const order = useWatermarkStore.getState().order;
    const idx = order.indexOf(watermarkId);
    return idx > 0;
  }, [watermarkId]);

  return {
    watermark,
    displayPosition,
    opacityPercent,
    canCopyFromPrevious,
    setDisplayPosition,
    setOpacityPercent,
    updateSize: (size: Size) => updateSize(watermarkId, size),
  };
}
```

### 7.3 View 層 — React Component

```tsx
// views/panels/PropertyPanel/WatermarkCard.tsx
import { useWatermarkViewModel } from '../../../viewmodels/useWatermarkViewModel';
import { OpacitySlider } from './OpacitySlider';
import { PositionInput } from './PositionInput';

interface WatermarkCardProps {
  watermarkId: string;
}

export function WatermarkCard({ watermarkId }: WatermarkCardProps) {
  const vm = useWatermarkViewModel(watermarkId);

  if (!vm.watermark) return null;

  return (
    <div className="watermark-card">
      <h3>{vm.watermark.name}</h3>
      
      <PositionInput
        x={vm.displayPosition.x}
        y={vm.displayPosition.y}
        onChange={vm.setDisplayPosition}
      />
      
      <OpacitySlider
        value={vm.opacityPercent}
        onChange={vm.setOpacityPercent}
      />
      
      {vm.canCopyFromPrevious && (
        <button onClick={vm.copyFromPrevious}>
          同上（複製前一個設定）
        </button>
      )}
    </div>
  );
}
```

### 7.4 完整資料流圖

```
使用者拖放浮水印
    │
    ▼
View: WatermarkOverlay.onPointerMove()
    │
    ▼
ViewModel: useWatermarkDrag.handleDrag()
    ├── 即時：ref + rAF 更新 DOM transform（60fps）
    └── 節流：每 100ms 呼叫 store.updatePosition()
            │
            ▼
        Model: watermarkStore.updatePosition()
            │
            ▼
        Zustand 通知訂閱者
            │
            ├── ViewModel: useWatermarkViewModel 重新計算 displayPosition
            │       │
            │       ▼
            │   View: PropertyPanel 更新 X/Y 數值顯示
            │
            └── （拖放結束時）
                ViewModel: useSettingsManager 標記「未儲存」
```

---

## 8. 結論

### ❌ 不推薦：嚴格 MVVM

理由：
1. React 是單向資料流框架，強制雙向綁定是逆流而行
2. 高頻拖放場景下雙向綁定會造成效能瓶頸
3. 中型專案的 boilerplate/收益比不划算
4. 與已選擇的 Zustand 存在概念衝突

### ✅ 推薦：MVVM-Inspired Feature-Sliced Architecture

| 層 | 對應 MVVM | 實作技術 | 職責 |
|----|----------|---------|------|
| `models/` | Model | Zustand + Tauri IPC + Zod | 資料、狀態、外部服務 |
| `viewmodels/` | ViewModel | Custom Hooks | 業務邏輯、狀態轉換、命令 |
| `views/` | View | React Components | 純渲染、事件委派 |

### 為什麼這個方案最好？

1. **借鑑 MVVM 精華**（分層、可測試、關注點分離）而不受其雙向綁定束縛
2. **符合 React 慣例**，新成員零學習成本（custom hooks 是每個 React 開發者的日常）
3. **Zustand 完美融入**，不需要替換或包裝
4. **高頻互動有解**，ref + rAF 方案已被 React DnD 等成熟庫驗證
5. **Tauri 跨平台自然對應**，Model 層的 service 封裝 IPC，ViewModel 不需要關心是桌面還是 Web
6. **序列化友善**，Model 層的 types 直接對應 JSON schema，Zod 驗證設定檔
7. **可漸進採用**，不需要一開始就完美分層，可以從核心功能（浮水印管理）開始

### 一句話總結

> **用 MVVM 的思想，React 的方式。**  
> `models/` 管資料，`viewmodels/` 管邏輯，`views/` 管畫面。  
> Custom Hooks 就是你的 ViewModel，Zustand Store 就是你的 Model。  
> 不需要框架，不需要裝飾器，用 React 原生能力就夠了。

---

*報告完成。如需針對特定模組（如拖放系統、批次處理）做更深入的設計，可另開文件。*
