# FC-010 리뷰 — 화폐 도메인 통합 (EPIC-CURRENCY = FC-008 + FC-009)

대상: FC-008(UserBalance 원자 증감, 91e1138) + FC-009(교환·POST /exchanges, eb48b96) · reviewer 정식 통합 리뷰 · **통과 권고**
근거 스킬: concurrency-review(부록 C·동시성·멱등·JWT) · jpa-convention · coding-discipline. 기준: CLAUDE.md §4·5·7, api-contract §4.4, erd user_balance/money_exchange.

## 판정
review_status: **passed** (critical 0 · major 0 · minor 3)

## 검증 증거
- `./gradlew :backend:test` — **BUILD SUCCESSFUL**(JDK 21, Testcontainers 실 MySQL). FC-008/FC-009 슬라이스·통합·동시성 테스트 전건 그린.
- `./gradlew :backend:checkstyleMain :backend:checkstyleTest :backend:spotlessCheck` — **BUILD SUCCESSFUL**(스타일 위반 0).
- 무엇을 입증하는가:
  - `UserBalanceConcurrencyIntegrationTest`(THREADS=80 > CAPACITY=50): 병렬 캐시차감·홀드가 **정확히 용량만큼만 성공**(초과 30건 영향행 0), 잔액 음수 없음·초과 홀드 없음. 각 리포지토리 호출이 자체 트랜잭션으로 커밋되어 DB 행 락이 WHERE 조건을 직렬 평가함을 실증 — 조건부 원자 UPDATE의 정확성이 허구 통과가 아님.
  - `UserBalanceRepositorySliceTest`: 5연산 영향행수 시맨틱(=잔액/가용/홀드 경계에서 1, 1 초과 0)을 실 MySQL(`replace=NONE`, 부록 C-7 준수)로 검증.
  - `ExchangeConcurrencyIntegrationTest`(THREADS=8, 동일 key, 캐시 넉넉히 시드): 동시 중복 제출에서 **원장 1건 · 캐시 1회만 차감 · 게임머니 1회만 지급 · 8스레드 전부 승자 결과 반환(오류 0)**. 이중 차감 부재와 승자 재조회 정확성을 실증.
  - `ExchangeIntegrationTest`: 정상 201, replay 재차감 없음, EXC_001/EXC_002(422)·미persist·멱등키 미소비, 멱등키 누락 400(COMMON_001), 미인증 401(COMMON_005). 계약 §4.4 전 항목 커버.

## 심각도별 발견

### Critical / Major
- 없음.

### Minor (비차단 · 후속 위생)
1. **오버플로 → 500(불명확한 상태코드).** `ExchangeWriter.java:54` `Math.multiplyExact(cashAmount, rate)`는 `cashAmount`가 비현실적으로 클 때 `ArithmeticException`을 던지고, 이는 `ExchangeService`의 catch(오직 `DataIntegrityViolationException`)에 안 걸려 전역 핸들러 generic → **500**으로 나간다. `cashAmount`는 `@Positive`만 있고 상한이 없다(ExchangeRequest.java:17). 부수효과 **전에** 던져 상태 변경·정보 노출은 없어 안전하나(방어적 배치 양호), 계약에 정의 안 된 입력에 5xx를 주는 건 위생상 아쉽다. 제안: `cashAmount`에 `@Max` 상한(예: 잔액 상한 이하) 또는 오버플로를 400/422로 매핑. 후속 티켓 권고.
2. **`ExchangeService` 클래스레벨 `@Transactional(readOnly=true)` 미부착 — 의도된 규약 예외.** jpa-convention의 "서비스 클래스레벨 readOnly 트랜잭션"에서 벗어나나, replay 선검사·경쟁 승자 재조회가 각각 자동커밋(새 스냅샷)으로 돌아야 승자 커밋을 보고, 쓰기 트랜잭션이 `ExchangeWriter`에서 독립 롤백돼야 이중 차감이 없기 때문이다(클래스 주석에 명시). **정당한 예외이며 결함 아님** — 규약 일탈이 문서화·검증됨을 확인차 기록.
3. **`DataIntegrityViolationException` 광의 catch.** `ExchangeService.java:61` 은 멱등 UK 위반 외 다른 무결성 오류(FK 등)도 잡아 승자 재조회를 시도할 수 있다. 다만 재조회 실패 시 `orElseThrow(INTERNAL_ERROR)`(500)로 드러나므로 정합은 깨지지 않는다(도달 불가 경로를 500으로 표면화). 현 스키마상 이 경로의 유일 발생원은 (user_id, key) UK라 실질 위험 없음 — 이론적 지적.

## flagged 3건 판정 (총괄 인계 — 명시 판정)

