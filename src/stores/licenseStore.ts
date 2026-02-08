import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface LicenseInfo {
  is_valid: boolean;
  tier: string;
  features: string[];
}

interface LicenseState {
  license: LicenseInfo;
  isLoading: boolean;
  error: string | null;
  dialogOpen: boolean;

  loadLicense: () => Promise<void>;
  validateKey: (key: string) => Promise<boolean>;
  clearLicense: () => Promise<void>;
  setDialogOpen: (open: boolean) => void;
  hasFeature: (feature: string) => boolean;
}

const FREE_LICENSE: LicenseInfo = { is_valid: false, tier: 'free', features: [] };

// Check if running inside Tauri
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

export const useLicenseStore = create<LicenseState>((set, get) => ({
  license: FREE_LICENSE,
  isLoading: false,
  error: null,
  dialogOpen: false,

  loadLicense: async () => {
    if (!isTauri) return;
    try {
      const info = await invoke<LicenseInfo>('get_license_status');
      set({ license: info });
    } catch {
      set({ license: FREE_LICENSE });
    }
  },

  validateKey: async (key: string) => {
    if (!isTauri) return false;
    set({ isLoading: true, error: null });
    try {
      const info = await invoke<LicenseInfo>('validate_license', { key });
      set({ license: info, isLoading: false });
      if (!info.is_valid) {
        set({ error: '授權碼無效，請確認格式正確' });
      }
      return info.is_valid;
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      return false;
    }
  },

  clearLicense: async () => {
    if (!isTauri) return;
    try {
      await invoke('clear_license');
      set({ license: FREE_LICENSE });
    } catch {
      // ignore
    }
  },

  setDialogOpen: (open) => set({ dialogOpen: open, error: null }),

  hasFeature: (feature: string) => {
    return get().license.features.includes(feature);
  },
}));
