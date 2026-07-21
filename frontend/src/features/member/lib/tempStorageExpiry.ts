/**
 * 임시보관 만료 임박 파생 (계약 §4.2 — 클라 파생) — FC-076.
 *
 * ★ 서버는 `expireAt`(만료 시각) **하나만** 내린다(§4.2). "임박" 플래그는 내리지 않으므로
 *   여기서 파생한다(`goldforce.ts` 가 잔여일을 파생하는 것과 같은 태도).
 * ★ `null` = 만료 개념 없음(영구 보관). 과거 시각 = 이미 만료. 그 사이가 '임박/여유'다.
 * ★ 임박 임계값은 **24시간**(목업 `.storage-alert` 의 "만료 임박" 경고 기준). 표시 규칙일 뿐
 *   금전·정확성 값이 아니다 — 서버 판정과 무관하다.
 */

export type ExpiryState = 'none' | 'expired' | 'imminent' | 'safe'

/** 만료 임박 임계값(ms) — 24시간. */
export const EXPIRY_IMMINENT_MS = 24 * 60 * 60 * 1000

export function expiryStateOf(
    expireAt: string | null | undefined,
    now: number,
): ExpiryState {
    if (!expireAt) return 'none'

    const ms = Date.parse(expireAt)
    // 파싱 불가는 '없음'으로 흘린다 — 값 하나가 행을 깨뜨리지 않는다.
    if (!Number.isFinite(ms)) return 'none'

    if (ms <= now) return 'expired'
    return ms - now <= EXPIRY_IMMINENT_MS ? 'imminent' : 'safe'
}

/** 남은 시간이 임박·만료 구간이면 경고 대상이다(목록 최상단 alert 노출 판정). */
export function hasImminentExpiry(
    items: readonly { expireAt: string | null }[],
    now: number,
): boolean {
    return items.some((item) => {
        const state = expiryStateOf(item.expireAt, now)
        return state === 'imminent' || state === 'expired'
    })
}
