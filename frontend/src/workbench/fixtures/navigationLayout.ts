import { NAVIGATION_LAYOUT_VARIANTS } from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

export const NAVIGATION_LAYOUT_OPTIONS = [
    {
        id: NAVIGATION_LAYOUT_VARIANTS.restrained,
        name: '절제형',
        label: '8px · 평면',
        summary:
            '작은 여백 안에 상단 바와 메뉴 바를 한 덩어리로 묶어 기존 화면의 밀도를 가장 가깝게 유지합니다.',
        tradeoff:
            '변화가 조용해 새 레이아웃의 존재감은 세 안 중 가장 낮습니다.',
        recommended: false,
    },
    {
        id: NAVIGATION_LAYOUT_VARIANTS.balanced,
        name: '균형형',
        label: '12px · 절제된 음영',
        summary:
            '푸터 콘텐츠와 같은 폭에 맞춘 연속형 내비게이션 영역으로, 여백과 정보 밀도의 균형이 가장 안정적입니다.',
        tradeoff:
            '절제형보다 상단 점유가 조금 늘지만 메뉴 탐색 흐름은 그대로 유지합니다.',
        recommended: true,
    },
    {
        id: NAVIGATION_LAYOUT_VARIANTS.floating,
        name: '플로팅형',
        label: '16px · 분리형 입체감',
        summary:
            '상단 정보 바와 메뉴 바를 두 영역으로 분리해 구조와 현재 위치를 가장 강하게 드러냅니다.',
        tradeoff:
            '존재감과 상단 점유가 커서 콘텐츠 중심 화면에서는 다소 무겁게 느껴질 수 있습니다.',
        recommended: false,
    },
] as const

export interface NavigationLayoutFixture extends WorkbenchFixture {
    layouts: typeof NAVIGATION_LAYOUT_OPTIONS
}

export const navigationLayoutFixture = {
    layouts: NAVIGATION_LAYOUT_OPTIONS,
    shellState: {
        authSession: {
            accessToken: 'workbench-navigation-access-token',
            refreshToken: 'workbench-navigation-refresh-token',
            accessExpiresAt: '2099-01-01T00:00:00Z',
            user: {
                userPublicId: 'workbench-navigation-user',
                nickname: '네비게이션 검토자',
                isAdmin: false,
            },
        },
        balance: {
            gameMoneyBalance: 1_520_000,
            gameMoneyAvailable: 1_240_000,
            gameMoneyHeld: 280_000,
            cashBalance: 50_000,
        },
        unreadMemoCount: 3,
    },
} satisfies NavigationLayoutFixture
