/**
 * 비교 선택 세션 어댑터 (FC-079 — rebuild-contract-map §1 라우트 6 · 부록 주의 5).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **비교는 전부 클라이언트다 — 서버에 저장하지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 선택 상태는 `sessionStorage`(탭 수명)에만 산다. 백엔드에 비교 API 가 없고(목업 §11 권장 API
 * 는 채택하지 않음, contract-map §7), 서버 왕복이 필요한 데이터도 아니다. 그래서 **zustand
 * 스토어(전역)와 세션 지속을 갈라** 이 파일이 **지속 층만** 담당한다 — 스토어는 규칙(add/remove/
 * 최대 3)만 갖고, 어디에 저장하는지는 몰라도 된다.
 *
 * ★ **참조만 저장한다**(`{source, listingId}`) — 아이템 스냅샷을 복제하지 않는다. 표시 데이터는
 *   비교 페이지가 `GET /auctions/{id}` 로 다시 받는다(캐시 재사용). 스냅샷을 세션에 굳히면
 *   가격·마감이 오래된 값으로 남는다(경매는 실시간이다).
 * ★ **경매 아이템만 비교 대상이다**(`source: 'AUCTION'`). 목업의 마켓·경매 혼합 비교 중 마켓
 *   경로는 고정가 미구현이라 자리보류다 — 여기서 `MARKET` 참조를 만들지도 받지도 않는다
 *   (검증에서 걸러 stale 마켓 참조가 세션에 남아도 무시된다).
 */

/** 목업과 동일 키 — 탭 세션에 산다(서버 저장 없음). */
export const COMPARE_STORAGE_KEY = 'jangteoCompareItems'

/** 목업 §11 규칙 — 비교는 최대 3개. */
export const MAX_COMPARE_ITEMS = 3

/**
 * 비교 대상 출처. **경매만 실데이터가 있다**(§1 라우트 6). 고정가 마켓은 백엔드 미구현이라
 * 참조를 만들 수 없다(placeholder). 유니온을 `'AUCTION'` 으로 좁혀 마켓 경로를 원천 차단한다.
 */
export type CompareSource = 'AUCTION'

/** 비교 참조 — 표시 데이터가 아니라 **식별자만**(위 ★). */
export interface CompareReference {
    source: CompareSource
    /** 경매 공개 ID(`auctionPublicId`, ULID) */
    listingId: string
}

function isCompareReference(value: unknown): value is CompareReference {
    if (typeof value !== 'object' || value === null) return false
    const ref = value as Record<string, unknown>
    // 경매 참조만 허용 — stale 마켓 참조는 여기서 조용히 탈락한다.
    return ref.source === 'AUCTION' && typeof ref.listingId === 'string'
}

/**
 * 세션에서 선택을 읽는다. 파싱 불가·비배열·오염 항목은 **예외 없이** 빈/걸러진 값으로 흘린다
 * (세션 한 줄이 앱을 흰 화면으로 만들면 안 된다). 중복 listingId 는 첫 항목만 남기고, 최대 3개로 자른다.
 */
export function loadCompareSelection(): CompareReference[] {
    try {
        const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY)
        if (!raw) return []

        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        const seen = new Set<string>()
        const result: CompareReference[] = []
        for (const entry of parsed) {
            if (!isCompareReference(entry)) continue
            if (seen.has(entry.listingId)) continue
            seen.add(entry.listingId)
            result.push({ source: entry.source, listingId: entry.listingId })
            if (result.length >= MAX_COMPARE_ITEMS) break
        }
        return result
    } catch {
        return []
    }
}

/** 세션에 선택을 쓴다. 저장 실패(사생활 모드·용량)는 삼킨다 — 비교는 부가 기능이라 앱을 막지 않는다. */
export function saveCompareSelection(items: CompareReference[]): void {
    try {
        sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items))
    } catch {
        /* 무시 — 세션 저장 실패가 화면을 막지 않는다. */
    }
}
