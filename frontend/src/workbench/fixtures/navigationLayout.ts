import { NAVIGATION_LAYOUT_VARIANTS } from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

export const NAVIGATION_LAYOUT_OPTIONS = [
    {
        id: NAVIGATION_LAYOUT_VARIANTS.contactDock,
        name: '접점 고정형',
        label: '선택안 · 상태 변화 최소',
        summary:
            '내비게이션이 일반 문서 흐름을 따라 이동하다 콘텐츠 경계가 화면 상단에 닿는 순간 그대로 고정됩니다.',
        tradeoff:
            '가장 예측 가능하고 조용하지만 도킹 상태를 별도 장식으로 강조하지 않습니다.',
        recommended: true,
    },
    {
        id: NAVIGATION_LAYOUT_VARIANTS.transitionDock,
        name: '도킹 전환형',
        label: '접점 · 표면 전환',
        summary:
            '고정되는 순간에만 모서리와 절제된 음영을 더해 현재 도킹 상태를 분명하게 알립니다.',
        tradeoff:
            '상태 인지는 빠르지만 접점 고정형보다 시각 변화가 한 단계 더 큽니다.',
        recommended: false,
    },
    {
        id: NAVIGATION_LAYOUT_VARIANTS.compactDock,
        name: '컴팩트 도킹형',
        label: '접점 · 높이 축소',
        summary:
            '고정되는 순간 보조 정보와 상단 바 높이를 줄이되 실제 주요 메뉴와 필수 조작은 유지합니다.',
        tradeoff:
            '콘텐츠 공간은 넓어지지만 상단 정보 밀도가 스크롤 상태에 따라 달라집니다.',
        recommended: false,
    },
    {
        id: NAVIGATION_LAYOUT_VARIANTS.directionDock,
        name: '방향 반응형',
        label: '하향 축소 · 상향 복귀',
        summary:
            '아래로 읽을 때는 최소화하고 위로 되돌아갈 때 즉시 복귀해 탐색과 콘텐츠 집중을 함께 지원합니다.',
        tradeoff:
            '방향에 반응하므로 네 안 중 동작 규칙을 사용자가 가장 많이 학습해야 합니다.',
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
