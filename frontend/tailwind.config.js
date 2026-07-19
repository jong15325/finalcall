/**
 * FinalCall Tailwind 토큰 매핑.
 * 정본: docs/ux/design-system.md v0.6.1 — 색은 [2.6] Tailwind+CSS 드롭인, 활자는 [3.2]·[3.4].
 * [2.6]이 "프론트가 소비하는 유일한 핸드오프 표면이며 정의 절과 어긋나면 여기가 정본"이라 규정한다.
 * 토큰명 1:1, 값 복제 금지 — 정본이 바뀌면 여기가 따라간다.
 * - 테마 무관(ink·primary·on-accent-fg·semantic·element·element-soft·glow·gf·social): 정적값.
 * - 테마 의존(bg·surface·surface-band·surface-sunken·border·text·focus-ring): CSS 변수 참조(var()) → src/index.css.
 * U-021 라이트 커머스 확정(2026-07-17). CTA=블랙(ink), 퍼플=액센트만(버튼 채움 아님).
 * U-016·U-020 남색 게임스킨은 SUPERSEDED. 등급(grade) 토큰은 만들지 않는다(D-073).
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    /*
     * ★ extend 가 아니라 **교체**다(design-system [3.2]).
     * 종전 7단(text-xs~text-3xl)은 "값을 더한 게 아니라 다시 도출"되어 **전량 폐기**됐다.
     * Tailwind 기본 스케일을 남겨 두면 폐기된 `text-sm`·`text-base` 가 계속 컴파일되어
     * 새 화면이 조용히 옛 축으로 되돌아간다 — 스케일 자체를 갈아 끼워 구조적으로 막는다.
     *
     * size/line/weight/tracking 을 배열로 함께 등재하는 것도 [3.4]의 요구다("크기만 빌려 쓰는 것을
     * 구조적으로 막는다"). 굵기가 범위인 단계(micro 400~700 · body 400~500 · value 600~800)는
     * **하한을 기본값**으로 굽고, 그 범위 안에서 올릴 때만 사용처가 font-* 유틸로 덮는다.
     *
     * ★ 자간이 반대 방향인 것이 이 스케일의 핵심이다([3.1] 원칙 2) — 라벨은 작고 넓게(+0.12em),
     *   값·제목은 크고 좁게(−0.02~−0.04em). 크기 차이만으로는 두 층이 갈리지 않는다.
     */
    fontSize: {
      // 눈썹 라벨 · 폼 필드 라벨 · 표 헤더 · 캡션 · 구분선 · 상태 배지
      label: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.12em', fontWeight: '700' }],
      // 각주 · 푸터 · 메타 · 법적 고지
      micro: ['0.75rem', { lineHeight: '1.6', letterSpacing: '0em', fontWeight: '400' }],
      // 본문 · 힌트 · 에러 메시지 · 설명문 · 표 본문 · 보조 버튼 라벨
      body: ['0.8125rem', { lineHeight: '1.7', letterSpacing: '0em', fontWeight: '400' }],
      // 입력값 · 금액 기본 · 스펙 값 · 섹션 제목 · 다이얼로그 제목 · 주 CTA
      value: ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '600' }],
      // 수치 승격 — 마감 임박(주의 구간) 카운트다운. **수치 전용**(제목이 빌려 쓰지 않는다)
      figure: ['1.75rem', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
      // 페이지 제목 — 화면당 1개
      title: ['2.125rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '800' }],
      // 수치 최고 승격 — 임박 카운트다운 · 상세 현재가. 화면당 1개
      'figure-xl': ['2.75rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '800' }],
      /*
       * 스케일 예외 1건 — 워드마크 22px([3.3]). **브랜드 자산이지 활자 단계가 아니다.**
       * 홈·인증·경매 전 화면에서 동일 수치를 유지해야 하므로(흔들리면 셸이 다른 제품처럼 읽힌다)
       * 사용처마다 임의값을 흩뿌리지 않고 여기 단일 출처로 둔다. 워드마크 밖에서 쓰지 않는다.
       */
      wordmark: ['1.375rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
    },
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

        /*
         * 아트 슬롯 딥 글로우 (v0.5 — 종전 `surface-slot` #000000 폐기). design-system [2.1]·[2.7]
         * 폐기 근거: "아트가 검정 전제로 그려졌다"가 유지 이유였으나, 아트는 알파 없는 불투명 이미지이고
         * 자체 배경색을 갖는다(물 #0CB0FF·불 #901701). 전제가 성립하지 않아 검정을 고수할 이유가 사라졌다.
         * 코어 L18% S61% / 엣지 L11% — 채도 상한은 골드포스 링([5.12])이 코어와 맞닿기 때문에 정해졌다.
         * 실제 그라데이션 합성은 src/index.css 의 .slot-glow-* 유틸이 한다.
         *
         * ★ earth(3)·wind(4) 파생(FC-049) — **창작이 아니라 정본이 남긴 공식의 적용이다.**
         * [2.7]은 물·불만 값을 두고 "**3·4가 확정되면 같은 방식(L18% S61% 코어 / L11% 엣지)으로
         * 파생한다**"고 조건부 지시를 남겼다. 계약 v1.10 §3.3.1 이 element 1~4를 전건 확정해
         * 그 조건이 충족됐고, FC-042 목업이 아트 실측 hue로 공식을 적용한 값이 아래다.
         *   earth: 아트 hue 79.5°(#95B259) → HSL(79.5,61%,18%)=#384A12 / L11.4%=#24300A
         *   wind : 아트 hue 180° (#66CCCC) → HSL(180,61%,18%)=#124A4A / L11.4%=#0B2F2F
         * 밝은 금(#DFC345) 대비: earth 코어 5.58·엣지 8.01 / wind 코어 5.72·엣지 8.23 → 전건 AA.
         */
        'glow-water-core': '#12384A',
        'glow-water-edge': '#0A2430',
        'glow-fire-core': '#4A2412',
        'glow-fire-edge': '#301A0A',
        'glow-earth-core': '#384A12',
        'glow-earth-edge': '#24300A',
        'glow-wind-core': '#124A4A',
        'glow-wind-edge': '#0B2F2F',
        'glow-neutral-core': '#26262B',
        'glow-neutral-edge': '#131316',

        /*
         * 골드포스 아웃라인 (v0.5). design-system [5.12] — 아이템 카드 아트 프레임 전용.
         * gf-1~6 = 바깥 밝은 금 1px 겹의 길이 방향 그라데이션, gf-bev-* = 안쪽 어두운 금 베벨(좌·상·우·하).
         * 아트 프레임 밖(카드 테두리·버튼·헤더)에 쓰지 않는다.
         */
        'gf-1': '#B9840F',
        'gf-2': '#D0AD31',
        'gf-3': '#DFC447',
        'gf-4': '#F0E163',
        'gf-5': '#FCF474',
        'gf-6': '#FFFF83',
        'gf-bev-1': '#7A5A00',
        'gf-bev-2': '#8B6100',
        'gf-bev-3': '#99770C',
        'gf-bev-4': '#A98A14',

        // 소셜 로그인 — 외부 브랜드 규격(팔레트 예외, 재색 금지). design-system [2.8]
        kakao: '#FEE500',
        naver: '#03C75A',

        // 표면·텍스트 — CSS 변수 참조(src/index.css). design-system [2.6]
        // :root = 라이트 기본. [data-theme="dark"] 다크값은 U-005 확정 시 얹는다(지금 미창작)
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-band': 'var(--color-surface-band)', // v0.4 신설 — 섹션 전체 폭 밴드
        'surface-sunken': 'var(--color-surface-sunken)',
        border: 'var(--color-border)',
        'border-muted': 'var(--color-border-muted)',
        'border-strong': 'var(--color-border-strong)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-subtle': 'var(--color-text-subtle)',
        'text-disabled': 'var(--color-text-disabled)', // v0.6.1 신설 — 비활성 채움 위 라벨([2.4] 경계 주의)
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
