# 공개 데모 접속 도메인 스펙

> 상태: **v1.1 — APPROVED** (2026-09-04, FC-424 범위 축소 사용자 승인)
> API 정본: `api-contract.md` v1.42 · 스키마 정본: `erd.md` v2.6
> 구현·검증 영향: FC-425 backend · FC-426 frontend · FC-427 review

## 1. 목적과 범위

포트폴리오 방문자가 로그인 화면의 버튼 하나로 공용 테스트 계정에 접속한다. 브라우저에는 아이디·비밀번호를
넣지 않고, 서버가 기존 로그인과 동일한 access/refresh token pair를 발급한다.

범위는 공용 계정 1개, 최소 발급 endpoint, 기존 프론트 세션 흐름 재사용, 운영에 위험한 쓰기 차단뿐이다.
계정 풀·Redis lease·별도 DEMO JWT/claim/sessionType·데모 전용 만료/refresh/logout·WebSocket 수명 처리·
초기화/quarantine/state table은 사용하지 않는다. 동시 방문자는 같은 계정 상태를 공유한다.

## 2. 계정과 영속 모델

- `user.account_type`은 `NORMAL|DEMO`이며 기본값과 기존 행 backfill은 NORMAL이다.
- 활성 `account_type=DEMO` 계정은 정확히 **1개**다. `is_admin=false`, `login_id=NULL`,
  `password_hash=NULL`이고 `user_social_account`를 갖지 않아 일반 로그인·OAuth로 진입할 수 없다.
- 기존 Flyway 시드 관례를 따라 user·user_balance와 조회용 fixture를 migration으로 멱등 생성한다.
  공개 계정 선택에 비밀번호나 운영 시크릿은 필요하지 않으며 자격증명을 환경변수·코드·프론트에 저장하지 않는다.
- endpoint는 활성 DEMO 계정이 0개이거나 2개 이상이면 발급하지 않고 `AUTH_009`로 fail-closed한다.
- 별도 `demo_account_state`, lease/quarantine 컬럼·테이블·Redis 키는 없다.

## 3. API 계약

### `POST /api/v1/auth/demo-login`

- 인증: 불요
- 요청: body 없음
- 응답 `200`: 기존 `LoginResponse` 그대로

```json
{
  "accessToken": "<기존 JWT>",
  "refreshToken": "<기존 opaque refresh token>",
  "accessExpiresAt": "2026-09-04T12:30:00Z"
}
```

- 서버는 유일한 활성 DEMO 계정을 조회한 뒤 기존 `TokenProvider.generateAccessToken(...)`과
  `RefreshTokenStore.issue(userId)` 경로를 그대로 호출한다.
- JWT claim·access 만료, refresh TTL·회전·재사용 탐지, `/auth/refresh`, `/auth/logout`은 일반 로그인과 같다.
- 성공 응답과 프론트 세션 타입도 일반 로그인과 같고 `sessionType`, `demoLeaseId`, 별도 만료 필드는 없다.
- `AUTH_009` 503: 데모 기능 비활성 또는 활성 DEMO 계정이 정확히 1개가 아님. 계정 수·원인은 노출하지 않는다.
- endpoint는 기존 auth rate-limited SCG route에 포함한다. 기존 IP 토큰버킷 값을 그대로 사용하고 별도 limiter는 없다.

최소 서버 endpoint는 필수다. 기존 `/auth/login`을 프론트가 호출하려면 공용 비밀번호가 번들·DOM·네트워크 요청
body에 노출된다. `/demo-login`은 새 인증 체계가 아니라 서버 내부에서 기존 token pair 발급 경로를 호출하는
자격증명 없는 진입점이다.

## 4. 인가와 위험 쓰기 차단

일반 JWT와 동일하므로 요청 주체의 `userId`로 DB의 `account_type`을 확인한다. 프론트 표시나 JWT claim을
인가 근거로 쓰지 않는다. DEMO 계정은 다음 위험 쓰기를 `AUTH_011` 403으로 차단한다.

- 계정: `PATCH/DELETE /api/v1/me`, 이메일 설정·발송·확인
- 자산·거래: 환전, 임시보관 이동, 경매/고정가 등록·취소, 입찰, 즉시구매
- 외부 사용자/콘텐츠 영향: 메모·채팅 발신, 차단·신고, 게시글·댓글·답글·반응·이미지 업로드/수정/삭제
- 관리자 기능 전부

조회와 조회에 동반되는 기존 읽음 전이, `/auth/refresh`, `/auth/logout`은 허용한다. 차단은 컨트롤러별로
중복하지 않고 중앙 정책에서 시행하되, `GET` prefix allowlist나 별도 DEMO JWT 필터를 만들지 않는다.
신규 쓰기 endpoint가 DEMO에 안전한지는 해당 기능 계약/review에서 판단한다.

## 5. 프론트 계약

- 로그인 화면에 `테스트 계정으로 둘러보기` 버튼을 두며 계정 ID·비밀번호를 번들·DOM에 넣지 않는다.
- 중복 클릭을 막고 `POST /auth/demo-login` 응답을 기존 `establishSession`에 그대로 전달한다.
- 성공 뒤 기존처럼 `/me`를 조회하고 기존 auth store, 401 single-flight refresh, logout, 캐시 reset을 재사용한다.
- auth store·API client에 `sessionType`, nullable refresh, 데모 전용 만료/로그아웃 분기를 추가하지 않는다.
- 실패 `AUTH_009`는 "현재 테스트 계정을 사용할 수 없습니다"로 안내한다.

## 6. 동시접속·WebSocket·운영 경계

- 동시 방문자는 같은 userId의 독립 refresh session을 발급받고 프로필·읽음 상태·사용자 캐시를 공유한다.
- 한 방문자의 logout은 자신이 제출한 refresh token만 폐기한다. 다른 방문자 세션을 일괄 종료하지 않는다.
- WebSocket은 기존 JWT 검증, socket quota, user-destination 규칙을 그대로 사용한다. lease 매핑·데모 전용
  frame 검증·강제 종료를 추가하지 않는다. 같은 공용 계정의 이벤트를 여러 방문자가 받을 수 있음을 수용한다.
- 공용 계정에는 개인정보·실거래·개인 대화 fixture를 두지 않는다. 쓰기 차단으로 새 외부 영향 생성을 막는다.
- 운영 중 계정이 오염되면 일반 배포/DB 운영 절차로 fixture를 복구한다. 자동 reset·quarantine은 범위 밖이다.

## 7. 설정·관측성·검증

- `demo.access.enabled`(기본 false, 운영에서 명시 true)만 `@ConfigurationProperties`로 둔다.
- 계정 식별자·비밀번호 환경변수는 두지 않는다. DB의 유일한 활성 `account_type=DEMO` 행이 권위다.
- 발급 성공/실패와 위험 쓰기 거부를 저카디널리티 counter로 기록할 수 있다. userId·토큰·IP는 태그/로그 금지다.
- 검증: body 없는 발급과 기존 LoginResponse wire, 유일 계정 0/1/2건, `isAdmin=false`, 일반 login 차단,
  refresh 회전·logout 회귀, 위험 쓰기 403, 조회 허용, 프론트 자격증명 무포함, 기존 세션/cache reset 재사용.
- 영향 티켓은 기존 FC-424~FC-427만 유지하며 새 파생 티켓을 만들지 않는다.
