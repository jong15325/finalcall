export type AppConfig = {
    apiPrefix: string
    authenticatedEntryPath: string
    unAuthenticatedEntryPath: string
    locale: string
    accessTokenPersistStrategy: 'localStorage' | 'sessionStorage' | 'cookies'
    enableMock: boolean
    activeNavTranslation: boolean
}

/**
 * 앱 설정 (FC-055 이식).
 *
 * ★ `apiPrefix` 는 계약 [1.1] 의 `/api/v1` 이다(템플릿 기본값 `/api` 아님). dev 에서는
 *   `vite.config.ts` 프록시가 이 경로를 `:8080` 으로 넘기며 **X-Gateway-Token** 을 붙인다.
 *
 * ★ `enableMock: false` — 템플릿은 axios-mock-adapter 로 가짜 응답을 준다(기본 true).
 *   켜둔 채로 두면 **실백엔드에 붙었는지 아닌지가 화면상 구분되지 않는다.** 우리는 실백엔드를 본다.
 *
 * ★ `authenticatedEntryPath` 가 홈(`/`)이다 — 관리자 템플릿은 로그인 후 대시보드로 보내지만
 *   커머스의 로그인 후 착지점은 **원래 보던 곳**이고, 기본값은 홈이다.
 *
 * ★ `accessTokenPersistStrategy` 는 FC-056 에서 재판정한다. 템플릿 기본값은 쿠키인데 우리
 *   토큰 회전(계약 §2)은 refresh 토큰을 함께 다루므로 저장 위치가 보안 결정이다 — 이 티켓에서
 *   확정하지 않는다.
 */
const appConfig: AppConfig = {
    apiPrefix: '/api/v1',
    authenticatedEntryPath: '/',
    unAuthenticatedEntryPath: '/login',
    locale: 'ko',
    accessTokenPersistStrategy: 'localStorage',
    enableMock: false,
    activeNavTranslation: false,
}

export default appConfig
