# FC-335 구현 리뷰

## 판정
- changes-requested (2026-08-20)
- critical 0건, major 3건

## Major
1. `ChatOutboxFastPathEvent`가 원본 payload 전체를 보유해 민감 필드 제거가 worker 경계 전에 강제되지 않는다.
2. shutdown timeout에서 queue 잔여 작업만 drop metric에 반영되고 실행 중 작업이 누락되며, interrupt 비협조 Redis 호출이 종료 뒤 남을 수 있다.
3. 단위 테스트가 실제 5초 Redis 지연에서 HTTP 응답과 JDBC connection 반환이 비차단임을 입증하지 않는다.

## 통과한 항목
- `afterCommit()` Redis I/O 제거, 유한 executor/queue와 `AbortPolicy`, rollback 0 enqueue 구조.
- rejection·worker RuntimeException의 요청 비전파, worker context 정리, 저카디널리티 metric, 설정 양수 검증.
- 대상 단위 테스트와 checkstyle 성공.

## 재검증 기준
- 민감 payload가 snapshot 생성 시 제거됨을 worker 인자 캡처로 증명한다.
- timeout 당시 실행 중+queue 잔여 작업의 drop 의미·metric과 종료 상한을 검증한다.
- 실제 트랜잭션/HTTP/JDBC 경계에서 Redis publish 5초 지연에도 응답·connection 반환이 기다리지 않음을 통합 테스트로 증명한다.

## 재리뷰 판정
- passed (2026-08-20)
- critical 0건, major 0건, minor 2건
- allowlist snapshot, queued+in-flight 원자 drop, 늦은 worker metric 억제와 daemon bounded shutdown을 확인했다.
- 실제 MySQL/MockMvc/Hikari 통합 테스트에서 Redis publish 5초 지연 중 HTTP 2초 이내 반환과 active connection 0 복귀를 확인했다.

## Minor
1. 비정상 JSON payload로 snapshot 생성이 실패하면 fast-path를 로그로만 생략하고 별도 drop/failure metric을 남기지 않는다. 정상 서비스 경로는 object metadata만 저장하므로 이번 범위의 통과를 막지 않는다.
2. 늦은 worker 완료 후 metric 억제 테스트가 고정 50ms 대기를 사용한다. CAS 구현 결함은 발견되지 않았으나 latch 기반 완료 확인으로 보강할 수 있다.
