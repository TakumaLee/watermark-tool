import { useState, useEffect, useMemo } from 'react';
import { useModuleStore } from '../../stores/moduleStore';
import { ALL_MODULES } from '../../types';
import type { ModuleId } from '../../types';

export function WelcomeScreen() {
  const { completeSetup, setModules } = useModuleStore();

  // Compute default module IDs once
  const defaultModuleIds = useMemo(() => {
    return ALL_MODULES.filter((m) => m.defaultEnabled).map((m) => m.id);
  }, []);

  // Start with empty set, then populate in useEffect
  const [selected, setSelected] = useState<Set<ModuleId>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize selected modules on mount
  useEffect(() => {
    if (!isInitialized) {
      setSelected(new Set(defaultModuleIds));
      setIsInitialized(true);
    }
  }, [defaultModuleIds, isInitialized]);

  const handleToggle = (moduleId: ModuleId) => {
    const next = new Set(selected);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    setSelected(next);
  };

  const handleStart = () => {
    setModules(Array.from(selected));
    completeSetup();
  };

  const categoryLabels: Record<string, string> = {
    core: '核心功能',
    editing: '編輯工具',
    enhancement: '增強效果',
    ai: 'AI 功能',
  };

  // Group modules by category
  const grouped = ALL_MODULES.reduce<Record<string, typeof ALL_MODULES>>((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {});

  // Button should be enabled if we have selected modules OR we haven't initialized yet
  // (to prevent flash of disabled state)
  const canStart = isInitialized ? selected.size > 0 : defaultModuleIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex items-center justify-center">
      <div className="w-full max-w-lg mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎬</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            歡迎使用影片編輯器
          </h1>
          <p className="text-sm text-text-secondary">
            請選擇你需要的功能模組，之後可在設定中隨時調整
          </p>
        </div>

        {/* Module selection */}
        <div className="space-y-4 mb-8">
          {Object.entries(grouped).map(([category, modules]) => (
            <div key={category}>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 px-1">
                {categoryLabels[category] || category}
              </h3>
              <div className="space-y-2">
                {modules.map((mod) => {
                  // Before initialization, show default-enabled as selected
                  const isSelected = isInitialized 
                    ? selected.has(mod.id)
                    : mod.defaultEnabled;
                  const isDefault = mod.defaultEnabled;

                  return (
                    <button
                      key={mod.id}
                      onClick={() => handleToggle(mod.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150 text-left
                        ${isSelected
                          ? 'border-accent/50 bg-accent/10'
                          : 'border-border bg-bg-secondary hover:border-border/80'
                        }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors
                          ${isSelected
                            ? 'bg-accent border-accent text-white'
                            : 'border-border bg-bg-component'
                          }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Icon */}
                      <span className="text-xl flex-shrink-0">{mod.icon}</span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {mod.name}
                          </span>
                          {isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                              推薦
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {mod.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Start button */}
        <div className="text-center">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="px-8 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium
                       transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            開始使用
          </button>
          <p className="text-xs text-text-secondary mt-3">
            💡 之後可在 設定 &gt; 功能模組 隨時調整
          </p>
        </div>
      </div>
    </div>
  );
}
