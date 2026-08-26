# FinalCall OAuth 라이브 활성화·보강 계약 (oauth-live-hardening-spec.md)

상태: **v1.0 — FC-397 게이트2 사용자 승인 확정(2026-08-25).**
소유: architect(계약) · 구현 FC-398~FC-403.
근거: `api-contract.md` §2 소셜 로그인 · `erd.md` §4.1 `user_social_account` · D-065(서비스 JWT 자체 검증) · D-068(SCG 엣지) · SEC-006(refresh 회전) · SEC-007(열거 방지).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.0 | 2026-08-25 | Kakao·Naver OAuth의 라이브 활성화와 브라우저 state 보강을 확정했다. 기존 API·DB·JWT 형상은 유지하고, state에 provider·issuedAt·내부 return path를 결합해 5분 TTL로 일회 소비한다. PKCE·계정 연결·HttpOnly 토큰 쿠키는 범위 밖이다. |

---

## 1. 목표와 불변 범위

기 구현된 Kakao·Naver 로그인을 실제 provider 콘솔·환경변수와 연결하고, 콜백 CSRF 상태와 운영 가시성을 보강한다. 이번 작업은 OAuth 재구축이 아니다.

- **유지**: SPA가 provider 인가를 시작하고 프론트 `/oauth/callback`이 code를 받은 뒤, `POST /api/v1/auth/oauth/{provider}`로 백엔드에 전달한다. client secret을 보유한 백엔드만 code 교환·userinfo 조회를 수행한다.
- **유지**: 최초 소셜 신원은 즉시 자동가입한다. 신규·기존 모두 200과 동일 `LoginResponse`를 반환한다.
- **유지**: 신원 키는 `(provider, provider_user_id)`이며 provider 이메일을 저장하거나 기존 계정에 자동 연결하지 않는다.
- **유지**: 기존 access JWT, `RefreshTokenStore`의 refresh 회전·재사용 탐지·로그아웃·탈퇴 세션 폐기 계약을 그대로 사용한다.
- **API 형상 불변**: 요청 `{ code, redirectUri }`, 응답 `{ accessToken, refreshToken, accessExpiresAt }`, `AUTH_006`~`AUTH_008`을 변경하지 않는다. state는 브라우저 소유라 API body에 추가하지 않는다.
- **스키마 불변**: `user`, `user_social_account`, 인덱스·제약·Flyway migration을 변경하지 않는다.

### 1.1 명시적 범위 밖

- PKCE(`code_challenge`/`code_verifier`)
- 소셜 계정 명시적 연결·해제 및 이메일 자동연결
- refresh/access token의 HttpOnly cookie 전환과 그에 따른 CSRF/CORS 재설계
- NextAuth/BFF 또는 Spring Security `oauth2Login` 도입
- provider 프로필 이메일·이미지·전화번호 저장

위 항목은 API·신원·세션 경계를 바꾸므로 후속 게이트2 없이는 추가하지 않는다.

## 2. OnRace 비교와 채택·기각

OnRace 실제 소스에는 NextAuth provider 흐름, Spring `oauth2Login`, 클라이언트가 providerId/email/name을 보내는 수동 OAuth API가 공존한다. FinalCall에는 이 중복 경로를 이식하지 않는다.

| OnRace 요소 | 판정 | FinalCall 근거 |
|---|---|---|
| Kakao·Naver 브랜드 진입과 provider별 라이브 콘솔 설정 | 채택 | 사용자 경험과 운영 등록 절차만 재사용한다. |
| state의 짧은 수명과 일회 소비 | 개념 채택 | FinalCall의 `sessionStorage` 소유 모델에 5분 TTL을 적용한다. |
| NextAuth/BFF가 provider code를 교환 | 기각 | FinalCall의 backend 교환·게이트웨이·자체 JWT 경계를 유지한다. |
| Spring `oauth2Login` 병행 | 기각 | 인증 진입점과 provider 교환 책임이 이중화된다. |
| providerId/email/name 클라이언트 주장값으로 JWT 발급 | 기각 | backend가 code로 provider userinfo를 직접 검증해야 한다. |
| JWT를 redirect URL query로 전달 | 기각 | 브라우저 기록·로그·Referer 노출 위험이 있다. 기존 JSON 응답을 유지한다. |
| 단일 `user.authProvider/providerId` 모델 | 기각 | 기존 `user_social_account` 분리 모델이 정본이다. |
| 동일 이메일 소셜 가입 차단/자동 결합 | 기각 | 이메일은 신원 키가 아니며 자동연결을 금지한 기존 계약을 유지한다. |

