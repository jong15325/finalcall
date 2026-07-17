상태: SENT
# [백엔드 → Claude Code] 작업 지시: gateway - 엣지 오류 envelope 핸들러 (계약 v1.3 §1.6)

대상: 엣지 오류(429·403) 응답을 계약 §1.6 envelope로 통일. **포맷 정합만** — 라우팅·rate limit 정책 무변경.

참조: api-contract **v1.3 §1.6**(정본 인용 아래)·§5(GATEWAY_429·GATEWAY_403 등재), D-068,
  B-026(멀티모듈 구조)·B-027(직접접근 차단), 총괄 065·067(QA 확정 기대치)

> **세션 주의**: 게이트웨이는 WebFlux, 서비스는 서블릿 스택이다. 이 작업은 양쪽을 모두 건드린다(§1.6이
> GATEWAY_403을 **서비스측** GatewayAccessFilter 소관으로 명시). 스택 혼동에 주의할 것.

## 계약 정본 (§1.6 인용)
```
형식: { "success": false, "code": "GATEWAY_NNN", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }
  errors 는 미포함(필드 검증 오류는 서비스 전용).
code 는 GATEWAY_ 프리픽스의 엣지 발생 코드로, 도메인 ErrorCode enum과 1:1 대상이 아니다(엣지 예외).
  envelope 포맷 자체는 서비스와 동일하며 변경하지 않는다.
- GATEWAY_429 rate limit 초과 → 429. 재시도 대기를 위해 Retry-After 헤더를 동반한다.
- GATEWAY_403 게이트웨이 미경유 직접접근 차단(X-Gateway-Token 불일치, 서비스측 GatewayAccessFilter) → 403.
```

## QA 확정 기대치 (067 — 이 기대치로 재검증된다)
- **QA-S-GW-02 (429)**: 상태 429 + 본문 `{success:false, code:"GATEWAY_429", message, timestamp}` +
  `errors` 미포함 + `Retry-After` 헤더 동반. 대상 = login·signup·refresh(§2). **logout 제외**.
- **QA-S-GW-04 (403)**: 상태 403 + code 정확히 `GATEWAY_403` + `errors` 미포함.
  actuator·`/error`는 차단 제외(현행 `shouldNotFilter` 유지).

## 범위 — 델타 3건 (067 관측, 이대로 처리)

### 델타 1. 429 본문·Retry-After 미구현 (gateway 모듈, WebFlux)
- 현행: SCG `RequestRateLimiter` 기본 동작 = 상태 429만, **본문 없음**.
- 처리: 429 응답에 §1.6 envelope 본문 + `Retry-After` 헤더를 부착.
- 구현 힌트: RequestRateLimiter의 429는 예외가 아니라 상태 세팅 후 완료라서 `ErrorWebExceptionHandler`로는
  안 잡힌다. 응답을 가로채는 `GlobalFilter`(응답 데코레이트, 상태 429 감지 시 본문·헤더 주입) 방향이 정석이다.
  필터 순서(rate limiter보다 바깥)에 주의. 다른 접근이 더 낫다고 판단되면 근거와 함께 보고할 것.
- gateway 모듈은 서비스의 `common.response.ErrorResponse`에 의존하지 않는다(B-026 독립 2앱, 공유 모듈 미도입).
  게이트웨이 자체에 동형 envelope DTO를 두고 직렬화한다. **필드명·순서·타입이 §1.6과 정확히 일치**해야 한다
  (`timestamp`는 ISO-8601 UTC = `Instant`).
- `Retry-After` 값은 rate limit 설정(replenish rate)에 정합한 초 단위. 정책값 변경 금지 — 헤더만 추가.

### 델타 2. 403이 COMMON_006 반환 (서비스 모듈, 서블릿)
- 현행: `infra/security/GatewayAccessFilter.writeForbidden()`이 `CommonErrorCode.FORBIDDEN`(=`COMMON_006`) 반환.
- 처리: `GATEWAY_403`으로 교체. `ErrorCode` 인터페이스를 구현한 **신규 enum**(예: `GatewayErrorCode`)을 두고
  `ErrorResponse.of(ErrorCode)` 기존 팩토리를 그대로 사용한다(envelope 포맷·`ErrorResponse` 무변경).
