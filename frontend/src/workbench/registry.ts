import { auctionDetailPath, paths } from '@/app/paths'
import {
    COLOR_PALETTE_VARIANT_IDS,
    FIRE_PARTICLE_VARIANT_IDS,
    NAVIGATION_LAYOUT_VARIANT_IDS,
    WALLET_BALANCE_VARIANT_IDS,
    WIND_PARTICLE_VARIANT_IDS,
    WATER_PARTICLE_VARIANT_IDS,
} from './scenarioMetadata'
import type { WorkbenchFixture, WorkbenchScenarioDefinition } from './types'
import { SELL_STUDY_VARIANTS } from './candidates/SellPageCandidate'
import { SELL_DIRECTION_VARIANTS } from './candidates/SellPageDirectionCandidate'

function defineScenario(
    definition: WorkbenchScenarioDefinition<WorkbenchFixture>,
) {
    return definition
}

export const WORKBENCH_SCENARIOS = [
    defineScenario({
        id: 'home-market-recommendations',
        title: '홈 오늘의 추천 마켓',
        shell: 'app',
        routeContext: paths.home,
        load: () => import('./scenarios/HomeMarketRecommendationsScenario'),
    }),
    defineScenario({
        id: 'card-info-parity',
        title: '마켓·경매 카드정보 정합',
        shell: 'app',
        routeContext: paths.auctions,
        load: () => import('./scenarios/CardInfoParityScenario'),
    }),
    defineScenario({
        id: 'character-profile',
        title: '기본 캐릭터 프로필 선택',
        shell: 'app',
        routeContext: paths.me,
        load: () => import('./scenarios/CharacterProfileScenario'),
    }),
    defineScenario({
        id: 'chat',
        title: 'Vuexy 채팅 디자인 게이트',
        shell: 'app',
        routeContext: paths.messages,
        load: () => import('./scenarios/ChatScenario'),
    }),
    defineScenario({
        id: 'auction-card',
        title: '경매 목록 세로 카드',
        shell: 'app',
        routeContext: paths.auctions,
        load: () => import('./scenarios/AuctionCardScenario'),
    }),
    defineScenario({
        id: 'auction-countdown-tags',
        title: '경매 시간 표시 12안',
        shell: 'app',
        routeContext: paths.auctions,
        load: () => import('./scenarios/AuctionCountdownTagsScenario'),
    }),
    defineScenario({
        id: 'sell-page-directions',
        title: '판매 등록 신규 디자인 3안',
        shell: 'app',
        routeContext: paths.sell,
        variants: SELL_DIRECTION_VARIANTS,
        load: () => import('./scenarios/SellPageDirectionsScenario'),
    }),
    defineScenario({
        id: 'sell-page-studies',
        title: '판매 등록 페이지 디자인 7안',
        shell: 'app',
        routeContext: paths.sell,
        variants: SELL_STUDY_VARIANTS,
        load: () => import('./scenarios/SellPageStudiesScenario'),
    }),
    defineScenario({
        id: 'main-color-palettes',
        title: '밝고 선명한 메인 컬러 10안',
        shell: 'app',
        routeContext: auctionDetailPath('design-preview'),
        variants: COLOR_PALETTE_VARIANT_IDS,
        load: () => import('./scenarios/ColorSystemScenario'),
    }),
    defineScenario({
        id: 'auth-layout',
        title: '인증 레이아웃',
        shell: 'auth',
        routeContext: paths.login,
        load: () => import('./scenarios/AuthLayoutScenario'),
    }),
    defineScenario({
        id: 'top-navigation-layouts',
        title: '상단 네비게이션 레이아웃 4안',
        shell: 'app',
        routeContext: paths.auctions,
        variants: NAVIGATION_LAYOUT_VARIANT_IDS,
        load: () => import('./scenarios/NavigationLayoutScenario'),
    }),
    defineScenario({
        id: 'wind-particle-studies',
        title: '바람 파티클 렌더링 10안',
        shell: 'app',
        routeContext: paths.home,
        variants: WIND_PARTICLE_VARIANT_IDS,
        load: () => import('./scenarios/WindParticleScenario'),
    }),
    defineScenario({
        id: 'fire-particle-studies',
        title: '불 파티클 렌더링 10안',
        shell: 'app',
        routeContext: paths.home,
        variants: FIRE_PARTICLE_VARIANT_IDS,
        load: () => import('./scenarios/FireParticleScenario'),
    }),
    defineScenario({
        id: 'water-particle-studies',
        title: '물 파티클 렌더링 10안',
        shell: 'app',
        routeContext: paths.home,
        variants: WATER_PARTICLE_VARIANT_IDS,
        load: () => import('./scenarios/WaterParticleScenario'),
    }),
    defineScenario({
        id: 'wallet-balance-studies',
        title: '마이페이지 지갑 잔액 5안',
        shell: 'app',
        routeContext: paths.wallet,
        variants: WALLET_BALANCE_VARIANT_IDS,
        load: () => import('./scenarios/WalletBalanceScenario'),
    }),
    defineScenario({
        id: 'page-actions',
        title: '페이지 행동 버튼 광택 시스템',
        shell: 'app',
        routeContext: paths.market,
        load: () => import('./scenarios/PageActionScenario'),
    }),
] as const

export function findWorkbenchScenario(id: string | undefined) {
    return WORKBENCH_SCENARIOS.find((scenario) => scenario.id === id)
}