## 3. 브라우저 인가·state 계약

### 3.1 pending state 형상

프론트는 인가 이동 직전에 암호학적 안전 난수 state를 만들고 `sessionStorage`의 기존 OAuth 전용 키에 다음 객체를 JSON으로 저장한다.

```json
{
  "provider": "kakao",
  "state": "<cryptographically-random-value>",
  "issuedAt": 1787587200000,
  "returnPath": "/auctions/01..."
}
```

- `provider`: `kakao | naver`. 콜백이 사용할 전략의 유일한 브라우저 소유 출처다.
- `state`: `crypto.randomUUID()` 또는 `crypto.getRandomValues()`로 생성한다. `Math.random` 폴백은 금지한다.
- `issuedAt`: 저장 시점의 Unix epoch milliseconds. 콜백 수신 시 **현재 시각 - issuedAt ≤ 5분**이어야 하며 미래 시각·비정수·음수도 무효다.
- `returnPath`: 선택적 내부 복귀 경로. `/`로 시작하는 same-origin 상대 경로만 허용하고 `//`, scheme, host, 역슬래시, 제어문자, `/oauth/callback` 자기참조는 거부한다. 무효·누락이면 `/`로 정규화한다.
- 저장 형상이 없거나 파손됐으면 인가를 재시작해야 한다. 이전 형상(provider+state만)은 TTL을 검증할 수 없으므로 무효다.

단일 storage key는 마지막 인가 시도 하나만 권위로 둔다. 다른 탭/재클릭이 새 시도를 시작하면 이전 시도는 무효화된다. 이는 묵시적으로 어느 콜백이 이기는지 정하지 않는 대신, 가장 최근 사용자 동작만 허용하는 fail-closed 정책이다.

### 3.2 콜백 검증·일회 소비

`/oauth/callback`은 아래 순서를 지킨다.

1. pending 객체를 읽고 **즉시 storage에서 제거**한다. 이후 성공·거부·오류와 무관하게 복구하지 않는다.
2. provider가 반환한 `error`가 있으면 취소 UI를 표시하고 backend를 호출하지 않는다.
3. code·callback state·pending state·provider·issuedAt 형상과 5분 TTL을 검증한다.
4. 하나라도 실패하면 일반화된 잘못된 로그인 요청 UI를 표시하고 backend를 호출하지 않는다.
5. 검증 성공일 때만 pending provider로 기존 OAuth API를 정확히 한 번 호출한다. React StrictMode·리렌더·뒤로가기로 중복 교환하지 않는다.
6. 세션 확립 성공 후 검증·정규화된 `returnPath`로 `replace` 이동한다. 실패 시 로그인 화면으로 복귀할 수 있어야 한다.

state 원문, code, provider access token, client secret, 우리 access/refresh token은 console·analytics·URL·오류 문구에 기록하지 않는다.

## 4. Provider·redirect·환경변수 계약

### 4.1 환경변수 이름

실값은 `.env.example`, 문서, 로그, 티켓, 커밋에 쓰지 않는다.

프론트 공개 설정:

- `VITE_OAUTH_KAKAO_CLIENT_ID`
- `VITE_OAUTH_NAVER_CLIENT_ID`
- `VITE_OAUTH_REDIRECT_URI`

백엔드 비밀/운영 설정:

- `OAUTH_KAKAO_CLIENT_ID`
- `OAUTH_KAKAO_CLIENT_SECRET`
- `OAUTH_NAVER_CLIENT_ID`
- `OAUTH_NAVER_CLIENT_SECRET`
- `OAUTH_REDIRECT_URI`
- 선택적 표준 endpoint override: `OAUTH_KAKAO_TOKEN_URI`, `OAUTH_KAKAO_USERINFO_URI`, `OAUTH_NAVER_TOKEN_URI`, `OAUTH_NAVER_USERINFO_URI`

