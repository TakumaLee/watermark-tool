import { create } from 'zustand';
import type { TextOverlayItem, SubtitleEntry, SubtitleStyle } from '../types/text';
import { DEFAULT_SUBTITLE_STYLE, DEFAULT_TEXT_OVERLAY } from '../types/text';

interface TextState {
  /** All text overlay items */
  textItems: TextOverlayItem[];
  /** Currently selected text item id */
  selectedTextId: string | null;

  /** Subtitle entries (from SRT import or manual) */
  subtitles: SubtitleEntry[];
  /** Subtitle style (shared across all subtitles) */
  subtitleStyle: SubtitleStyle;
  /** Whether subtitles are enabled for preview */
  subtitlesEnabled: boolean;
  /** SRT file path (if imported) */
  srtFilePath: string | null;

  /** Actions — Text Overlays */
  addTextItem: (item?: Partial<TextOverlayItem>) => void;
  removeTextItem: (id: string) => void;
  updateTextItem: (id: string, updates: Partial<TextOverlayItem>) => void;
  selectTextItem: (id: string | null) => void;
  clearAllText: () => void;

  /** Actions — Subtitles */
  setSubtitles: (entries: SubtitleEntry[], filePath?: string) => void;
  updateSubtitle: (index: number, updates: Partial<SubtitleEntry>) => void;
  removeSubtitle: (index: number) => void;
  addSubtitle: (entry: SubtitleEntry) => void;
  updateSubtitleStyle: (updates: Partial<SubtitleStyle>) => void;
  setSubtitlesEnabled: (enabled: boolean) => void;
  clearSubtitles: () => void;
}

let textIdCounter = 0;
export function generateTextId(): string {
  return `txt_${Date.now()}_${++textIdCounter}`;
}

export const useTextStore = create<TextState>((set, get) => ({
  textItems: [],
  selectedTextId: null,
  subtitles: [],
  subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
  subtitlesEnabled: true,
  srtFilePath: null,

  // --- Text Overlay Actions ---

  addTextItem: (item) => {
    const newItem: TextOverlayItem = {
      ...DEFAULT_TEXT_OVERLAY,
      ...item,
      id: generateTextId(),
      isEditing: false,
    };
    set((state) => ({
      textItems: [...state.textItems, newItem],
      selectedTextId: newItem.id,
    }));
  },

  removeTextItem: (id) =>
    set((state) => ({
      textItems: state.textItems.filter((t) => t.id !== id),
      selectedTextId: state.selectedTextId === id ? null : state.selectedTextId,
    })),

  updateTextItem: (id, updates) =>
    set((state) => ({
      textItems: state.textItems.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),

  selectTextItem: (id) =>
    set({ selectedTextId: id }),

  clearAllText: () =>
    set({ textItems: [], selectedTextId: null }),

  // --- Subtitle Actions ---

  setSubtitles: (entries, filePath) =>
    set({
      subtitles: entries,
      srtFilePath: filePath ?? null,
      subtitlesEnabled: true,
    }),

  updateSubtitle: (index, updates) =>
    set((state) => ({
      subtitles: state.subtitles.map((s) =>
        s.index === index ? { ...s, ...updates } : s,
      ),
    })),

  removeSubtitle: (index) =>
    set((state) => ({
      subtitles: state.subtitles
        .filter((s) => s.index !== index)
        .map((s, i) => ({ ...s, index: i + 1 })), // Re-index
    })),

  addSubtitle: (entry) =>
    set((state) => ({
      subtitles: [...state.subtitles, { ...entry, index: state.subtitles.length + 1 }],
    })),

  updateSubtitleStyle: (updates) =>
    set((state) => ({
      subtitleStyle: { ...state.subtitleStyle, ...updates },
    })),

  setSubtitlesEnabled: (enabled) =>
    set({ subtitlesEnabled: enabled }),

  clearSubtitles: () =>
    set({ subtitles: [], srtFilePath: null }),
}));
