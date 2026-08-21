# FC-324 실시간 채팅 통합 리뷰

- 판정: CHANGES REQUESTED
- 심각도: critical 0 / major 7 / minor 5
- 출시 판정: 차단
- 검토일: 2026-08-18

## Major
1. WebSocket session registry 전역 monitor+Redis I/O 직렬화와 300/s·1,000/s 성능 목표 실패.
2. 메시지 POST Gateway IP 120/분 제한과 신뢰 프록시 client IP 경계 누락.
3. Redis 장애 중 신고 일일 10건 DB 한도가 동시 요청에서 원자적이지 않음.
4. 프론트 역순·gap 이벤트가 방 미리보기와 비선택 방 unread를 잘못 갱신.
5. 메시지 180일·outbox 7일·신고 snapshot 3년 retention worker 누락.
6. outbox lag 지표가 멀티노드 consumer group을 반영하지 못하고 계약 metric 대부분 누락.
7. 실제 Kafka/Connect/Debezium/process kill/slow-client 장애 복구 계약 미검증.

## Minor
- JWT exp 실제 1008 종료 미검증, 오프라인 큐 휘발성, timeline live/scroll/reduced-motion, Gateway 공유비밀 constant-time 비교, 최종 build·contract_ref 추적 공백.

## 양호
- CONNECT JWT, strict Origin/query token 차단, user destination only, REST IDOR 404, room lock/sequence/멱등, Kafka ACK-after-Redis, metadata-only 본문 비노출, React text rendering과 dialog focus 처리는 적절하다.

## 최종 재판정 (2026-08-22)

- 판정: `CHANGES REQUESTED / RELEASE BLOCKED`
- FC-341 전송 응답 후속 조회 제거 구현 자체는 기능·보안·동시성 회귀 없이 통과했다.
- self-hosted run `32503805495`에서 10→50→150→300/s와 300/s 5분은 모두 통과했다.
- 1,000/s burst는 완료 57,757건, drop 2,243건, HTTP 실패 1,479건, p95 3,799ms,
  p99 4,184ms, Hikari timeout 1,351건으로 §14.3을 위반했다.
- burst 실패로 socket 100→1,000→5,000→20,000 단계는 계약대로 실행하지 않았다.
- FC-329가 최종 성능 DoD를 충족하지 못했으므로 FC-324와 EPIC-CHAT 출시는 차단한다.
- 사용자 지시에 따라 추가 최적화·재진단 루프는 시작하지 않는다.
