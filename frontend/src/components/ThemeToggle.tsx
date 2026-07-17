import { useThemeStore } from '@/stores/themeStore';

/**
 * 테마 토글 버튼 (U-005 — data-theme 토글 1회). 실제 값 오버라이드는 index.css.
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환'}
      className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text transition-colors duration-fast hover:bg-surface-sunken"
    >
      {theme === 'dark' ? '라이트' : '다크'}
    </button>
  );
}
