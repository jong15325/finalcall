/**
 * 소셜 로그인 진입 헬퍼 (FC-155 · 계약 §2 소셜 로그인 방식 B).
 *
 * ★ 범위 = 버튼 클릭 → provider 인가 페이지로 이동 + `state` 생성·세션 보관까지.
 *   콜백(`/oauth/callback`)에서의 `code` 교환·토큰 저장은 **FC-156 별건**이라 여기서 다루지 않는다.
 *
 * ★ state 는 **프론트 소유**다(계약 §2 확정). 프론트가 생성해 `sessionStorage` 에 보관하고,
 *   콜백 복귀 시 대조한다(불일치면 백엔드 미호출·중단). 스테이틀리스 백엔드는 자신이 만들지 않은
 *   state 를 검증할 수 없어 요청 바디에 두지 않는다 — CSRF 대조는 전적으로 프론트 책임이다.
 *
 * ★ 설정은 env 로 주입한다(`.env.example`). client_id 는 provider 콘솔에서 발급받아 넣는다.
 *   미설정이면 `isProviderConfigured` 가 false 를 반환하고 화면이 버튼을 비활성으로 낮춘다 —
 *   키를 주입하면 코드 변경 없이 활성화된다.
 */

export type OAuthProvider = 'kakao' | 'naver'

/** provider 인가 엔드포인트(공개 규격). code 를 프론트 redirect_uri 로 되돌려 준다. */
const AUTHORIZE_ENDPOINT: Record<OAuthProvider, string> = {
    kakao: 'https://kauth.kakao.com/oauth/authorize',
    naver: 'https://nid.naver.com/oauth2.0/authorize',
}

/** 콜백에서 provider·state 를 대조하기 위한 세션 보관 키. FC-156 이 이 값을 읽어 검증한다. */
export const OAUTH_SESSION_KEY = 'finalcall.oauth'
export const OAUTH_PENDING_TTL_MS = 5 * 60 * 1000

export interface OAuthPending {
    provider: OAuthProvider
    state: string
    issuedAt: number
    returnPath: string
}

function hasControlCharacter(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.charCodeAt(0)
        return code <= 0x1f || code === 0x7f
    })
}

export function sanitizeOAuthReturnPath(returnPath?: string | null): string {
    if (
        !returnPath ||
        !returnPath.startsWith('/') ||
        returnPath.startsWith('//') ||
        returnPath.includes('\\') ||
        hasControlCharacter(returnPath) ||
        /%2f|%5c/i.test(returnPath)
    ) {
        return '/'
    }
    try {
        const parsed = new URL(returnPath, window.location.origin)
        if (
            parsed.origin !== window.location.origin ||
            parsed.username ||
            parsed.password ||
            /^\/oauth\/callback(?:\/|$)/.test(parsed.pathname)
        ) {
            return '/'
        }
        return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
        return '/'
    }
}

/** provider 별 client_id(env). 없으면 undefined. 지연 조회라 테스트에서 env 를 주입할 수 있다. */
function clientId(provider: OAuthProvider): string | undefined {
    return provider === 'kakao'
        ? import.meta.env.VITE_OAUTH_KAKAO_CLIENT_ID
        : import.meta.env.VITE_OAUTH_NAVER_CLIENT_ID
}

/**
 * 인가 요청·토큰 교환에 쓸 redirect_uri. env 우선, 없으면 현재 오리진 기준으로 조립한다
 * (백엔드 화이트리스트·provider 등록값과 일치해야 하므로 로컬 기본은 `<origin>/oauth/callback`).
 */
export function oauthRedirectUri(): string {
    return (
        import.meta.env.VITE_OAUTH_REDIRECT_URI ??
        `${window.location.origin}/oauth/callback`
    )
}

/** client_id 가 주입돼 실제 인가 이동이 가능한지. 미설정이면 화면이 버튼을 비활성으로 둔다. */
export function isProviderConfigured(provider: OAuthProvider): boolean {
    return Boolean(clientId(provider))
}

/**
 * CSRF 대조용 난수 state. 반드시 **암호학적 안전 난수**로만 만든다 —
 * `crypto.randomUUID` 우선, 없으면 `crypto.getRandomValues`(16바이트→hex) 폴백.
 * `Math.random` 은 예측 가능해 쓰지 않는다. 안전 난수원이 아예 없는 환경이면 `null` 을
 * 반환해 호출측(`startOAuth`)이 이동을 중단하도록 한다(예측 가능한 state 생성 금지).
 */
export function generateState(): string | null {
    if (typeof crypto === 'undefined') {
        return null
    }
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16)
        crypto.getRandomValues(bytes)
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
            '',
        )
    }
    return null
}

/** provider 인가 URL 조립(response_type=code · client_id · redirect_uri · state). */
export function buildAuthorizeUrl(
    provider: OAuthProvider,
    state: string,
): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId(provider) ?? '',
        redirect_uri: oauthRedirectUri(),
        state,
    })
    return `${AUTHORIZE_ENDPOINT[provider]}?${params.toString()}`
}

/**
 * 소셜 로그인 시작 — state 생성·세션 보관 후 provider 인가 페이지로 이동한다.
 * 미설정(client_id 없음)이면 이동하지 않고 경고만 남긴다(화면이 이미 버튼을 비활성으로 두지만
 * 방어적으로 한 번 더 막는다).
 */
export function startOAuth(provider: OAuthProvider, returnPath?: string): void {
    if (!isProviderConfigured(provider)) {
        console.warn(
            `[oauth] ${provider} client_id 가 설정되지 않았습니다(VITE_OAUTH_${provider.toUpperCase()}_CLIENT_ID). 이동을 중단합니다.`,
        )
        return
    }
    const state = generateState()
    if (state == null) {
        console.warn(
            '[oauth] 암호학적 안전 난수(crypto)가 없어 state 를 만들 수 없습니다. 이동을 중단합니다.',
        )
        return
    }
    const pending: OAuthPending = {
        provider,
        state,
        issuedAt: Date.now(),
        returnPath: sanitizeOAuthReturnPath(returnPath),
    }
    sessionStorage.setItem(OAUTH_SESSION_KEY, JSON.stringify(pending))
    window.location.assign(buildAuthorizeUrl(provider, state))
}