- **`CommonErrorCode`·도메인 ErrorCode enum은 건드리지 않는다**(065 완료 기준: "도메인 ErrorCode enum·서비스
  envelope 포맷은 무변경"). GATEWAY_ 는 §1.6이 명시한 1:1 예외다.
- 부수: `GatewayAccessIntegrationTest`의 기대 코드(`COMMON_006`) → `GATEWAY_403` 동반 갱신.

### 델타 3. 429 트리거 동적 테스트 부재
- 버스트 초과로 실제 429를 유발하는 테스트 신규 작성(gateway 모듈). Redis 필요 → Testcontainers.
- 검증: 상태 429 + envelope 4필드 + `errors` 부재 + `Retry-After` 존재.
- 기존 통합테스트 base의 `enforced=false` 관례 유지.

## 하지 말 것
- 라우팅·rate limit **정책**(replenish rate·burst·키 전략) 변경 — 065 범위 제한(포맷 정합만).
- `ErrorResponse`·`ApiResponse`·`CommonErrorCode`·도메인 ErrorCode enum 변경.
- 공유 common 모듈 신설(B-026 후속 — 지금은 재검토 대상 아님).
- member 도메인 작업(023·024 별개 단위). 계약 변경(발견 시 백엔드 대화 보고 → 6절).

## 구현 지침
- CLAUDE.md §4(의존 방향)·§5·§7 준수. `./gradlew spotlessApply` 후 checkstyle 통과.
- gateway 모듈 스타일은 자체 선언된 checkstyle/spotless 사용(B-026).

## DoD
- 계약 §1.6 + QA 기대치(QA-S-GW-02·04) 준수. 429/403 본문이 정확히 4필드, `errors` 미포함.
- `./gradlew clean build` 그린(두 모듈). 429 동적 테스트 포함.
- **완료 보고에 "QA RETEST-1·2 트리거" 1줄 명시**(067 총괄 지정 의무).

## 커밋 제안 (실행은 사용자 — 2커밋 분리 권장)
```
feat(gateway): 엣지 429 응답에 GATEWAY_429 envelope·Retry-After 추가

목적
- 엣지 rate limit 오류를 계약 v1.3 §1.6 envelope 로 통일(클라이언트 단일 포맷).

세부 내용 (영역별)
- gateway: 429 응답 데코레이트 GlobalFilter — envelope 본문 + Retry-After 주입
- gateway: 동형 envelope DTO(서비스 ErrorResponse 미의존, B-026 독립 2앱)
- test: 버스트 초과 429 트리거 동적 테스트(Testcontainers Redis)

검증
- ./gradlew clean build 그린. 429 본문 4필드·errors 부재·Retry-After 확인.

범위 밖(다음 단계)
- rate limit 정책값·라우팅(무변경), 관측성 게이트웨이 타깃(Stage G 확장)
```
```
fix(gateway): 직접접근 차단 403 코드를 COMMON_006 에서 GATEWAY_403 으로 정정

목적
- 계약 v1.3 §1.6 이 직접접근 차단을 GATEWAY_403 으로 명세 — 서비스측 필터 응답을 계약에 정합시킨다.

세부 내용 (영역별)
- infra/security: GatewayErrorCode(ErrorCode 구현) 신설, GatewayAccessFilter 가 GATEWAY_403 반환
- test: GatewayAccessIntegrationTest 기대 코드 갱신(COMMON_006 → GATEWAY_403)

수정 파일
  변경(M): infra/security/GatewayAccessFilter.java, test .../GatewayAccessIntegrationTest.java
  추가(A): infra/security/GatewayErrorCode.java

검증
- ./gradlew clean build 그린. CommonErrorCode·도메인 ErrorCode·ErrorResponse 무변경.

범위 밖(다음 단계)
- 없음
```
