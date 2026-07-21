/**
 * 경매 등록 폼 — 클라 검증 + 요청 정규화 (계약 §3.1) — FC-073.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **클라 검증은 서버 검증의 사본이 아니라 선행 안내다.** 최종 판정은 서버가 한다
 *    (`AUCTION_003`·`AUCTION_008`). 여기서 막는 이유는 사용자가 제출 왕복 없이 즉시 고치게
 *    하려는 것뿐이다 — 서버 규칙을 흉내 내 재구현하지 않는다(시간 상한·소프트클로즈 상한 등은
 *    서버 몫으로 남긴다).
 *
 * 이 모듈이 고정하는 것:
 *  - **금액은 정수(long)** — 숫자 외 문자를 제거해 지수표기·기호를 원천 차단하고, 안전정수
 *    상한을 가드한다(design-brief m-3). 빈 값·0 이하·과대 자리수는 null.
 *  - **시각은 로컬 `datetime-local` → UTC ISO(Instant)** 변환(계약 §1 시간 타입). 화면의
 *    로컬 문자열을 그대로 API 에 넣지 않는다.
 *  - **시간 관계 검증**: `endAt > now`, `startAt ≤ endAt`(있으면), `maxEndAt ≥ endAt`.
 *  - **`buyNowPrice > startPrice`**(AUCTION_003 선행 가드).
 *  - **선택 필드는 미설정 시 키를 뺀다** — 빈 문자열·0 을 서버에 흘리지 않는다.
 */
import type { CreateAuctionRequest } from '@/lib/api/auctions'

/** 검증 대상 필드(에러를 입력에 물려 초점을 돌릴 때 쓴다). */
export type SellField =
    'item' | 'startPrice' | 'buyNowPrice' | 'startAt' | 'endAt' | 'maxEndAt'

export interface SellValidationError {
    field: SellField
    message: string
}

/** 화면이 다루는 폼 원본값(전부 입력 그대로 — 문자열/선택값). */
export interface SellFormValues {
    itemInstancePublicId: string | null
    /** 시작가(입력 문자열) */
    startPrice: string
    /** 즉시구매 참고가(입력 문자열). 빈 값이면 미설정 */
    buyNowPrice: string
    /** 시작 시각(datetime-local 문자열). 빈 값이면 미설정 */
    startAt: string
    /** 마감 시각(datetime-local 문자열). 필수 */
    endAt: string
    /** 마감 임박 연장 창(초). 미설정이면 null */
    softCloseWindowSec: number | null
    /** 1회 연장 시간(초). 미설정이면 null */
    softCloseExtendSec: number | null
    /** 최대 연장 시각(datetime-local 문자열). 필수 */
    maxEndAt: string
}

export type SellValidationResult =
    | { ok: true; request: CreateAuctionRequest }
    | { ok: false; errors: SellValidationError[] }

/**
 * 금액 문자열 → 정수(long). 숫자 외 문자를 제거하므로 지수표기·기호가 섞여도 안전하다.
 * 빈 값·0 이하·안전정수 상한 초과(과대 자리수)는 null 이다(호출부가 검증 실패로 처리).
 */
export function parseAmount(raw: string): number | null {
    const digits = String(raw ?? '').replace(/[^0-9]/g, '')
    if (digits === '') return null
    // 안전정수(≈9,007조) 상한 가드 — 자리수가 과도하면 표기·정밀도를 보장할 수 없다(m-3).
    if (digits.length > 15) return null
    const value = Number(digits)
    if (!Number.isSafeInteger(value) || value <= 0) return null
    return value
}

/**
 * 로컬 `datetime-local` 문자열 → { ms, iso(UTC) }. 파싱 불가면 null.
 * ★ `new Date("2026-07-25T15:30")` 은 **로컬 시간**으로 해석되고 `toISOString()` 이 UTC 로 변환한다.
 */
export function parseLocalDateTime(
    local: string,
): { ms: number; iso: string } | null {
    if (!local) return null
    const ms = new Date(local).getTime()
    if (!Number.isFinite(ms)) return null
    return { ms, iso: new Date(ms).toISOString() }
}

