/**
 * FinalCall Tailwind 토큰 매핑.
 * 정본: docs/ux/design-system.md [2]~[4]. 토큰명 1:1, 값 복제 금지 — 정본이 바뀌면 여기가 따라간다.
 * - 테마 무관(primary·on-accent-fg·semantic·element·surface-slot): 정적값.
 * - 테마 의존(bg·surface·border·text·focus-ring): CSS 변수 참조(var()) → src/index.css.
 * U-020 확정 팔레트 반영(2026-07-16, ux/017 [4] 드롭인 + ux/019 + ux/020 보정).
 * 폐기: primary 6단 스케일(50~700) · accent(500·600) · 의미색 -soft/-strong — design-system [2.6].
 * 등급(grade) 토큰은 만들지 않는다(D-073).
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 조작 계층 — 게임 상태 언어(테마 무관 정적값). design-system [1.2]① [2.2]
        // 상태는 명도가 아니라 hue 전환이다: 기본 파랑 → 눌림 주황 → 활성 황금.
        primary: {
          DEFAULT: '#0667BD',
          hover: '#0560AD',
          pressed: '#E25706',
          selected: '#E2B206',
          disabled: '#0A3A63',
          fg: '#FAF7D5', // 정적값 — 파랑 위의 전경. 테마 무관(019 안건2). text 와 hex 가 같아도 다른 토큰이다
        },
        'on-accent-fg': '#001C33', // 밝은 계열(pressed·selected·warning) 위의 전경

        // 정보 계층 — 의미색(-soft 는 12% 알파 합성, 별도 토큰 없음). design-system [2.3]
        success: '#4ADE80',
        warning: '#E2B206',
        danger: '#FF4D4D',
        info: '#3394DE',

        // 아이템 계층 — 아트 픽셀 실측(변경 금지). design-system [2.3]
        // element 칩은 bg 위에만 놓는다 — primary 위에서 water 2.4:1 로 무너진다(ux/017 [5]#1)
        element: {
          water: '#19B2FF',
          fire: '#FF5500',
          earth: '#95B259',
          wind: '#66CCCC',
        },

        // 표면·텍스트 — CSS 변수 참조(src/index.css). design-system [2.4]
        // 라이트 값은 0개다. U-005 확정 시 [data-theme="light"] 블록을 얹어 덮는다(ux/020 [2])
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-slot': '#000000',
        border: 'var(--color-border)',
        'border-muted': 'var(--color-border-muted)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-subtle': 'var(--color-text-subtle)',
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
