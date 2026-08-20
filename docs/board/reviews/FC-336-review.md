# FC-336 구현 리뷰

## 판정
- passed (2026-08-20)
- critical 0건, major 0건, minor 2건

## 확인
- 최초 cross-node MESSAGE_CREATED의 room·sequence·sender·본문·방향을 확인한다.
- 동일 eventId Kafka consume 두 건의 ack와 2초 bounded polling 동안 추가 STOMP 전달 0건을 검증한다.
- 구현 계약은 변경하지 않고 테스트 기대만 eventId dedup 정본에 맞췄다.

## Minor
1. 최초 전달 envelope와 replay outbox의 eventId 동일성을 직접 단언하면 의도가 더 명확하다.
2. FC-336 검증은 고정 sleep에 의존하지 않지만 기존 STOMP 연결 helper에는 300ms sleep이 남아 있다.
