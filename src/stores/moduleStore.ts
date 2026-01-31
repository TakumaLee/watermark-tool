import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { ModuleId, ModuleConfig } from '../types';
import { ALL_MODULES, MODULE_CONFIG_VERSION } from '../types';

interface ModuleState {
  /** Set of enabled module IDs */
  enabledModules: Set<ModuleId>;
  /** Whether the initial setup (welcome screen) has been completed */
  hasCompletedSetup: boolean;
  /** Whether we've loaded the config from disk */
  isLoaded: boolean;

  /** Check if a module is enabled */
  isEnabled: (moduleId: ModuleId) => boolean;
  /** Toggle a module on/off */
  toggle: (moduleId: ModuleId) => void;
  /** Enable a module */
  enable: (moduleId: ModuleId) => void;
  /** Disable a module */
  disable: (moduleId: ModuleId) => void;
  /** Set multiple modules at once (for welcome screen) */
  setModules: (moduleIds: ModuleId[]) => void;
  /** Mark setup as complete */
  completeSetup: () => void;
  /** Load config from disk */
  loadConfig: () => Promise<void>;
  /** Save config to disk */
  saveConfig: () => Promise<void>;
}

const DEFAULT_ENABLED: ModuleId[] = ALL_MODULES
  .filter((m) => m.defaultEnabled)
  .map((m) => m.id);

export const useModuleStore = create<ModuleState>((set, get) => ({
  enabledModules: new Set<ModuleId>(DEFAULT_ENABLED),
  hasCompletedSetup: false,
  isLoaded: false,

  isEnabled: (moduleId) => get().enabledModules.has(moduleId),

  toggle: (moduleId) => {
    const current = get().enabledModules;
    const next = new Set(current);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    set({ enabledModules: next });
    // Auto-save
    get().saveConfig();
  },

  enable: (moduleId) => {
    const next = new Set(get().enabledModules);
    next.add(moduleId);
    set({ enabledModules: next });
    get().saveConfig();
  },

  disable: (moduleId) => {
    const next = new Set(get().enabledModules);
    next.delete(moduleId);
    set({ enabledModules: next });
    get().saveConfig();
  },

  setModules: (moduleIds) => {
    set({ enabledModules: new Set(moduleIds) });
    get().saveConfig();
  },

  completeSetup: () => {
    set({ hasCompletedSetup: true });
    get().saveConfig();
  },

  loadConfig: async () => {
    try {
      const dataDir = await appDataDir();
      const configPath = await join(dataDir, 'modules.json');
      const content = await invoke<string>('load_preset', { path: configPath });
      const config: ModuleConfig = JSON.parse(content);

      if (config.version === MODULE_CONFIG_VERSION) {
        set({
          enabledModules: new Set(config.enabledModules as ModuleId[]),
          hasCompletedSetup: config.hasCompletedSetup,
          isLoaded: true,
        });
      } else {
        // Version mismatch, use defaults
        set({ isLoaded: true });
      }
    } catch {
      // File doesn't exist or is invalid — first launch
      set({ isLoaded: true, hasCompletedSetup: false });
    }
  },

  saveConfig: async () => {
    try {
      const { enabledModules, hasCompletedSetup } = get();
      const config: ModuleConfig = {
        version: MODULE_CONFIG_VERSION,
        enabledModules: Array.from(enabledModules),
        hasCompletedSetup,
      };

      const dataDir = await appDataDir();
      const configPath = await join(dataDir, 'modules.json');
      await invoke('save_preset', {
        path: configPath,
        data: JSON.stringify(config, null, 2),
      });
    } catch (err) {
      console.error('Failed to save module config:', err);
    }
  },
}));
