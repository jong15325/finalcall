const CODE_TIER_CLASS = [
    'text-amount-code-tier-1',
    'text-amount-code-tier-2',
    'text-amount-code-tier-3',
    'text-amount-code-tier-4',
    'text-amount-code-tier-5',
    'text-amount-code-tier-6',
] as const

/** 코드 금액 구간색의 단일 정본. */
export function codeTierClass(value: number): string {
    if (value < 10_000) return CODE_TIER_CLASS[0]
    if (value < 100_000) return CODE_TIER_CLASS[1]
    if (value < 1_000_000) return CODE_TIER_CLASS[2]
    if (value < 10_000_000) return CODE_TIER_CLASS[3]
    if (value < 100_000_000) return CODE_TIER_CLASS[4]
    return CODE_TIER_CLASS[5]
}