/**
 * 폼 검증 + 요청 정규화. 실패면 모든 오류를 모아 돌려 사용자가 한 번에 고치게 한다.
 *
 * @param now 현재 시각(ms). 테스트 주입용. 기본 `Date.now()`.
 */
export function validateSellForm(
    values: SellFormValues,
    now: number = Date.now(),
): SellValidationResult {
    const errors: SellValidationError[] = []

    // 1. 아이템 선택
    if (!values.itemInstancePublicId) {
        errors.push({
            field: 'item',
            message: '출품할 아이템을 선택해 주세요.',
        })
    }

    // 2. 시작가
    const startPrice = parseAmount(values.startPrice)
    if (startPrice === null) {
        errors.push({
            field: 'startPrice',
            message: '시작가를 올바른 금액으로 입력해 주세요.',
        })
    }

    // 3. 즉시구매 참고가(선택) — 있으면 시작가보다 커야 한다(AUCTION_003 선행 가드).
    let buyNowPrice: number | undefined
    const buyNowRaw = String(values.buyNowPrice ?? '').trim()
    if (buyNowRaw !== '') {
        const parsed = parseAmount(values.buyNowPrice)
        if (parsed === null) {
            errors.push({
                field: 'buyNowPrice',
                message: '즉시구매 참고가를 올바른 금액으로 입력해 주세요.',
            })
        } else if (startPrice !== null && parsed <= startPrice) {
            errors.push({
                field: 'buyNowPrice',
                message: '즉시구매 참고가는 시작가보다 높아야 합니다.',
            })
        } else {
            buyNowPrice = parsed
        }
    }

    // 4. 마감 시각(필수) — now 이후.
    const end = parseLocalDateTime(values.endAt)
    if (end === null) {
        errors.push({ field: 'endAt', message: '마감 시각을 입력해 주세요.' })
    } else if (end.ms <= now) {
        errors.push({
            field: 'endAt',
            message: '마감 시각은 현재 시각보다 뒤여야 합니다.',
        })
    }

    // 5. 시작 시각(선택) — 있으면 마감 이하.
    let startAtIso: string | undefined
    const startRaw = String(values.startAt ?? '').trim()
    if (startRaw !== '') {
        const start = parseLocalDateTime(values.startAt)
        if (start === null) {
            errors.push({
                field: 'startAt',
                message: '시작 시각을 올바르게 입력해 주세요.',
            })
        } else if (end !== null && start.ms > end.ms) {
            errors.push({
                field: 'startAt',
                message: '시작 시각은 마감 시각보다 앞서야 합니다.',
            })
        } else {
            startAtIso = start.iso
        }
    }

    // 6. 최대 연장 시각(필수) — 마감 이상.
    const maxEnd = parseLocalDateTime(values.maxEndAt)
    if (maxEnd === null) {
        errors.push({
            field: 'maxEndAt',
            message: '최대 연장 시각을 입력해 주세요.',
        })
    } else if (end !== null && maxEnd.ms < end.ms) {
        errors.push({
            field: 'maxEndAt',
            message: '최대 연장 시각은 마감 시각 이후여야 합니다.',
        })
    }

    if (
        errors.length > 0 ||
        startPrice === null ||
        end === null ||
        maxEnd === null ||
        !values.itemInstancePublicId
    ) {
        return { ok: false, errors }
    }

    const request: CreateAuctionRequest = {
        itemInstancePublicId: values.itemInstancePublicId,
        startPrice,
        endAt: end.iso,
        maxEndAt: maxEnd.iso,
    }
    if (buyNowPrice !== undefined) request.buyNowPrice = buyNowPrice
    if (startAtIso !== undefined) request.startAt = startAtIso
    if (values.softCloseWindowSec !== null) {
        request.softCloseWindowSec = values.softCloseWindowSec
    }
    if (values.softCloseExtendSec !== null) {
        request.softCloseExtendSec = values.softCloseExtendSec
    }

    return { ok: true, request }
}
