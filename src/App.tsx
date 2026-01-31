import { useEffect, useRef, useState } from 'react';
import { VideoPreview } from './components/VideoPreview';
import { WatermarkPanel } from './components/WatermarkPanel';
import { BottomToolbar } from './components/BottomToolbar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ModuleSettings } from './components/SettingsPanel';
import { Timeline } from './components/Timeline';
import { useModuleStore } from './stores/moduleStore';

function App() {
  const { isLoaded, hasCompletedSetup, isEnabled, loadConfig } = useModuleStore();
  const [showModuleSettings, setShowModuleSettings] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load module config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Show loading while config loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-bg-primary">
        <div className="text-text-secondary text-sm">載入中...</div>
      </div>
    );
  }

  // Show welcome screen on first launch
  if (!hasCompletedSetup) {
    return <WelcomeScreen />;
  }

  const showWatermarkPanel = isEnabled('watermark');
  const showTimeline = isEnabled('trim');

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-primary text-text-primary overflow-hidden">
      {/* Title bar area */}
      <div
        className="h-10 flex-shrink-0 flex items-center px-4 border-b border-border bg-bg-secondary select-none"
        data-tauri-drag-region
      >
        <span className="text-sm font-medium text-text-primary">
          影片編輯器
        </span>
        <span className="text-xs text-text-secondary ml-2">v0.2.0</span>

        {/* Settings button */}
        <div className="ml-auto">
          <button
            onClick={() => setShowModuleSettings(true)}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            title="功能模組設定"
          >
            ⚙️ 模組
          </button>
        </div>
      </div>

      {/* Main content area: Preview (left) + Panel (right) */}
      <div className="flex-1 flex min-h-0">
        <VideoPreview videoRef={videoRef} />
        {showWatermarkPanel && <WatermarkPanel />}
      </div>

      {/* Timeline (bottom, only when trim module is enabled) */}
      {showTimeline && <Timeline videoRef={videoRef} />}

      {/* Bottom toolbar */}
      <BottomToolbar />

      {/* Module settings dialog */}
      <ModuleSettings
        isOpen={showModuleSettings}
        onClose={() => setShowModuleSettings(false)}
      />
    </div>
  );
}

export default App;
