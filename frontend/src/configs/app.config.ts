export type AppConfig = {
    apiPrefix: string
    authenticatedEntryPath: string
    unAuthenticatedEntryPath: string
    locale: string
    accessTokenPersistStrategy: 'localStorage' | 'sessionStorage' | 'cookies'
    activeNavTranslation: boolean
}

/**
 * 앱 설정 (FC-055 이식).
 *
 * ★ `apiPrefix` 는 계약 [1.1] 의 `/api/v1` 이다(템플릿 기본값 `/api` 아님). dev 에서는
 *   `vite.config.ts` 프록시가 이 경로를 `:8080` 으로 넘기며 **X-Gateway-Token** 을 붙인다.
 *   `VITE_API_BASE_URL`(`.env.example`) 로 덮어쓸 수 있다 — 이 값이 `apiClient` 의 유일한
 *   base 다(FC-056: 전송로가 하나이므로 base 도 하나다).
 *
 * ★ `enableMock` 은 **제거됐다**(FC-056). 템플릿의 목은 axios 인터셉터라 전송로를 `apiClient`
 *   하나로 합치면서 함께 사라졌다. 애초에 켜두면 실백엔드에 붙었는지가 화면상 구분되지 않는다.
 *
 * ★ `authenticatedEntryPath` 가 홈(`/`)이다 — 관리자 템플릿은 로그인 후 대시보드로 보내지만
 *   커머스의 로그인 후 착지점은 **원래 보던 곳**이고, 기본값은 홈이다.
 *
 * ★★ `accessTokenPersistStrategy` 는 **아직 미확정이다**(FC-056 게이트2 상신). 현행 백엔드가
 *    토큰을 응답 바디로 주고 `/auth/refresh`·`/auth/logout` 이 refreshToken 을 요청 바디로
 *    요구하므로 **httpOnly 쿠키는 백엔드 무변경으로 불가능**하다 — 선택지는 localStorage /
 *    sessionStorage / JS 가독 쿠키 셋뿐이다. 판정 전까지 FC-055 가 둔 `localStorage` 를 유지한다.
 *    저장 위치는 `store/authStore.ts` 가 이 값 하나만 보므로 판정 시 여기만 바꾸면 된다.
 */
const appConfig: AppConfig = {
    apiPrefix: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
    authenticatedEntryPath: '/',
    unAuthenticatedEntryPath: '/login',
    locale: 'ko',
    accessTokenPersistStrategy: 'localStorage',
    activeNavTranslation: false,
}

export default appConfig
