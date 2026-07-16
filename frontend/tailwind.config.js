/**
 * FinalCall Tailwind 토큰 매핑.
 * 정본: docs/ux/design-system.md [2]~[4] (토큰 정본). 토큰명 1:1, 색값은 잠정 A안.
 * - 테마 무관(primary·accent·semantic·element): 정적값.
 * - 테마 의존(bg·surface·border·text ...): CSS 변수 참조(var()) → src/index.css 의 :root / [data-theme="dark"] 에서 값 오버라이드.
 * 비주얼 확정 시 값만 교체하고 토큰명·구조는 불변으로 유지한다(skeleton-plan [4]).
 * 등급(grade) 토큰은 만들지 않는다(D-073).
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 테마 무관 — design-system [2.1][2.2][2.3]
        primary: {
          50: '#EEF0FF',
          100: '#E0E3FF',
          300: '#A5AEFF',
          500: '#6366F1',
          600: '#4F52D6',
          700: '#3E40AD',
          fg: 'var(--color-primary-fg)',
          DEFAULT: '#6366F1',
        },
        accent: {
          500: '#F59E0B',
          600: '#D97706',
          DEFAULT: '#F59E0B',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        info: '#2563EB',
        element: {
          water: '#3B82F6',
          fire: '#EF4444',
          earth: '#D97706',
          wind: '#10B981',
        },
        // 테마 의존 — design-system [2.4], 값은 CSS 변수(src/index.css)
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        'focus-ring': 'var(--color-focus-ring)',
      },
      fontFamily: {
        // design-system [3]
        sans: ['Pretendard', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        num: ['Pretendard', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        // design-system [4] 반경
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        // design-system [4] 그림자 (라이트 기준값; 다크는 표면 밝기차 우선)
        sm: '0 1px 2px rgba(15,23,42,.06)',
        md: '0 4px 12px rgba(15,23,42,.10)',
        lg: '0 12px 32px rgba(15,23,42,.14)',
      },
      transitionDuration: {
        // design-system [4] 모션
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
