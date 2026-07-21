/**
 * 아이템 프레임 파생 (FC-068 — rebuild-contract-map §2.2·§6.3 인코딩).
 *
 * ★ **계약이 데이터를 뒷받침하는 프레임은 골드포스뿐이다**(`goldforceExpireAt`). 목업 프레임
 *   6종(골드포스>실버포스>펫>아바타>이벤트>일반/블랙) 중 실버포스·펫·아바타·이벤트는 계약에
 *   데이터가 없어 **전부 STANDARD 폴백**한다(§2.2). 목업 §7 `frameType` 을 그대로 믿으면
 *   undefined 프레임을 렌더한다 — 그래서 우선순위를 **여기 한 곳**에서 해소한다.
 * ★ 골드포스 잔여일은 **클라 파생**이다(서버는 만료 시각만 내린다, §2.2). 보존 `goldforce.ts` 의
 *   활성 판정을 재사용하고, 여기서는 표시용 잔여일(1~999·3자리)만 파생한다.
 */
import { isGoldforceActive } from '@/features/item/lib/goldforce'

/** 계약 데이터로 실제 렌더 가능한 프레임은 이 둘뿐이다(나머지는 STANDARD 폴백). */
export type FrameType = 'GOLDFORCE' | 'STANDARD'

/** 프레임 파생에 필요한 최소 입력(item 블록 전체를 요구하지 않아 테스트가 가볍다). */
export interface ItemFrameVisual {
    /** 골드포스 만료 시각(ISO-8601 UTC). 미적용이면 null. 활성 여부는 클라 파생 */
    goldforceExpireAt?: string | null
}

/** 표시 잔여일 하한/상한(§6.3 — 3자리 `001`~`999`). */
export const GOLDFORCE_DAYS_MIN = 1
export const GOLDFORCE_DAYS_MAX = 999

const DAY_MS = 86_400_000

/**
 * 프레임 종류 해소. **우선순위: 골드포스 > 실버포스 > 펫 > 아바타 > 이벤트 > 일반/블랙.**
 * 계약이 뒷받침하는 것은 골드포스뿐이라, 실질 분기는 `골드포스 활성 ? GOLDFORCE : STANDARD` 다.
 * 나머지 프레임은 데이터가 오지 않으므로 **결코 선택되지 않고 STANDARD 로 흐른다**(§2.2 폴백 의무).
 */
export function resolveFrameType(
    visual: ItemFrameVisual | null | undefined,
    now: number,
): FrameType {
    if (isGoldforceActive(visual?.goldforceExpireAt, now)) return 'GOLDFORCE'
    return 'STANDARD'
}

/**
 * 골드포스 표시 잔여일. **비활성(미적용·만료)이면 null** — 슬롯을 렌더하지 않는다.
 * 활성이면 `ceil((만료−now)/1일)` 을 1~999 로 보정한다(부분일도 최소 1일로 보인다).
 */
export function goldforceRemainingDays(
    goldforceExpireAt: string | null | undefined,
    now: number,
): number | null {
    if (!isGoldforceActive(goldforceExpireAt, now)) return null

    // isGoldforceActive 가 true 면 파싱 가능·미래 시각이 보장된다.
    const expireAt = Date.parse(goldforceExpireAt as string)
    const days = Math.ceil((expireAt - now) / DAY_MS)
    return Math.min(GOLDFORCE_DAYS_MAX, Math.max(GOLDFORCE_DAYS_MIN, days))
}

/** 잔여일 3자리 표기(`1`→`001`, `999`→`999`). 시각용 — 접근성엔 원문 일수를 쓴다. */
export function formatGoldforceDays(days: number): string {
    return String(days).padStart(3, '0')
}
