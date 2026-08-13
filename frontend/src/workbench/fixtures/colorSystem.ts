import type { SemanticTokenOverrides } from '../types'

export interface ColorPaletteFixture {
    id: string
    rank: number
    name: string
    label: string
    note: string
    experiment?: boolean
    overrides: SemanticTokenOverrides
}

export const COLOR_PALETTES = [
    palette(
        'fc-palette-cobalt',
        1,
        '선명한 코발트',
        '가장 추천',
        '#1957B8',
        '#123B78',
        '#F2B134',
        '거래 신뢰와 실시간 서비스의 속도감을 균형 있게 전달합니다.',
    ),
    palette(
        'fc-palette-navy-orange',
        2,
        '브라이트 네이비 + 오렌지',
        '안전한 전환',
        '#24507F',
        '#183858',
        '#EF8A2C',
        '기존 인지 자산을 지키면서 탁한 인상을 줄인 전환 비용이 낮은 안입니다.',
    ),
    palette(
        'fc-palette-teal',
        3,
        '클린 틸',
        '추천',
        '#0B6B66',
        '#074A47',
        '#F2B84B',
        '산뜻한 디지털 감각과 금융·거래 맥락의 안정감을 함께 유지합니다.',
    ),
    palette(
        'fc-palette-royal',
        4,
        '로열 블루',
        '검토',
        '#3C4DB7',
        '#29347F',
        '#74C6D7',
        '게임 서비스의 개성이 강하고 선택 상태가 또렷한 안입니다.',
    ),
    palette(
        'fc-palette-slate',
        5,
        '슬레이트 + 앰버',
        '검토',
        '#46586D',
        '#2E3B4A',
        '#E4A72A',
        '차분한 상거래 인상과 현재 골드 자산의 연결을 유지합니다.',
    ),
    palette(
        'fc-palette-emerald',
        6,
        '에메랄드',
        '검토',
        '#176B45',
        '#0F4930',
        '#E8B64B',
        '안전과 완료의 인상이 강하지만 승인 상태색과의 분리가 필요합니다.',
    ),
    palette(
        'fc-palette-burgundy',
        7,
        '버건디',
        '개성안',
        '#8A3145',
        '#5C2030',
        '#E8B85A',
        '프리미엄과 경매의 긴장감이 강해 위험 상태색과의 구분이 중요합니다.',
    ),
    palette(
        'fc-palette-terracotta',
        8,
        '테라코타',
        '개성안',
        '#97462F',
        '#693221',
        '#F0BA71',
        '기존 오렌지의 활력을 성숙하게 확장한 따뜻한 안입니다.',
    ),
    palette(
        'fc-palette-indigo',
        9,
        '인디고',
        '주의',
        '#4B4BA8',
        '#343475',
        '#FFB45A',
        '현 정본의 퍼플 금지 경계와 가까워 브랜드 합의가 선행돼야 합니다.',
    ),
    palette(
        'fc-palette-plum',
        10,
        '플럼',
        '실험 · 비추천',
        '#744264',
        '#4E2D46',
        '#E9A7C7',
        '퍼플 브랜드 역할 금지와 충돌하는 비교 전용 실험안입니다.',
        true,
    ),
] as const satisfies readonly ColorPaletteFixture[]

function palette(
    id: string,
    rank: number,
    name: string,
    label: string,
    brand: string,
    strong: string,
    focus: string,
    note: string,
    experiment = false,
): ColorPaletteFixture {
    return {
        id,
        rank,
        name,
        label,
        note,
        experiment,
        overrides: {
            '--chrome-bg': brand,
            '--chrome-bg-strong': strong,
            '--chrome-bg-raised': strong,
            '--chrome-bg-selected': brand,
            '--control-action': brand,
            '--control-action-hover': strong,
            '--control-action-ink': '#FFFFFF',
            '--control-focus': focus,
        },
    }
}
