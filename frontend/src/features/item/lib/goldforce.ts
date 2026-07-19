/**
 * 골드포스 활성 판정 (FC-058 재작업).
 *
 * 계약 §3.3: 서버는 `goldforceExpireAt`(만료 시각) **하나만** 내린다 —
 * "활성 여부·잔여는 클라 파생"이라고 명시돼 있다. 그 파생이 여기다.
 *
 * ★ `null` 은 "미적용"이고, 과거 시각은 "만료"다. **둘 다 비활성이지만 같은 것이 아니다** —
 *   만료는 한때 있었다는 뜻이라 상세 화면이 다르게 말할 수 있다. 지금 홈은 활성 여부만 쓰지만
 *   판정 함수를 나눠 둬서 나중에 구분이 필요할 때 되돌아오지 않게 한다.
 */

export type GoldforceState = 'active' | 'expired' | 'none'

export function goldforceStateOf(
    goldforceExpireAt: string | null | undefined,
    now: number,
): GoldforceState {
    if (!goldforceExpireAt) return 'none'

    const expireAt = Date.parse(goldforceExpireAt)
    // 파싱 불가는 '없음'으로 흘린다 — 값 하나가 카드를 깨뜨리지 않는다.
    if (!Number.isFinite(expireAt)) return 'none'

    return expireAt > now ? 'active' : 'expired'
}

export function isGoldforceActive(
    goldforceExpireAt: string | null | undefined,
    now: number,
): boolean {
    return goldforceStateOf(goldforceExpireAt, now) === 'active'
}
