# 게이트웨이 시나리오 (QA-S-GW, qa/rules.md §4)

대상: SCG 엣지 게이트웨이(D-068) — 라우팅·rate limit·직접접근 차단. 기준: api-contract **v1.4**
[1.6](엣지 오류 명세)·[5](GATEWAY_429·GATEWAY_403)·[2](rate limit 담당)·[1.2](인증 관문).
검증 대상: backend/outbox/021.
근거 줄 갱신 2026-07-15(D-092 3단): v1.3→v1.4 델타 검토 결과 **엣지 오류 영향 없음** — v1.4는
[2.5] 회원 리소스 신설분이라 [1.6]·[5] GATEWAY_* 조항 불변. 기대치·시나리오 무수정, 근거 줄만 갱신.

기대치 확정 이력: v1.2 시점 엣지 오류 포맷은 미명세라 계약 질의로 유보했으나(Q-002/CQ-1·CQ-2),
v1.3 §1.6 확정(065 전파)으로 근거 확보 → QA-S-GW-02·04 기대 결과를 아래와 같이 확정한다.
재검증(동적 실행)은 백엔드 게이트웨이 커스텀 에러 핸들러 구현 후(065 B 범위) — 현재 RETEST 대기(Q-003).

---

### QA-S-GW-01. 라우팅 — 경로 기반 프록시
사전 조건: 게이트웨이(8000) + 서비스(8080) 기동.
절차:
1. GET/POST /api/v1/** 를 게이트웨이로 요청.
기대 결과: 단일 서비스로 프록시되어 서비스 응답 반환. auth 경로는 rate-limited 라우트, 그 외
  /api/v1/** 는 service-proxy 라우트로 매칭(순서 우선).
유형: 기능
[검증] 정합. application.yml routes: auth-rate-limited(login/signup/refresh 우선) → service-proxy
  (/api/v1/**). 하류 주소 ${service.uri} 프로파일 주입. 계약상 별도 게이트웨이 라우팅 명세 없음 —
  구현 설계(B-026) 정합.

### QA-S-GW-02. rate limit — 인증 계열 429
사전 조건: 동일 클라이언트 IP.
절차:
1. /api/v1/auth/login(또는 signup·refresh)을 버스트 초과로 연속 호출(토큰버킷 소진).
기대 결과(확정, v1.3 §1.6·§5):
1. 상태 코드 429. 대상 경로 = login·signup·refresh(§2 "인증 계열은 엣지 게이트웨이 rate limit이
   담당"). logout은 대상 아님(인증 필요·열거 대상 아님).
2. 응답 본문 = 서비스와 동일 에러 envelope(§1.4 형식):
   `{ "success": false, "code": "GATEWAY_429", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }`.
3. `errors` 필드 **미포함**(§1.6 — 필드 검증 오류는 서비스 전용).
4. **`Retry-After` 헤더 동반**(§1.6 — 재시도 대기 안내). 프론트는 이 값 존중(065 F 완료 기준).
5. code 값은 정확히 `GATEWAY_429`(§5 표: rate limit 초과 → 429). 도메인 enum 1:1 예외(엣지 세팅).
유형: 기능
[현 구현 상태 — RETEST 대기] 라우트·키 해석기는 정합: RateLimitConfig clientIpKeyResolver(IP 키) +
  application.yml RequestRateLimiter(replenishRate 5·burst 10, 데모값)가 auth-rate-limited 라우트에만
  적용, 대상 3경로 §2 일치. 단 **429 본문·Retry-After는 미구현**(SCG 기본 응답 = 본문 없음) →
  v1.3 §1.6 미충족. 백엔드 커스텀 에러 핸들러 구현(065 B) 후 재검증. 현 시점 결함 아님(Q-003).

### QA-S-GW-03. 직접접근 차단 — 정상 경유 통과
사전 조건: 서비스 gateway.internal.enforced=true, 공유비밀 주입.
절차:
1. 올바른 X-Gateway-Token 헤더로 서비스 직접 호출.
기대 결과: 차단 통과 → 이후 인증 단계 진행(예: 없는 사용자 로그인 → AUTH_003 401). 게이트웨이가
  하류에 X-Gateway-Token을 set(덮어쓰기)하므로 클라이언트 위조 헤더는 무효.
유형: 기능
[검증] 정합. InternalTokenGlobalFilter가 HIGHEST_PRECEDENCE로 헤더 set(위조 선제거).
  GatewayAccessFilter가 JWT 필터보다 앞에서 검증. GatewayAccessIntegrationTest "올바른 헤더면
  통과(AUTH_003)" 통과.

### QA-S-GW-04. 직접접근 차단 — 헤더 부재·불일치 403
사전 조건: enforced=true.
절차:
1. X-Gateway-Token 없이 서비스 직접 호출.
2. 틀린 값으로 직접 호출.
3. /actuator/health, /error 는 헤더 없이 호출.
기대 결과(확정, v1.3 §1.6·§5):
1. 케이스 1·2 = 403(게이트웨이 미경유 직접접근 차단, X-Gateway-Token 불일치).
2. 응답 본문 = 에러 envelope, code는 정확히 **`GATEWAY_403`**(§5 표: 직접접근 차단 → 403).
   `{ "success": false, "code": "GATEWAY_403", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }`,
   `errors` 미포함(§1.6).
3. 케이스 3(/actuator/health·/error)은 차단 제외(정상 응답) — 헬스체크·프로브 경로.
4. 성격: 정상 경유 클라이언트는 만나지 않는 경로 → **QA·보안 음성 테스트 전용 기준**(§1.6,
   프론트 별도 처리 불요).
유형: 기능
[현 구현 상태 — RETEST 대기] 차단 동작·제외 경로는 정합: GatewayAccessFilter가 헤더 부재·불일치 403,
  actuator·/error shouldNotFilter 제외, JWT 필터보다 선행. GatewayAccessIntegrationTest 4케이스 통과.
  단 **code 값이 `COMMON_006`**(CommonErrorCode.FORBIDDEN)으로 v1.3 §5의 `GATEWAY_403`과 불일치 →
  §1.6 미충족. 백엔드 핸들러 구현(065 B) 시 GATEWAY_403으로 교체 필요. 통합테스트의 기대 코드
  (`COMMON_006`)도 함께 갱신 대상. 현 시점 결함 아님(Q-003 — 구현 미착수 할당분).

---

## 정적 검증 종합 (QA-S-GW, 021 범위 / 기준 v1.3)

- 기능(G4-1 PASS 확정분, 065 재실행 불요): 라우팅·rate limit 대상 경로·직접접근 차단 동작은 계약
  §2·§1.2와 정합. 인증 서비스 유지(D-065): 게이트웨이 JWT 검증·X-User-Id 미도입 확인.
- 엣지 포맷 델타(v1.2→v1.3, 이번 확정분): QA-S-GW-02·04 기대 결과를 §1.6·§5 기준으로 확정.
  CQ-1·CQ-2는 계약 근거 확보로 해소(계약 질의 종결) → RETEST-1·2(재검증 대기)로 전환(Q-003).
- 현 구현 대비 델타 2건(백엔드 065 B 구현 대상, 결함 아님 — 미착수 할당분):
  1. 429: 본문 없음(SCG 기본) → `GATEWAY_429` envelope + `Retry-After` 헤더 필요.
  2. 403: `COMMON_006` → `GATEWAY_403` 필요. GatewayAccessIntegrationTest 기대 코드도 동반 갱신.
- 재검증 조건(RETEST 트리거): 백엔드 게이트웨이 커스텀 에러 핸들러 완료 보고 수신 시. 실행 경로는
  D-078 손(Claude Code) — 총괄 순서 지정 대기.
- 재실행 시 보강 권장: 429 트리거(버스트 초과) 동적 테스트가 부재(021 기준 게이트웨이 통합테스트
  1건, 차단 위주). envelope·Retry-After 검증을 포함한 429 테스트 신규 필요.