client secret은 백엔드에만 둔다. `VITE_*`·정적 bundle·provider authorize URL에 secret을 넣지 않는다. local 더미 기본값은 컨텍스트 부팅용일 뿐 라이브 성공을 의미하지 않는다. dev/prod는 실제 필수값 누락 시 fail-fast한다.

### 4.2 provider 콘솔 callback 삼자 일치

각 환경에서 다음 문자열은 scheme·host·port·path·trailing slash까지 정확히 같아야 한다.

1. Kakao/Naver 개발자 콘솔에 등록한 redirect URI
2. 프론트 `VITE_OAUTH_REDIRECT_URI`
3. 백엔드 `OAUTH_REDIRECT_URI`

복귀지는 프론트의 `<origin>/oauth/callback`이며 backend callback URI를 provider 콘솔에 추가하지 않는다. 운영은 HTTPS만 허용한다. local은 명시된 localhost URI만 허용한다. 임의 요청 `redirectUri`를 동적 허용하거나 origin 부분일치·suffix 일치로 완화하지 않는다.

Provider 동의 범위는 신원 ID와 닉네임 획득에 필요한 최소 범위로 제한한다. 이메일은 요청·수집·저장·자동연결의 근거로 사용하지 않는다.

## 5. Backend·Gateway 계약

### 5.1 backend

- provider 외부 HTTP 호출은 DB transaction 밖에서 수행하고 공유 client·connect/read timeout을 유지한다.
- redirectUri exact match는 provider 호출 전에 수행한다.
- userinfo의 provider 고유 ID가 없으면 provider 오류로 실패하며 임의 대체 신원을 만들지 않는다.
- find-or-create의 `(provider, provider_user_id)` UK 및 동시 최초 로그인 재수렴을 유지한다.
- 신규가입은 user·balance·social account를 원자 생성한다. 토큰은 user 확정 후 기존 발급기로 발급한다.
- code와 provider access token을 저장하지 않는다. provider refresh token을 요청·저장하지 않는다.

### 5.2 gateway

- `/api/v1/auth/oauth/**`는 permitAll 성격의 로그인 API지만 반드시 SCG를 경유하고 공유 `X-Gateway-Token` 검증을 유지한다.
- 기존 `auth-rate-limited` 경로에 계속 포함한다. 별도 우회 route·직접 backend 공개를 만들지 않는다.
- rate-limit key와 로그에는 code/state/token을 포함하지 않는다. 엣지 429/403 envelope는 기존 계약을 사용한다.

## 6. 오류·로깅·관측성 계약

### 6.1 오류

- 브라우저 선검증 실패(state 누락·불일치·만료·형상 파손)는 backend 미호출이며 사용자에게 하나의 일반화 메시지를 표시한다.
- provider 사용자 거부는 별도 취소 메시지를 표시하되 provider 상세 오류 문자열을 그대로 노출하지 않는다.
- backend는 기존 `AUTH_006`(400), `AUTH_007`(401), `AUTH_008`(502), redirect 검증 400을 유지한다. 신규 에러코드는 없다.
- 신규가입 여부·소셜 신원 존재 여부는 응답 코드·본문·메트릭 label로 외부에 드러내지 않는다.

### 6.2 로그

허용 필드: provider, 결과 범주(success/cancel/client_invalid/exchange_failed/provider_error), HTTP status, duration, trace/request ID. 금지 필드: code, state, provider access token, client secret, 우리 JWT/refresh token, provider user ID, 이메일, 원본 provider 오류 body.

### 6.3 메트릭

저카디널리티 provider·result label만 사용한다.

- OAuth backend 교환 요청 count(provider, result)
- provider token/userinfo 외부 호출 duration(provider, phase, result)
- frontend callback 결과 count(provider, result: success/cancel/invalid/expired/backend_error)
- gateway 429는 기존 엣지 메트릭에서 OAuth route로 식별 가능해야 한다.

user ID·provider user ID·state·code·exception message를 label에 넣지 않는다. 알람은 provider 오류율·지연 상승을 탐지하되 비밀번호 로그인과 서비스 전체 장애를 혼동하지 않는다.

## 7. 검증 계약

### 7.1 frontend

