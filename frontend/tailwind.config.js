/**
 * FinalCall Tailwind 토큰 매핑.
 * 정본: docs/ux/design-system.md [2.6] Tailwind+CSS 드롭인(라이트 커머스 U-021). 토큰명 1:1, 값 복제 금지 —
 * 정본이 바뀌면 여기가 따라간다. DESIGN.md(루트 시드) 값과 대조 완료.
 * - 테마 무관(ink·primary·on-accent-fg·semantic·element·element-soft·surface-slot·social): 정적값.
 * - 테마 의존(bg·surface·surface-sunken·border·text·focus-ring): CSS 변수 참조(var()) → src/index.css.
 * U-021 라이트 커머스 확정(2026-07-17). CTA=블랙(ink), 퍼플=액센트만(버튼 채움 아님).
 * U-016·U-020 남색 게임스킨은 SUPERSEDED. 등급(grade) 토큰은 만들지 않는다(D-073).
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 조작 계층 — CTA 블랙 + 퍼플 액센트(테마 무관 정적값). design-system [1.2]① [2.2]
        // 주 CTA = ink 블랙 채움. 퍼플(primary)은 링크·포커스·선택 액센트만(채움 아님).
        ink: '#18181B',
        primary: {
          DEFAULT: '#6E2A9F',
          hover: '#5C2185',
          pressed: '#491A6C',
          selected: '#F1EAF5',
          soft: '#F1EAF5',
          disabled: '#E4E4E7',
          fg: '#FFFFFF', // 정적값 — ink·primary 위 전경. 테마 무관
        },
        'on-accent-fg': '#18181B', // element 칩 라벨 등 잔존 용도(near-black)

        // 정보 계층 — 의미색(-soft 는 8% 알파 합성, 별도 토큰 없음). design-system [2.3]
        success: '#14742F',
        warning: '#A0510A',
        danger: '#C81E1E',
        info: '#1D4ED8',

        // 아이템 계층 — 아트 픽셀 실측(변경 금지) + 라이트용 소프트 틴트. design-system [2.7]
        // element 칩은 소프트 틴트 위에만 놓는다 — 흰 배경 위 텍스트 직접·퍼플 위 배치 금지([1.2] Containment)
        element: {
          water: '#19B2FF',
          fire: '#FF5500',
          earth: '#95B259',
          wind: '#66CCCC',
        },
        'element-soft': {
          water: '#DDF3FF',
          fire: '#FFE6D9',
          earth: '#EFF3E6',
          wind: '#E8F7F7',
        },

        // 소셜 로그인 — 외부 브랜드 규격(팔레트 예외, 재색 금지). design-system [2.8]
        kakao: '#FEE500',
        naver: '#03C75A',

        // 표면·텍스트 — CSS 변수 참조(src/index.css). design-system [2.6]
        // :root = 라이트 기본. [data-theme="dark"] 다크값은 U-005 확정 시 얹는다(지금 미창작)
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-sunken': 'var(--color-surface-sunken)',
        'surface-slot': '#000000',
        border: 'var(--color-border)',
        'border-muted': 'var(--color-border-muted)',
        'border-strong': 'var(--color-border-strong)',
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
        // design-system [4] 반경(무신사식 각진 감성으로 낮춤 — U-021)
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        // design-system [4] 그림자 (라이트 지배값 — 그림자가 실제 부양(elevation)에 쓰인다)
        sm: '0 1px 3px rgba(15,23,42,.06)',
        md: '0 4px 12px rgba(15,23,42,.08), 0 1px 3px rgba(15,23,42,.06)',
        lg: '0 8px 24px rgba(15,23,42,.10)',
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
