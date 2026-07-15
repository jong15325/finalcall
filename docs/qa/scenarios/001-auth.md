# auth 시나리오 (QA-S-AUTH, qa-guide §4)

도메인: 인증(auth) — signup·login·refresh·logout. 기준: api-contract **v1.4** [2]·[1]·[5].
근거 줄 갱신 2026-07-15(D-092 3단): v1.2→v1.4 델타 검토 결과 **auth 엔드포인트 영향 없음** —
v1.3은 엣지 오류([1.6], 게이트웨이 소관), v1.4는 [2.5] 회원 리소스 신설 + [2] 제목·전방 참조 정정으로
signup·login·refresh·logout 4종의 경로·스키마·상태코드·에러코드는 불변. 시나리오 무수정, 근거 줄만 갱신.
검증 대상: backend/outbox/019(auth 완결). 정적 정합 검증 결과를 각 시나리오 말미 [검증]에 표기.
기대 결과 근거는 계약 조항·에러 코드만 인용(qa-guide §4). 근거 없는 기대는 계약 질의로 격상.

---

### QA-S-AUTH-01. 회원가입 성공
사전 조건: loginId·nickname 미사용. 게이트웨이 경유(X-Gateway-Token 정상).
절차:
1. POST /api/v1/auth/signup, body `{ loginId, password, nickname }`(형식 유효).
기대 결과: 201, `data:{ userPublicId, nickname }`. userPublicId는 public_id(ULID, 26자), 내부 id
  미노출(§1.1). 토큰 미발급(§2). envelope `{success:true,data,timestamp(ISO-8601 UTC)}`(§1.4).
유형: 기능
[검증] 정합. AuthController.signup 201 + SignupResponse{userPublicId,nickname}, ULID 생성
  (AuthServiceUnitTest 26자 확인). 잔액행(0,0,0) 동일 TX 생성.

### QA-S-AUTH-02. 중복 가입 — loginId/nickname 경쟁 포함
사전 조건: loginId="dup" 또는 nickname="dup닉" 기존재. 동시성 케이스는 동일 값 6요청 동시.
절차:
1. 기존 loginId로 signup → AUTH_001 기대.
2. 기존 nickname으로 signup → AUTH_002 기대.
3. (동시성) 동일 loginId로 6스레드 동시 signup → 정확히 1건 201, 나머지 409 AUTH_001.
기대 결과: §2·§5 — AUTH_001 중복 loginId(409), AUTH_002 중복 nickname(409). 동시 경쟁 시에도
  선검사 통과분은 UK 제약 안전망으로 409(단일 성공, 500 금지).
유형: 동시성
[검증] 정합. existsBy 선검사 + UK(uk_user_login_id/uk_user_nickname) 안전망 →
  DataIntegrityViolationException을 AUTH_001/002로 매핑(B-024, AuthServiceUnitTest M1 2건).
  019 보고: signup 6스레드 동시성 테스트 보강.

### QA-S-AUTH-03. 로그인 — 성공·실패(열거 완화)
사전 조건: 유효 사용자 1명(hong) 존재. 탈퇴 계정 1명.
절차:
1. 정상 자격 → 200.
2. 없는 loginId → 실패.
3. 잘못된 password → 실패.
4. 탈퇴 계정 자격 → 실패.
기대 결과: 성공 200 `{ accessToken, refreshToken, accessExpiresAt(ISO-8601) }`(§2). 실패 2~4는
  모두 단일 코드 AUTH_003(401) — loginId 존재 여부가 응답으로 구분되지 않아야 함(SEC-007 열거 완화).
유형: 기능
[검증] 정합. AuthService.login: 부재·해시불일치·isDeleted 모두 AUTH_003 단일화
  (AuthServiceUnitTest 3케이스). LoginResponse 3필드 계약 일치.

### QA-S-AUTH-04. 토큰 재발급 — 회전
사전 조건: 로그인으로 유효 refresh 확보.
절차:
1. POST /api/v1/auth/refresh, body `{ refreshToken }`.
기대 결과: 200 `{ accessToken, refreshToken, accessExpiresAt }` — 회전된 신규 refreshToken 포함
  (§2 v1.1, D-070). 이전 refreshToken은 폐기(1회성).
유형: 기능
[검증] 정합. AuthService.refresh → RefreshTokenStore.rotate(Lua CAS)로 신규 저장·구 폐기,
  Rotation.refreshToken 반환. RefreshResponse 3필드 일치.

