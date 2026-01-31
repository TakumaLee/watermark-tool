/** Module definition */
export interface ModuleDefinition {
  /** Unique module ID */
  id: ModuleId;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon emoji */
  icon: string;
  /** Whether it's enabled by default */
  defaultEnabled: boolean;
  /** Module category for grouping */
  category: 'core' | 'editing' | 'enhancement' | 'ai';
}

/** All possible module IDs */
export type ModuleId = 'watermark' | 'trim' | 'text' | 'audio' | 'filters' | 'ai';

/** Module configuration persisted to disk */
export interface ModuleConfig {
  version: number;
  enabledModules: ModuleId[];
  hasCompletedSetup: boolean;
}

/** All available modules */
export const ALL_MODULES: ModuleDefinition[] = [
  {
    id: 'watermark',
    name: '浮水印工具',
    description: '在影片上疊加圖片浮水印，支援拖放定位、透明度、動態移動',
    icon: '💧',
    defaultEnabled: true,
    category: 'core',
  },
  {
    id: 'trim',
    name: '影片剪輯',
    description: '裁切、分割、排序、合併影片片段',
    icon: '✂️',
    defaultEnabled: false,
    category: 'editing',
  },
  {
    id: 'text',
    name: '文字 & 字幕',
    description: '在影片上添加文字疊加層和字幕',
    icon: '📝',
    defaultEnabled: false,
    category: 'editing',
  },
  {
    id: 'audio',
    name: '音訊處理',
    description: '音量調整、BGM 添加、音訊淡入淡出',
    icon: '🎵',
    defaultEnabled: false,
    category: 'editing',
  },
  {
    id: 'filters',
    name: '濾鏡 & 色彩',
    description: '影片濾鏡、亮度對比飽和度調整',
    icon: '🎨',
    defaultEnabled: false,
    category: 'enhancement',
  },
  {
    id: 'ai',
    name: 'AI 工具',
    description: '自動字幕生成、場景偵測、智能剪輯',
    icon: '🤖',
    defaultEnabled: false,
    category: 'ai',
  },
];

export const MODULE_CONFIG_VERSION = 1;
