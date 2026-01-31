import { useModuleStore } from '../../stores/moduleStore';
import { ALL_MODULES } from '../../types';
import type { ModuleId } from '../../types';

interface ModuleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModuleSettings({ isOpen, onClose }: ModuleSettingsProps) {
  const { enabledModules, toggle } = useModuleStore();

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    core: '核心功能',
    editing: '編輯工具',
    enhancement: '增強效果',
    ai: 'AI 功能',
  };

  const grouped = ALL_MODULES.reduce<Record<string, typeof ALL_MODULES>>((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-medium text-text-primary">⚙️ 功能模組</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary
                       hover:text-text-primary hover:bg-bg-component transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Module list */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          <p className="text-xs text-text-secondary mb-3">
            開關功能模組，UI 會即時顯示或隱藏對應的面板和工具。
          </p>

          {Object.entries(grouped).map(([category, modules]) => (
            <div key={category}>
              <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2">
                {categoryLabels[category] || category}
              </h3>
              <div className="space-y-1.5">
                {modules.map((mod) => {
                  const isEnabled = enabledModules.has(mod.id);

                  return (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-bg-primary/50 border border-border/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg">{mod.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm text-text-primary font-medium">{mod.name}</div>
                          <div className="text-xs text-text-secondary truncate">{mod.description}</div>
                        </div>
                      </div>

                      {/* Toggle switch */}
                      <button
                        onClick={() => toggle(mod.id as ModuleId)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ml-3
                          ${isEnabled ? 'bg-accent' : 'bg-border'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                            ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm
                       transition-colors duration-150"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
