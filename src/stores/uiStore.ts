import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  xs:   '10px',
  sm:   '12px',
  md:   '14px',
  lg:   '16px',
  xl:   '19px',
  xxl:  '22px',
  xxxl: '24px',
};

interface UIStore {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  applyFontSize: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      fontSize: 'lg',
      setFontSize: (size) => {
        set({ fontSize: size });
        document.documentElement.style.fontSize = FONT_SIZE_MAP[size];
      },
      applyFontSize: () => {
        document.documentElement.style.fontSize = FONT_SIZE_MAP[get().fontSize];
      },
    }),
    { name: 'ui-settings' },
  ),
);

export { FONT_SIZE_MAP };
