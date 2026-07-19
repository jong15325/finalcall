import { REDIRECT_URL_KEY } from '@/constants/app.constant'

/**
 * 로그인 복귀 URL 규칙 (P-011 — 구 프론트 `lib/returnUrl.ts` 복원, FC-057).
 *
 * ★★ **오픈 리다이렉트 방지가 이 파일의 존재 이유다.** `?redirectUrl=` 은 공격자가 값을
 *    고를 수 있는 입력이다. 그대로 `navigate()` 에 넘기면 우리 로그인 화면이 외부 사이트로
 *    보내는 **피싱 발판**이 된다("finalcall 에서 로그인했는데 결제창이 떴다").
 *    그래서 **앱 내부 절대경로만** 통과시킨다.
 */

/** 로그인 성공 후 갈 곳의 기본값. 복귀 대상이 없거나 불신하면 여기로 간다. */
export const DEFAULT_RETURN_URL = '/'

/**
 * 복귀 URL 정화. 통과하지 못하면 조용히 홈으로 떨어뜨린다(에러를 띄우지 않는다 —
 * 사용자가 만든 값이 아니다).
 *
 * 차단 대상:
 * - `http://evil.com` 등 절대 URL(스킴 있음)
 * - `//evil.com` 프로토콜 상대 URL — 브라우저는 이것도 외부로 간다
 * - `/\evil.com` 백슬래시 우회 — 일부 브라우저가 `//` 로 정규화한다
 * - `/` 로 시작하지 않는 상대경로(현재 위치에 따라 어디로 갈지 정해지지 않는다)
 */
export function sanitizeReturnUrl(raw: string | null | undefined): string {
    if (!raw) return DEFAULT_RETURN_URL
    if (!raw.startsWith('/')) return DEFAULT_RETURN_URL
    if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_RETURN_URL
    return raw
}

/**
 * 인증 화면으로 보낼 때 붙일 쿼리스트링을 만든다(`ProtectedRoute` 용).
 *
 * ★ **query·hash 를 함께 싣는다.** 경로만 실으면 `/auctions?status=OPEN` 에서 튕긴 손님이
 *   로그인 후 필터 없는 목록으로 돌아온다 — 보던 화면이 아니다.
 * ★ 홈에서 튕긴 경우는 복귀 파라미터를 만들지 않는다(홈이 기본값이라 무의미하다).
 */
export function buildReturnUrlQuery(location: {
    pathname: string
    search?: string
    hash?: string
}): string {
    const target = `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
    if (target === DEFAULT_RETURN_URL) return ''
    return `?${REDIRECT_URL_KEY}=${encodeURIComponent(target)}`
}