- 안전 난수 생성과 난수원 부재 fail-closed
- pending 형상 저장(provider/state/issuedAt/returnPath)
- 5분 경계(이내 성공, 초과 실패), 미래·파손 issuedAt 실패
- state 누락·불일치·storage 부재·provider 오류에서 backend 미호출
- 외부 URL·`//host`·callback 자기참조 returnPath의 `/` 폴백
- 성공 시 정확히 한 번 교환·세션 확립·내부 returnPath replace
- 다중 탭/재클릭에서 마지막 pending만 유효

### 7.2 backend·gateway

- Kakao/Naver provider token/userinfo mock contract 성공·4xx·5xx·timeout·필수 ID 누락
- redirectUri exact match 및 불일치 시 외부 호출 0회
- 기존/신규 동일 200 형상, 동시 최초 로그인 단일 계정 수렴
- JWT 발급·refresh 회전·재사용 탐지·로그아웃·탈퇴 회귀
- `/api/v1/auth/oauth/**` permitAll 도달, gateway rate limit 포함, 직접접근 차단
- 로그 캡처에서 금지 필드 부재, 메트릭 label 저카디널리티

### 7.3 라이브 smoke

local 또는 dev의 실제 Kakao·Naver 계정으로 각각 동의 승인·취소·재로그인·로그아웃 후 재로그인을 확인한다. provider 콘솔 callback, frontend/backend URI, 배포 origin이 일치하는 증거를 남기되 키·code·token은 남기지 않는다.

## 8. 롤백

- provider별 공개 client ID를 제거하거나 frontend feature flag/설정 판정으로 해당 버튼을 비활성화한다. 한 provider 장애가 다른 provider·비밀번호 로그인을 막지 않아야 한다.
- backend OAuth endpoint와 V19 스키마는 이미 배포된 호환 계약이므로 롤백 시 제거하지 않는다. 진행 중 callback의 짧은 유예를 위해 endpoint를 유지할 수 있다.
- state 형상 보강 배포를 되돌리면 구 pending은 재로그인을 요구할 수 있으나 계정·토큰 데이터 손실은 없다.
- migration이 없으므로 DB rollback은 없다. provider secret 회수·교체는 배포와 독립적으로 수행한다.

## 9. 구현 티켓 파급(FC-398~FC-403)

| 티켓 | 소유/주요 영향 파일 | 완료 기준 |
|---|---|---|
| FC-398 | backend-impl — backend profile 설정·frontend 공개 env 예시·배포 환경변수/callback 운영 설정 | frontend 공개 client ID와 backend secret 분리, provider 콘솔·frontend·backend callback exact match, 운영 누락 fail-fast, 실값 미기록 |
| FC-399 | frontend-impl — `frontend/src/features/auth/lib/oauth.ts`, `frontend/src/pages/OAuthCallbackPage.tsx` 및 관련 테스트 | pending v2 형상·5분 TTL·안전 returnPath·일회 소비, 만료/변조 backend 미호출, 정확히 1회 교환, 성공 복귀·취소/오류 UX |
| FC-400 | backend-impl — auth OAuth 설정/전략/서비스 및 단위·통합 테스트 | API 형상·스키마 불변, exact redirect, provider 실패/timeout/ID 누락과 `AUTH_007`·`AUTH_008`, 외부 호출 TX 분리·동시가입 수렴·민감값 비기록·JWT lifecycle 회귀 |
| FC-401 | backend-impl — `backend/gateway` OAuth route/rate-limit 및 backend OAuth metrics/logging 계측·테스트 | Gateway 경유·rate limit·직접접근 차단, §6 저카디널리티 성공·실패·지연 지표, 금지 필드 0건, provider 장애 격리 |
| FC-402 | main — 실제 provider 콘솔·배포 환경 E2E 및 전체 인증 회귀 증거 | Kakao/Naver 정상·최초가입·재로그인·거부, state/redirect/code 공격 경로, refresh 회전·logout·탈퇴·비밀번호 로그인 회귀, 민감값 없는 증거 |
| FC-403 | reviewer — 전체 변경·E2E 증거·보안/QA/접근성/롤백 통합 리뷰 | critical/major 0과 review_status passed, state·redirect·동시가입·JWT lifecycle·시크릿 비노출·provider별 롤백 확인 |

의존: FC-397 → FC-398·FC-399·FC-400, FC-400 → FC-401, FC-398·FC-399·FC-400·FC-401 → FC-402, FC-402 → FC-403. 동일 파일 소유가 겹치는 경우 순차 실행한다.
