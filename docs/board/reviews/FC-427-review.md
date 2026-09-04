# FC-427 공개 운영 데모 접속 통합 리뷰

최종 판정: **passed**  
검토일: 2026-09-04

## Major

### SEC-012. DEMO WebSocket이 Redis lease 검증과 조기 폐기를 우회한다
- `ChatStompAuthenticationInterceptor`가 서명·만료만 확인해 해제된 DEMO 토큰과 Redis 장애에서도 CONNECT를 허용한다.
- DEMO CONNECT 시 userId·demoLeaseId lease를 fail-closed 검증하고 principal 의미를 보존해야 한다.

### SEC-013. 중앙 read-only 정책이 모든 GET을 허용한다
- `DemoReadOnlyFilter`가 경로와 무관하게 GET·HEAD·OPTIONS를 허용해 신규 API 기본거부 계약을 위반한다.
- 승인된 조회 경로 allowlist와 미등록 GET 거부 테스트가 필요하다.

### SEC-014. DEMO 401에서 프론트 세션과 사용자 캐시가 폐기되지 않는다
- refreshToken이 null이면 refresh 분기만 건너뛰고 access token·사용자·React Query 캐시가 남는다.
- DEMO 401은 즉시 전체 로컬 세션을 원자 폐기해야 한다.

### SEC-015. 데모 발급 후 GET /me 실패 시 lease가 누수된다
- 발급 성공 뒤 프로필 조회가 실패하면 DELETE demo-session 없이 로컬 상태만 지워 최대 20분 풀이 고갈된다.
- 발급 토큰으로 best-effort 종료 후 로컬 상태를 지워야 한다.

### SEC-016. 초기화 실패 보상 작업이 독립 실행되지 않는다
- quarantine 실패가 뒤의 release를 건너뛰게 해 오염 계정이 TTL 뒤 재할당될 수 있다.
- quarantine과 compare-and-delete release를 독립 수행하고 안전한 재사용 방지 전략을 검증해야 한다.

## Minor

### QA-012. Redis Lua 동시성의 실제 Redis 검증이 없다
- 8개 동시 할당·9번째 고갈·동일 계정 경합·양방향 불일치·compare-and-delete·TTL 경계를 실제 Redis로 검증해야 한다.

### QA-013. active/quarantine gauge가 Redis 실제 상태와 어긋난다
- 자연 만료·프로세스 재시작·격리 해제에서 메모리 gauge가 실제 Redis 상태를 반영하지 않는다.

### QA-014. 채팅 화면에서 데모 안내와 종료 버튼이 숨겨진다
- `/chat`에서도 읽기 전용·남은 시간·종료 수단을 확인할 수 있어야 한다.

## 정상 확인
- DEMO claim 불완전 조합·서명 고정, HTTP lease fail-closed, Lua 양방향 원자 비교, NORMAL 전용 일반 로그인, refresh 미발급, 쓰기 및 STOMP SEND 차단, gateway rate limit, Retry-After, migration 기본값, 버튼 중복 클릭, 시크릿·고카디널리티 태그는 정상이다.

## 축소 계약 재리뷰

### SEC-017. 환전 쓰기 차단 경로가 누락됐다
- 실제 `POST /api/v1/exchanges`가 위험 쓰기 목록에 없어 공용 DEMO 계정의 자산을 변경할 수 있다.

### SEC-018. DEMO 발급 시 소셜 신원 부재를 검증하지 않는다
- DEMO 사용자에 `user_social_account`가 연결돼도 토큰을 발급하므로 계약의 credential·social identity 부재 조건을 위반한다.

## 최종 재검증
- SEC-017: `/api/v1/exchanges`를 포함한 위험 쓰기 전체와 허용 예외를 표 기반 테스트 21건으로 고정해 해소했다.
- SEC-018: 소셜 신원 존재 여부를 발급 전에 검사하고 계정 무결성 경계 테스트 24건으로 해소했다.
- backend 관련 45건, backend/gateway checkstyle, frontend 집중 테스트 35건이 통과했다.
- critical·major·minor 잔여 발견 없음. reviewer 최종 판정 `passed`.
- 에픽 완료 직전 온디맨드 `/security-review` 기능은 현재 세션 도구에 제공되지 않아 별도 실행하지 못했으며, reviewer의 인증·인가 통합 보안 재검증으로 대체 기록한다.
