import { describe, it, expect, beforeEach } from 'vitest';
import { useTextStore } from './textStore';

describe('textStore', () => {
  beforeEach(() => {
    // Reset store state
    useTextStore.setState({
      textItems: [],
      selectedTextId: null,
      subtitles: [],
      subtitleStyle: {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: 28,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 2,
        bgColor: '#000000',
        bgOpacity: 50,
        positionY: 0.85,
      },
      subtitlesEnabled: true,
      srtFilePath: null,
    });
  });

  it('should add text items', () => {
    const store = useTextStore.getState();
    store.addTextItem({ content: 'Hello' });

    const state = useTextStore.getState();
    expect(state.textItems).toHaveLength(1);
    expect(state.textItems[0].content).toBe('Hello');
    expect(state.selectedTextId).toBe(state.textItems[0].id);
  });

  it('should add text with default values', () => {
    useTextStore.getState().addTextItem();
    const state = useTextStore.getState();
    expect(state.textItems[0].content).toBe('文字');
    expect(state.textItems[0].fontSize).toBe(32);
    expect(state.textItems[0].color).toBe('#ffffff');
  });

  it('should remove text items', () => {
    const store = useTextStore.getState();
    store.addTextItem({ content: 'A' });
    store.addTextItem({ content: 'B' });

    const id = useTextStore.getState().textItems[0].id;
    store.removeTextItem(id);

    const state = useTextStore.getState();
    expect(state.textItems).toHaveLength(1);
    expect(state.textItems[0].content).toBe('B');
  });

  it('should update text items', () => {
    useTextStore.getState().addTextItem({ content: 'Original' });
    const id = useTextStore.getState().textItems[0].id;

    useTextStore.getState().updateTextItem(id, { content: 'Updated', fontSize: 48 });

    const state = useTextStore.getState();
    expect(state.textItems[0].content).toBe('Updated');
    expect(state.textItems[0].fontSize).toBe(48);
  });

  it('should select and deselect text items', () => {
    useTextStore.getState().addTextItem({ content: 'Test' });
    const id = useTextStore.getState().textItems[0].id;

    useTextStore.getState().selectTextItem(id);
    expect(useTextStore.getState().selectedTextId).toBe(id);

    useTextStore.getState().selectTextItem(null);
    expect(useTextStore.getState().selectedTextId).toBeNull();
  });

  it('should clear all text items', () => {
    useTextStore.getState().addTextItem({ content: 'A' });
    useTextStore.getState().addTextItem({ content: 'B' });
    useTextStore.getState().clearAllText();

    const state = useTextStore.getState();
    expect(state.textItems).toHaveLength(0);
    expect(state.selectedTextId).toBeNull();
  });

  it('should set subtitles', () => {
    const entries = [
      { index: 1, startTime: 0, endTime: 3, text: 'Hello' },
      { index: 2, startTime: 4, endTime: 7, text: 'World' },
    ];

    useTextStore.getState().setSubtitles(entries, '/path/to/file.srt');

    const state = useTextStore.getState();
    expect(state.subtitles).toHaveLength(2);
    expect(state.srtFilePath).toBe('/path/to/file.srt');
    expect(state.subtitlesEnabled).toBe(true);
  });

  it('should update subtitle entries', () => {
    useTextStore.getState().setSubtitles([
      { index: 1, startTime: 0, endTime: 3, text: 'Original' },
    ]);

    useTextStore.getState().updateSubtitle(1, { text: 'Modified', endTime: 5 });

    const state = useTextStore.getState();
    expect(state.subtitles[0].text).toBe('Modified');
    expect(state.subtitles[0].endTime).toBe(5);
  });

  it('should remove and re-index subtitles', () => {
    useTextStore.getState().setSubtitles([
      { index: 1, startTime: 0, endTime: 3, text: 'A' },
      { index: 2, startTime: 4, endTime: 7, text: 'B' },
      { index: 3, startTime: 8, endTime: 11, text: 'C' },
    ]);

    useTextStore.getState().removeSubtitle(2);

    const state = useTextStore.getState();
    expect(state.subtitles).toHaveLength(2);
    expect(state.subtitles[0].index).toBe(1);
    expect(state.subtitles[1].index).toBe(2);
    expect(state.subtitles[1].text).toBe('C');
  });

  it('should add new subtitle entry', () => {
    useTextStore.getState().addSubtitle({ index: 0, startTime: 0, endTime: 3, text: 'New' });

    const state = useTextStore.getState();
    expect(state.subtitles).toHaveLength(1);
    expect(state.subtitles[0].index).toBe(1); // Re-indexed
    expect(state.subtitles[0].text).toBe('New');
  });

  it('should update subtitle style', () => {
    useTextStore.getState().updateSubtitleStyle({ fontSize: 36, color: '#ff0000' });

    const state = useTextStore.getState();
    expect(state.subtitleStyle.fontSize).toBe(36);
    expect(state.subtitleStyle.color).toBe('#ff0000');
    // Other values unchanged
    expect(state.subtitleStyle.fontFamily).toBe('Noto Sans TC, sans-serif');
  });

  it('should toggle subtitles enabled', () => {
    useTextStore.getState().setSubtitlesEnabled(false);
    expect(useTextStore.getState().subtitlesEnabled).toBe(false);

    useTextStore.getState().setSubtitlesEnabled(true);
    expect(useTextStore.getState().subtitlesEnabled).toBe(true);
  });

  it('should clear subtitles', () => {
    useTextStore.getState().setSubtitles(
      [{ index: 1, startTime: 0, endTime: 3, text: 'Test' }],
      '/file.srt',
    );
    useTextStore.getState().clearSubtitles();

    const state = useTextStore.getState();
    expect(state.subtitles).toHaveLength(0);
    expect(state.srtFilePath).toBeNull();
  });

  it('should generate unique text IDs', () => {
    useTextStore.getState().addTextItem({ content: 'A' });
    useTextStore.getState().addTextItem({ content: 'B' });

    const state = useTextStore.getState();
    expect(state.textItems[0].id).not.toBe(state.textItems[1].id);
  });

  it('should deselect removed item', () => {
    useTextStore.getState().addTextItem({ content: 'A' });
    const id = useTextStore.getState().textItems[0].id;
    useTextStore.getState().selectTextItem(id);
    useTextStore.getState().removeTextItem(id);

    expect(useTextStore.getState().selectedTextId).toBeNull();
  });
});
