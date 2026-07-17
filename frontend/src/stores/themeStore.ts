import { create } from 'zustand';

/**
 * 테마 스토어 (Zustand — 진짜 전역, 프론트 CLAUDE.md [4]).
 * U-021 라이트 커머스 정본 — 기본 'light' 고정. 전환은 document root `data-theme` 토글 1회(U-005).
 * 다크 값 오버라이드(index.css [data-theme="dark"])는 U-005에서 확정 — 그 전까지 라이트만 렌더된다.
 * setTheme/toggleTheme·'dark' 타입은 U-005 부활 자리로 보존한다(현재 ThemeToggle는 숨김).
 */
export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** 초기 테마: U-005(다크값) 확정 전까지 라이트 고정 — 항상 라이트 렌더와 일치. */
function getInitialTheme(): Theme {
  return 'light';
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
