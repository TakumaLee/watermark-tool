import { VideoPreview } from './components/VideoPreview';
import { WatermarkPanel } from './components/WatermarkPanel';
import { BottomToolbar } from './components/BottomToolbar';

function App() {
  return (
    <div className="flex flex-col h-screen w-screen bg-bg-primary text-text-primary overflow-hidden">
      {/* Title bar area */}
      <div
        className="h-10 flex-shrink-0 flex items-center px-4 border-b border-border bg-bg-secondary select-none"
        data-tauri-drag-region
      >
        <span className="text-sm font-medium text-text-primary">
          影片浮水印工具
        </span>
        <span className="text-xs text-text-secondary ml-2">v0.1.0</span>
      </div>

      {/* Main content area: Preview (left) + Panel (right) */}
      <div className="flex-1 flex min-h-0">
        <VideoPreview />
        <WatermarkPanel />
      </div>

      {/* Bottom toolbar */}
      <BottomToolbar />
    </div>
  );
}

export default App;
