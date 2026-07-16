import { create } from 'zustand';

/**
 * 테마 스토어 (Zustand — 진짜 전역, 프론트 CLAUDE.md [4]).
 * A안 다크 우선(design-system [1]). 전환은 document root `data-theme` 토글 1회로 끝난다(U-005).
 * 값 오버라이드는 src/index.css 의 [data-theme="dark"] 에서 처리 — 여기서는 토글만.
 */
export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** 초기 테마: 시스템 선호 반영, 미상 시 A안 기본(dark). */
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