**(a) `GlobalExceptionHandler`에 `MissingRequestHeaderException`→400 추가(전역 공유 파일) — 안전·적정한가?**
→ **안전·적정.** 기존 `handleBadRequest` 그룹(타입 불일치·바디 파싱·필수 파라미터 누락)에 필수 헤더 누락을 합류시킨 것으로, 이전엔 generic Exception 핸들러 → 500으로 새던 것을 400 INVALID_INPUT(COMMON_001)으로 **정상화**한다. 필수 헤더 누락은 명백한 클라이언트 오류라 400이 계약 §1.5 관례에 부합. 다른 엔드포인트 부작용: 현재 `@RequestHeader(required=true)` 사용처는 Idempotency-Key 뿐이며(Authorization은 시큐리티 필터 담당), 500 동작에 의존하는 코드 없음. **엄밀히 개선이며 회귀 위험 없음.** `ExchangeIntegrationTest.멱등키_누락은_400이다`로 커버.

**(b) `ExchangeDirection.GAME_TO_CASH` enum 값만 추가(로직 미구현) — 과설계인가 계약준수인가?**
→ **계약준수(정당).** 과설계 아님. 계약 §4.4는 EXC_002 "역방향 미지원 422"를 명시한다. 잘 형성된 `"GAME_TO_CASH"` 요청을 **422/EXC_002**로 돌리려면 enum이 이를 파싱 성공값으로 받아들인 뒤 비즈니스 규칙에서 거부해야 한다. enum 값이 없으면 Jackson 파싱 실패 → 400이 되어 계약과 **모순**된다. 즉 "형식은 옳으나 미지원(422)"과 "알 수 없는 문자열(400)"을 구분하기 위한 **계약상 필수 표현**이다. coding-discipline 원칙 2(요청된 것만) 위반 아님 — 투기 기능이 아니라 계약 준수 최소 표현. `역방향은_422_EXC_002` 테스트로 커버.

**(c) `ExchangeWriter` 별도 빈 설계의 정당성 —?**
→ **정당·모범적.** 두 근거 모두 유효: (1) **AOP self-invocation 회피(부록 C-1)** — `write()`가 `ExchangeService` 내부 메서드였다면 `exchange()`에서의 자기호출이 프록시를 안 타 `@Transactional`이 무력화된다. 별도 빈이라 프록시 트랜잭션이 실제 적용된다. (2) **트랜잭션 경계·롤백 격리(부록 C-3)** — 캐시 차감+게임머니 지급+원장 insert를 단일 트랜잭션으로 묶어 UK 위반 시 차감까지 통째 롤백(이중 차감 없음)하고, 예외가 밖으로 전파돼 오케스트레이터가 장기 트랜잭션 없이 승자를 새 읽기로 재조회한다. 동시성 테스트가 이 설계의 정확성을 실증. **화폐 도메인에 정확히 맞는 패턴.**

## 확인된 정합 (요지)
- **동시성(FC-008)**: 5연산 모두 조건부 원자 UPDATE — decreaseCash(`cash>=amount`, 음수방지)·increaseGameMoney(무조건)·decreaseGameMoney/hold(`balance-held>=amount`, 가용이내·초과홀드방지)·release(`held>=amount`, 음수홀드방지). 전 메서드 `@Transactional`+`@Modifying(clear/flush)` — 부록 C-1(락-트랜잭션) 정합. 가용=balance−held 불변식 유지.
- **멱등(SEC-004)**: (a) replay 선검사로 재차감 없음, (b) 동시 경쟁은 (user_id, key) 복합 UK로 하나만 커밋·패자 전체 롤백 후 승자 재조회(자동커밋 새 스냅샷 → 승자 커밋 가시), (c) 실패(EXC_001/002)는 부수효과 전/중 예외로 롤백 → 원장 미persist·키 미소비. REPEATABLE READ 가정: 오케스트레이터에 surrounding 트랜잭션이 **없어** 각 재조회가 새 트랜잭션 스냅샷을 얻으므로 승자 커밋을 본다 — 가정 정확.
- **잔액 정합**: 오버플로는 `multiplyExact`로 방어(minor 1 참조), 음수는 조건부 UPDATE로 차단, `applied_rate`는 처리시점 rate 스냅샷(setScale(6)=DECIMAL(20,6) 일치, replay 응답과 일관), append-only 원장.
- **계약 §4.4**: 엔드포인트·201·응답 스키마(gameMoneyAmount/appliedRate)·EXC_001/002(422)·Idempotency-Key 필수 400 전건 준수. 상태코드 정합.
- **보안**: 주체=SecurityContext userId(B-009), X-User-Id 미신뢰(D-065). 멱등키 사용자 스코프 복합 UK라 타 사용자 키 충돌·리플레이 불가(IDOR 안전).
- **컨벤션**: Entity(BaseTimeEntity·PROTECTED·생성자 @Builder·@Setter 금지·append-only 정당)·Repository·Controller(ApiResponse·@Valid·try-catch 없음)·DTO(record·@Builder·from·Dto접미사 없음)·ErrorCode(EXC_{3자리})·Flyway V5(validate) 모두 정합. coding-discipline 원칙 3: 변경 라인 전부 티켓 추적, 무관 변경 없음(공유 파일 GlobalExceptionHandler 변경은 최소·정당 — flagged (a)).

## 후속 권고 (비차단, 향후 티켓)
- minor 1: `cashAmount` 상한(@Max) 또는 오버플로 400/422 매핑으로 5xx 제거.
- (참고) minor 2·3은 결함 아님 — 의도된 설계 예외로 기록만.
