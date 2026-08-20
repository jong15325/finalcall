# FC-330 / KAN-374 재리뷰

## 판정

**PASSED — Done 가능.** Critical 0건, Major 0건, Minor 1건이다. 기존 Major 2건은 해소됐으며 신규 차단 이슈는 발견하지 못했다.

## 해소된 기존 Major

### 1. 성공 전 dedup claim 소모 — 해소

- 위치: `backend/src/main/java/com/finalcall/domain/chat/listener/ChatRedisFanoutListener.java:58-77`, `ChatFanoutEventDeduplicator.java:30-53`
- 확인: claim은 in-flight로 생성되고 hydration과 전송이 모두 성공한 뒤에만 completed로 전환된다. hydration 또는 dispatch에서 `RuntimeException`이 발생하면 in-flight claim을 release하므로 Kafka가 Redis로 재발행한 동일 event가 재시도될 수 있다.
- 동시성: `claim`·`complete`·`release`가 모두 synchronized이고, completed claim은 release가 제거하지 않아 성공 event의 중복 hydration을 막는다.
- 테스트: hydration 실패 및 dispatch 실패 후 동일 event가 다시 hydration/dispatch되는 회귀 테스트가 추가됐다.

### 2. STOMP dispatch까지 read-only transaction 유지 — 해소

- 위치: `backend/src/main/java/com/finalcall/domain/chat/listener/ChatFanoutHydrator.java:25,40-53`, `ChatRedisFanoutListener.java:68-77`, `ChatFanoutDelivery.java:5-6`
- 확인: 별도 Spring bean인 `ChatFanoutHydrator.hydrate`가 read-only transaction 안에서 DB 정본을 검증하고 불변 delivery 목록만 구성한다. 메서드가 반환되어 transaction proxy가 종료된 다음 listener가 `SimpMessagingTemplate`로 전송한다. 외부 메시징 지연이 DB transaction/connection을 붙잡지 않는다.
- 수신자 없음 경로: local recipient 판정이 claim과 hydrator 호출보다 앞서므로 repository/transaction 진입이 없다.

## Minor

### 1. 실제 Spring transaction과 Kafka→Redis 통합 경계를 직접 계측하는 테스트는 여전히 없다

- 위치: `backend/src/test/java/com/finalcall/domain/chat/listener/ChatRedisFanoutListenerTest.java:47-104`, `ChatFanoutHydratorTest.java:31-62`
- 현재 증거: listener 단위 테스트는 hydrator mock 미호출과 실패 재시도를 검증하고, hydrator 테스트는 직접 생성한 객체로 delivery 구성을 검증한다.
- 남은 공백: 실제 proxy 환경에서 무수신 시 transaction 시작 0회·수신 시 read-only transaction 1회·dispatch 시 transaction 비활성을 계측하지 않는다. `Redis와 Kafka` 테스트도 같은 Redis listener를 두 번 호출하여 Kafka consumer→Redis publisher→listener 연결 자체는 직접 실행하지 않는다.
- 영향: production 구조상 외부 bean 프록시와 Kafka의 Redis 재발행 경로가 코드로 명확하고 관련 테스트/checkstyle이 통과했으므로 차단하지 않는다. 다만 향후 bean 배선 또는 transaction 경계 회귀를 더 강하게 막으려면 통합 테스트로 고정하는 편이 좋다.

## 부분 dispatch 실패 후 중복 판정

- 시나리오: 첫 recipient 전송은 성공하고 두 번째 전송이 실패하면 claim이 release된다. 후속 Kafka/Redis 재전달에서 첫 recipient도 같은 event를 다시 받을 수 있다.
- 판정: **허용되는 at-least-once 중복**이다. `chat-domain-spec.md:314-315`는 fast-path와 CDC-path의 중복 전파를 허용하고 클라이언트가 `eventId` 및 `(roomPublicId, roomSequence)`로 dedup하도록 명시한다. 읽음 event도 단조 `max`, 차단 event도 상태값 없는 invalidate 형상이어서 재적용 안전하다.
- 기대와 실제: 전달 성공 여부를 recipient별로 원자적으로 알 수 없는 best-effort STOMP 경계에서는 일부 수신자의 중복보다 실패 수신자의 영구 누락을 피하는 것이 계약에 맞다. 이번 release 동작은 그 의미론과 정합한다.

## 보안·QA·동시성 확인

- Kafka fallback은 metadata를 Redis로 재발행하므로 fast-path와 동일 listener/dedup 경로를 사용한다.
- `localRecipients` production 값은 `Set.copyOf` snapshot이며 hydration 결과도 `List.copyOf`/불변 record다.
- Redis recipient 두 명을 DB room participant 집합과 재대조하고 message sender·reader·block actor의 participant 여부를 검증한다.
- `BLOCK_CHANGED`는 차단 방향/상태를 노출하지 않고 invalidate용 `changedAt`만 전달한다.
- message 원문은 DB hydration 뒤 STOMP delivery에만 포함되며 Kafka/outbox/Redis metadata-only 경계가 유지된다.
- AOP self-invocation, 분산락, JWT/IDOR, 시크릿, 무관 리팩터·포맷 변경의 신규 문제는 발견하지 못했다.
