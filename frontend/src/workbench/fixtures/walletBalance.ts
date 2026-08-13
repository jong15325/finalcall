import type { BalanceResponse } from '@/lib/api/balance'
import {
    WALLET_BALANCE_VARIANTS,
    type WalletBalanceVariantId,
} from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

export type WalletPreviewState = 'ready' | 'loading' | 'error'

export interface WalletBalanceOption {
    id: WalletBalanceVariantId
    name: string
    shortName: string
    reference: string
    recommendation: string
    tradeoff: string
    fontSpec: string
}

export interface WalletBalanceFixture extends WorkbenchFixture {
    balances: {
        standard: BalanceResponse
        longSafeInteger: BalanceResponse
    }
    options: readonly WalletBalanceOption[]
}

const standardBalance = {
    gameMoneyBalance: 1_520_000,
    gameMoneyAvailable: 1_240_000,
    gameMoneyHeld: 280_000,
    cashBalance: 50_000,
} satisfies BalanceResponse

const longSafeIntegerBalance = {
    gameMoneyBalance: 9_007_199_254_740_000,
    gameMoneyAvailable: 8_607_199_254_740_000,
    gameMoneyHeld: 400_000_000_000_000,
    cashBalance: 7_777_777_777_777,
} satisfies BalanceResponse

export const WALLET_BALANCE_OPTIONS = [
    {
        id: WALLET_BALANCE_VARIANTS.availableFirst,
        name: '가용액 중심형',
        shortName: '가용액 중심',
        reference: 'Revolut 참고',
        recommendation:
            '지금 바로 쓸 수 있는 금액을 첫 시선에서 인지하기 가장 쉽습니다.',
        tradeoff:
            '큰 가용액에 시선이 집중되어 총액과 보류액 비교는 두 번째 단계가 됩니다.',
        fontSpec: '가용액 32px · 보조 지표 20px · 라벨 12px',
    },
    {
        id: WALLET_BALANCE_VARIANTS.balanceStatement,
        name: '잔액 요약 보고서형',
        shortName: '요약 보고서',
        reference: 'Stripe 참고',
        recommendation:
            '총 보유액이 가용액과 보류액으로 구성되는 관계를 가장 명확하게 설명합니다.',
        tradeoff:
            '보고서형 행 구조는 정확하지만 마이페이지의 빠른 스캔에서는 조금 밀도 높게 느껴질 수 있습니다.',
        fontSpec: '총액 24px · statement 값 16px · 라벨 12px',
    },
    {
        id: WALLET_BALANCE_VARIANTS.splitAssets,
        name: '게임머니·캐시 분할형',
        shortName: '자산 분할',
        reference: 'Wise 참고',
        recommendation:
            '용도가 다른 게임머니와 캐시를 별도 자산으로 보여 교환 행동의 맥락이 명확합니다.',
        tradeoff:
            '자산 두 종을 나란히 보여 모바일에서는 세로로 재배치되고 카드 높이가 늘어납니다.',
        fontSpec: '주 자산 24px · 보조 자산 20px · 라벨 12px',
    },
    {
        id: WALLET_BALANCE_VARIANTS.mobileWallet,
        name: '모바일 월렛형',
        shortName: '모바일 월렛',
        reference: 'PayPal 참고',
        recommendation:
            '가용액 다음에 행동과 상세를 순서대로 배치해 390px 한 손 스캔에 유리합니다.',
        tradeoff:
            '데스크톱에서도 세로 흐름을 유지해 넓은 공간 활용도는 낮습니다.',
        fontSpec: '가용액 32px · 상세 값 16px · 라벨 12px',
    },
    {
        id: WALLET_BALANCE_VARIANTS.balancedMetrics,
        name: 'FinalCall 균형 지표형',
        shortName: '균형 지표',
        reference: 'FinalCall 권장',
        recommendation:
            '가용액을 분명히 우선하면서도 총액·보류액·캐시를 같은 무게로 비교해 현재 제품 정보 밀도와 가장 잘 맞습니다.',
        tradeoff:
            '강한 히어로 표현보다 절제되어 잔액 증가 같은 감성적 강조는 작습니다.',
        fontSpec: '가용액 28px · 보조 지표 20px · 라벨 12px',
    },
] as const satisfies readonly WalletBalanceOption[]

export const walletBalanceFixture = {
    balances: {
        standard: standardBalance,
        longSafeInteger: longSafeIntegerBalance,
    },
    options: WALLET_BALANCE_OPTIONS,
    shellState: {
        authSession: {
            accessToken: 'workbench-wallet-access-token',
            refreshToken: 'workbench-wallet-refresh-token',
            accessExpiresAt: '2099-01-01T00:00:00Z',
            user: {
                userPublicId: 'workbench-wallet-user',
                nickname: '지갑 미리보기',
                isAdmin: false,
            },
        },
        balance: standardBalance,
        unreadMemoCount: 2,
    },
} satisfies WalletBalanceFixture