### QA-S-AUTH-05. refresh 무효·만료·재사용 → AUTH_004
사전 조건: (a) 임의 무효 문자열 (b) 이미 회전으로 폐기된 옛 refresh (c) 만료 TTL 경과분.
절차:
1. 각 케이스로 refresh 호출.
기대 결과: 모두 AUTH_004(401)(§2·§5). 재사용(b) 탐지 시 해당 refresh 세션 무효화(이후 그 세션의
  어떤 토큰도 실패).
유형: 기능
[검증] 정합. rotate empty → AUTH_004(AuthServiceUnitTest 회전실패). Lua 스크립트: 불일치 시
  DEL(세션 삭제)로 재사용 탐지. RefreshTokenStoreIntegrationTest(실 Redis) 존재.

### QA-S-AUTH-06. refresh 동시 회전 — 단일 승자
사전 조건: 동일 refresh 원문 1개.
절차:
1. 같은 refreshToken으로 8스레드 동시 refresh.
기대 결과: 정확히 1건 200(회전 성공), 나머지는 AUTH_004 + 재사용 탐지로 세션 무효화. 두 토큰이
  동시에 유효해지는 상태 없음(§2 회전 정책, domain-spec §8 단일 승자 원칙과 정합).
유형: 동시성
[검증] 정합. ROTATE_SCRIPT가 GET·비교·SET/DEL 단일 EVAL 원자 실행 → 두 번째는 REUSE로 무효화.
  019 보고: rotate 8스레드 동시성 테스트 보강.

### QA-S-AUTH-07. 로그아웃 — 세션 폐기·멱등·소유자 한정
사전 조건: 로그인 상태(access + refresh). 인증 필요 엔드포인트.
절차:
1. 유효 access + 자기 refresh로 logout → 204. 이후 그 refresh로 refresh 시도 → AUTH_004.
2. (멱등) 이미 폐기된 refresh로 재logout → 204(no-op).
3. 미인증(access 없음) logout → 401.
기대 결과: 성공 204 본문 없음(§2·§1.5). refresh 무효화 필수(SEC-006). 미인증 401(§1.2).
  타 사용자 refresh 제시는 폐기되지 않음(소유자 한정) — 계약은 오류코드 미규정, 멱등 204 허용.
유형: 기능
[검증] 정합. logout 204(@ResponseStatus NO_CONTENT, B-019). revoke는 userId 일치 시에만 DEL
  (소유자 한정), 불일치/형식위반 no-op. SecurityConfig: /logout은 anyRequest().authenticated().

### QA-S-AUTH-08. 입력 검증 — 경계값
사전 조건: 게이트웨이 경유.
절차:
1. signup: loginId 51자 / nickname 31자 / password 73자 / 빈 필드 각각.
2. login·refresh: 필수 필드 누락.
기대 결과: 400 + `errors:[{field,reason}]`(§1.4). 상한은 erd 정합(loginId 50·nickname 30·password 72).
유형: 경계값
[검증] 정합. SignupRequest @Size(loginId 50·nickname 30·password 72)·@NotBlank, Login/Refresh
  @NotBlank. 전역 검증 핸들러가 400 + errors 반환(§1.4).

---

## 정적 검증 종합 (QA-S-AUTH, api-contract v1.2 §2 기준)

- 경로·메서드: signup·login·refresh·logout 4종 모두 계약 경로·HTTP 메서드 일치.
- 요청·응답 스키마: 4종 body·응답 필드 계약 일치(SignupResponse·LoginResponse·RefreshResponse·204).
- 상태 코드: 201/200/200/204 + 400/401/409 계약 §1.5 정합.
- 에러 코드: AUTH_001~004 코드·HTTP status 계약 §5 일치. AUTH_005(관리자 403)는 관리자 API(§4.5)
  단계 코드라 G4-1 범위 밖 — 미구현 정상.
- 동시성: 중복가입 UK 안전망·refresh 회전 원자성(Lua CAS) 계약 회전 정책·domain-spec §8과 정합.
- 결함: G4-1 auth 범위 계약 위반 0건. 관찰 OBS-1(password min)·OBS-2(로그인 타이밍)은 비결함
  (defects.md).
- 잔여(동적 재실행 권장): accessExpiresAt·envelope timestamp가 ISO-8601 UTC 문자열로 직렬화되는지
  런타임 확인(§1.4). 정적으로는 Instant 타입이라 Jackson 설정 의존 — 통합 테스트 jsonPath로 확인 권장.
