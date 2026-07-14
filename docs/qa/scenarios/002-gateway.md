# 게이트웨이 시나리오 (QA-S-GW, qa-guide §4)

대상: SCG 엣지 게이트웨이(D-068) — 라우팅·rate limit·직접접근 차단. 기준: api-contract v1.2 §2
(rate limit 담당 명시)·§1.2(인증 관문). 검증 대상: backend/outbox/021.
주의: 엣지 오류 "응답 포맷"은 v1.2 미명세(v1.3 진행, 057) → 해당 기대 결과는 계약 질의로 처리(Q-002).

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
기대 결과(부분): rate limit 초과 시 429. 대상 경로 = login·signup·refresh(§2 "인증 계열은 엣지
  게이트웨이 rate limit이 담당"). logout은 대상 아님(인증 필요·열거 대상 아님).
기대 결과(계약 질의): **429 응답 본문 포맷**은 v1.2 미명세 → 확정 기대치 없음. Q-002/CQ-1로 격상,
  v1.3 확정 후 확정·재실행.
유형: 기능
[검증] 부분 정합. RateLimitConfig clientIpKeyResolver(IP 키) + application.yml RequestRateLimiter
  (replenishRate 5·burst 10, 데모값)가 auth-rate-limited 라우트에만 적용. 대상 3경로 계약 §2 일치.
  429 본문은 SCG 기본(본문 없음) 추정 — 계약 근거 부재로 결함 아님(CQ-1).

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
기대 결과(부분): 1·2는 403(게이트웨이 미경유 차단, §1.2 인증 관문 전제). 3은 차단 제외(200/정상)
  — 헬스체크·프로브 경로.
기대 결과(계약 질의): 403 **오류 코드**는 구현 관측 COMMON_006이나 §5 표에 미등재 → 확정 기대
  코드 없음. Q-002/CQ-2로 격상, v1.3(직접접근 403 명세 여부) 확정 후 확정·재실행.
유형: 기능
[검증] 부분 정합. GatewayAccessFilter: 헤더 부재·불일치 403 + ErrorResponse(COMMON_006),
  actuator·/error shouldNotFilter 제외. GatewayAccessIntegrationTest 4케이스(403 2건·통과·actuator)
  통과. 403 코드값 COMMON_006은 계약 근거 부재로 결함 아님(CQ-2).

---

## 정적 검증 종합 (QA-S-GW, 021 범위)

- 라우팅·rate limit 대상 경로·직접접근 차단 동작은 계약 참조 조항(§2 rate limit 담당·§1.2 인증
  관문)과 정합. 인증 서비스 유지(D-065): 게이트웨이 JWT 검증·X-User-Id 미도입 확인.
- 계약 공백 2건(CQ-1 429 본문·CQ-2 직접접근 403 코드)은 v1.2 미명세 → 결함 아닌 계약 질의(Q-002).
  이미 총괄 승인·v1.3 진행 중(056·057). v1.3 확정 시 GW-S-02·04 기대 결과 확정·재실행 필요.
- 결함: G4-1 게이트웨이 범위 계약 위반 0건(v1.2 기준).
- 잔여(동적 재실행 권장): rate limit 429 실제 트리거(버스트 초과)는 Redis 토큰버킷 실환경 재실행
  권장 — 게이트웨이 통합테스트는 021 기준 1건(차단 위주), 429 트리거 테스트 보강 여지.
