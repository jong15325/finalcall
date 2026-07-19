/**
 * 입찰 금액 규칙 (FC-064 → 리뷰 M-1·m-3 재작업).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **금전 규칙을 effect 안에 두지 않는다.** 순수 함수로 꺼내 직접 검증한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 1차 구현은 두 규칙(최소가 변경 시 입력 처리 · 제출 전 검증)이 컴포넌트 `useEffect`/핸들러
 * 안에만 있었다. 그래서 **리뷰가 잡은 결함 두 건이 화면 테스트로는 재현하기 어려웠다** —
 * 조건이 "탭 전환으로 재조회가 일어나 최소가가 오른 순간"처럼 렌더 타이밍에 얽혀 있었기
 * 때문이다. 돈이 오가는 판단은 **입력과 출력만으로 확인 가능한 자리**에 있어야 한다.
 */

/** 제출 전 검증 결과. 실패는 사용자에게 보일 문구를 그대로 들고 온다. */
export type BidAmountCheck =
    { ok: true; amount: number } | { ok: false; message: string }

/**
 * 입력 문자열 → 보낼 금액.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **문자열을 먼저 본다** (리뷰 m-3).
 * ══════════════════════════════════════════════════════════════════════════════
 * `Number.isInteger(1e21) === true` 다. 종전 검사는 그래서 지수 표기를 통과시켰고
 * `JSON.stringify` 가 `{"amount":1e+21}` 로 직렬화해 서버로 나갔다(`type="number"` 입력칸에도
 * `1e21` 은 타이핑된다). 순수 숫자 문자열만 통과시키면 지수 표기·부호·소수점·공백이
 * **한 번에** 걸리고, `isSafeInteger` 가 정밀도를 잃는 자릿수를 막는다.
 *
 * ★ 최소가 비교는 **증분표 복제가 아니다** — 서버가 내려준 `minNextBidAmount` 와 그대로
 *   비교할 뿐이다. 계단식 증분 계산을 클라가 흉내내면 그 순간 서버와 드리프트가 생긴다.
 */
export function validateBidAmount(
    raw: string,
    minNextBidAmount: number | null,
    formatAmount: (amount: number) => string,
): BidAmountCheck {
    const trimmed = raw.trim()
    const amount = Number(trimmed)

    if (
        !/^\d+$/.test(trimmed) ||
        !Number.isSafeInteger(amount) ||
        amount <= 0
    ) {
        return { ok: false, message: '입찰 금액을 숫자로 입력해 주세요.' }
    }

    if (minNextBidAmount !== null && amount < minNextBidAmount) {
        return {
            ok: false,
            message: `${formatAmount(minNextBidAmount)} 이상으로 입찰해 주세요.`,
        }
    }

    return { ok: true, amount }
}

export interface AmountReconcileInput {
    /** 지금 입력칸에 있는 문자열 */
    current: string
    /** 서버가 새로 내려준 최소 입찰가 */
    minNextBidAmount: number
    /** 사용자가 금액을 **직접 만졌는가**(프리필과 사용자 의사를 가르는 유일한 근거) */
    edited: boolean
}

/**
 * 최소가가 **올랐는가**. 첫 관측(비교 대상 없음)과 하락은 알리지 않는다.
 *
 * ★ 값 보정과 **분리해 둔다** — 보정은 "입력칸에 뭐가 있는가"에 달렸고 알림은 "최소가가
 *   어떻게 움직였는가"에만 달렸다. 한 함수로 묶으면 호출부가 필요 없는 인자를 지어내게 된다.
 */
export function isMinRaised(
    previousMin: number | null,
    minNextBidAmount: number,
): boolean {
    return previousMin !== null && minNextBidAmount > previousMin
}

/**
 * 최소가가 바뀌었을 때 입력칸을 어떻게 할 것인가.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **사용자가 넣은 금액을 덮어쓰지 않는다** (리뷰 M-1 · 금전).
 * ══════════════════════════════════════════════════════════════════════════════
 * 1차 구현은 최소가가 바뀌면 입력칸을 **무조건** 새 최소가로 치환했다. 근거는 *"그때는 옛
 * 금액이 어차피 무효"* 였는데 — **정확히 위험한 경우에 그 추론이 성립하지 않는다.**
 * 최소가 12,500 경매에 `100000`(스나이핑)을 넣어 둔 사용자가 탭을 다녀오면
 * (`useAuctionDetail` 이 `refetchOnWindowFocus`) 최소가가 13,000 으로 오르고 입력칸이 조용히
 * `13000` 이 됐다. **여전히 유효한 입력을 하향 치환**한 것이고, 확인 단계가 없어서
 * (성공 즉시 확정) 의도한 100,000 대신 13,000 이 전송된 뒤 **되돌릴 수 없다.**
 *
 * 그래서 셋으로 가른다:
 *   ① 아직 안 만진 **프리필**은 최신 최소가로 갱신한다(원래 의도 — 편의).
 *   ② 사용자 입력이 새 최소가 **이상**이면 **그대로 둔다** — 유효한 의사다.
 *   ③ 사용자 입력이 새 최소가 **미만**일 때만 끌어올린다(두면 확실히 `BID_001` 이다).
 * 어느 경우든 최소가가 **올랐다는 사실은 안내로 말한다** — 조용히 바꾸지 않는다.
 */
export function reconcileAmountWithMin({
    current,
    minNextBidAmount,
    edited,
}: AmountReconcileInput): string {
    // ① 아직 안 만진 프리필 — 늘 최신 최소가로 따라간다.
    if (!edited) return String(minNextBidAmount)

    const parsed = Number(current)
    // ③ 사용자 입력이 최소가 미만일 때만 끌어올린다. ② 그 밖에는 손대지 않는다.
    return Number.isFinite(parsed) && parsed < minNextBidAmount
        ? String(minNextBidAmount)
        : current
}
