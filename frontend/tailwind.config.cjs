/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */

/*
 * 장터 테마 (FC-067 재구축).
 *
 * ★ 종전 퍼플/블루 팔레트(`--primary: #2a85ff` 계열)를 **전면 제거**하고 브랜드 팔레트
 *   (네이비 #16213a · 골드 · 오렌지 #ef8a2c)로 교체했다. 색상 값 정의는 `src/index.css`
 *   의 `@layer theme` CSS 변수에 있다 — 이 파일은 유틸리티 이름 → 변수 매핑만 담당한다.
 * ★ 빌드 설정(content 글롭 · screens · plugins)은 승계한다(툴체인 무변경).
 */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        fontFamily: {
            sans: [
                'Pretendard',
                'Pretendard Variable',
                '"Noto Sans KR"',
                'ui-sans-serif',
                'system-ui',
                '-apple-system',
                'BlinkMacSystemFont',
                '"Segoe UI"',
                'Roboto',
                '"Helvetica Neue"',
                'Arial',
                'sans-serif',
                '"Apple Color Emoji"',
                '"Segoe UI Emoji"',
            ],
            mono: [
                'ui-monospace',
                'SFMono-Regular',
                'Menlo',
                'Monaco',
                'Consolas',
                '"Liberation Mono"',
                '"Courier New"',
                'monospace',
            ],
        },
        screens: {
            xs: '576px',
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },
        extend: {
            colors: {
                /* 네이비 — 구조(사이드바·헤딩·다크 서피스) */
                navy: {
                    DEFAULT: 'var(--navy)',
                    900: 'var(--navy-900)',
                    800: 'var(--navy-800)',
                    700: 'var(--navy-700)',
                    600: 'var(--navy-600)',
                    500: 'var(--navy-500)',
                },
                /* 골드 — 강조·가격·프레임 */
                gold: {
                    DEFAULT: 'var(--gold)',
                    bright: 'var(--gold-bright)',
                    deep: 'var(--gold-deep)',
                    subtle: 'var(--gold-subtle)',
                },
                /* 오렌지 — 주요 액션(CTA) */
                orange: {
                    DEFAULT: 'var(--orange)',
                    deep: 'var(--orange-deep)',
                    subtle: 'var(--orange-subtle)',
                },
                /* 소셜 로그인 — 외부 브랜드 규격(재색 금지, design-system §2.8) */
                kakao: 'var(--kakao)',
                naver: 'var(--naver)',
                /* 표면·경계 */
                surface: 'var(--surface)',
                'surface-sunken': 'var(--surface-sunken)',
                line: 'var(--line)',
                /* 상태 */
                success: 'var(--success)',
                'success-subtle': 'var(--success-subtle)',
                danger: 'var(--danger)',
                'danger-subtle': 'var(--danger-subtle)',
                warning: 'var(--warning)',
                'warning-subtle': 'var(--warning-subtle)',
                /* 중립 그레이 스케일 */
                'gray-50': 'var(--gray-50)',
                'gray-100': 'var(--gray-100)',
                'gray-200': 'var(--gray-200)',
                'gray-300': 'var(--gray-300)',
                'gray-400': 'var(--gray-400)',
                'gray-500': 'var(--gray-500)',
                'gray-600': 'var(--gray-600)',
                'gray-700': 'var(--gray-700)',
                'gray-800': 'var(--gray-800)',
                'gray-900': 'var(--gray-900)',
                'gray-950': 'var(--gray-950)',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
}
