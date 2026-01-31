# 🧩 模組化功能設計

> 用戶首次啟動時選擇需要的功能模組，之後可在設定中調整。
> 每個模組獨立開發、獨立啟用，不影響其他功能。

## 啟動流程

```
首次啟動 → 功能選擇畫面
┌─────────────────────────────────────┐
│  歡迎使用影片編輯器！               │
│  請選擇你需要的功能：               │
│                                     │
│  ☑️ 浮水印工具（預設開啟）           │
│  ☐ 影片剪輯（裁切/分割/合併）       │
│  ☐ 文字 & 字幕                      │
│  ☐ 音訊處理                         │
│  ☐ 濾鏡 & 色彩校正                  │
│  ☐ AI 工具（字幕/場景偵測）         │
│                                     │
│  💡 之後可在 設定 > 功能模組 調整    │
│                                     │
│          [ 開始使用 ]                │
└─────────────────────────────────────┘
```

## 模組定義

| 模組 ID | 名稱 | 預設 | UI 影響 |
|---------|------|------|---------|
| `watermark` | 浮水印工具 | ✅ 開啟 | 右側浮水印面板、底部浮水印按鈕 |
| `trim` | 影片剪輯 | ❌ | 時間軸 UI、裁切/分割工具 |
| `text` | 文字 & 字幕 | ❌ | 文字面板、字幕軌道 |
| `audio` | 音訊處理 | ❌ | 音訊波形、BGM 匯入 |
| `filters` | 濾鏡 & 色彩 | ❌ | 濾鏡面板、調色工具 |
| `ai` | AI 工具 | ❌ | AI 功能選單 |

## 技術實作

### 前端
```typescript
// stores/moduleStore.ts
interface ModuleState {
  enabledModules: Set<string>;
  toggle: (moduleId: string) => void;
  isEnabled: (moduleId: string) => boolean;
}

// 預設值
const DEFAULT_MODULES = new Set(['watermark']);
```

### UI 條件渲染
```tsx
// 各面板和工具列根據啟用狀態顯示/隱藏
{modules.isEnabled('watermark') && <WatermarkPanel />}
{modules.isEnabled('trim') && <TimelinePanel />}
{modules.isEnabled('text') && <TextPanel />}
```

### 設定持久化
- 存在 Tauri app data: `modules.json`
- 首次啟動沒有此檔案 → 顯示功能選擇畫面
- 之後可在 設定 > 功能模組 重新調整

## 好處
1. **輕量啟動** — 只載入需要的功能，不浪費資源
2. **漸進式體驗** — 新手不被複雜 UI 嚇到
3. **獨立開發** — 每個模組可以獨立開發和測試
4. **彈性擴展** — 新功能直接加新模組，不動現有程式碼
