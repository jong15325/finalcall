import { THEME_ENUM } from '@/constants/theme.constant'
import { Direction, Mode, ControlSize, LayoutType } from '@/@types/theme'

export type ThemeConfig = {
    themeSchema: string
    direction: Direction
    mode: Mode
    panelExpand: boolean
    controlSize: ControlSize
    layout: {
        type: LayoutType
        sideNavCollapse: boolean
    }
}

/**
 * Since some configurations need to be match with specific themes,
 * we recommend to use the configuration that generated from demo.
 */
/*
 * ★★ `themeSchema: 'dark'` 는 **다크 모드가 아니라 프리셋 이름**이다(FC-057, 사용자 판정
 *    2026-07-19). 라이트/다크 모드는 바로 아래 `mode` 가 정하며 `MODE_LIGHT` 그대로다.
 *
 *    템플릿 기본 프리셋(`''` = blue)은 `--primary` #2A85FF 가 흰 전경에 대해 얕아
 *    `solid` 버튼이 정지 3.56 · hover 2.96 으로 **AA(4.5) 미달**이었다. 프리셋 5종을 전수
 *    계산한 결과 통과하는 것은 `dark`(#18181B) 하나뿐이다(default 3.56 / green 2.87 /
 *    purple 3.96 / orange 2.77).
 *
 *    ★ 이것은 **토큰 덮어쓰기가 아니라 템플릿이 제공하는 선택지 고르기**다.
 *      `preset-theme-schema.config.ts` 는 템플릿 원본 그대로 두고 값만 참조한다.
 *
 *    ★ 주의 — 이 스토어는 `persist`(localStorage 키 `theme`)라 **이미 앱을 연 적 있는
 *      브라우저에는 이 기본값이 반영되지 않는다.** 확인하려면 해당 키를 지워야 한다.
 */
export const themeConfig: ThemeConfig = {
    themeSchema: 'dark',
    direction: THEME_ENUM.DIR_LTR,
    mode: THEME_ENUM.MODE_LIGHT,
    panelExpand: false,
    controlSize: 'md',
    layout: {
        type: THEME_ENUM.LAYOUT_COLLAPSIBLE_SIDE,
        sideNavCollapse: false,
    },
}
