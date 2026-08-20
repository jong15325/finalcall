# 채팅 저장소·실시간 fan-out 브리핑

> 작성: 2026-08-19  
> 목적: 다음 세션에서 DB 선택 논의를 반복하지 않고 FC-329 성능 개선을 바로 이어가기 위한 작업 메모  
> 관련: EPIC-CHAT, FC-324, FC-329, `docs/spec/chat-domain-spec.md`, `docs/backend/fc-329-chat-release-validation.md`

## 1. 결론

- 메시지 영속 정본으로 MySQL을 사용하는 현재 방향은 적절하다.
- WebSocket은 연결·push, Redis Pub/Sub은 저지연 전달, Kafka는 내구성 있는 재전달 경로다. 이들은 사용자가 다시 접속했을 때 조회할 메시지 이력을 대신하는 정본 DB가 아니다.
- 메시지와 outbox는 성공 응답 전에 같은 DB transaction으로 한 번 저장한다. 실시간 수신자 전달은 commit 이후 수행하며 DB 접근을 최소화한다.
- 현재 300 write/s 실패는 MySQL INSERT 한계가 입증된 것이 아니다. 각 fan-out node가 로컬 수신자 유무를 보기 전에 transaction과 connection을 확보하는 증폭 구조가 가장 유력한 병목이다.
- 따라서 MySQL 교체보다 fan-out transaction 경계 수정과 중복 hydrate 제거가 선행이다.

## 2. 현재 메커니즘

```text
발신자
  └─ REST POST message
       └─ MySQL transaction
            ├─ 참여·차단·권한 확인
            ├─ room row lock / room sequence 증가
            ├─ message INSERT
            └─ outbox INSERT
                 └─ COMMIT 후 201
                      ├─ Redis Pub/Sub fast-path
                      └─ Debezium → Kafka durable fallback
                              └─ 수신 node hydrate
                                   └─ STOMP/WebSocket user queue
```

MySQL이 보관하는 정본은 방, 참여자, 메시지 본문, 방별 sequence, 읽음 위치, 차단, 신고, 멱등성 키와 outbox다. Redis 장애나 무구독 상태에서도 기록이 사라지지 않아야 하므로 Redis Pub/Sub을 정본으로 사용할 수 없다. Kafka는 outbox의 전달 복구와 소비 offset을 제공하지만 현재 REST history/replay 조회 모델의 정본은 아니다.

## 3. DB 저장 시점

“최종 메시지만 DB에 저장한다”는 말은 다음 의미로 해석한다.

1. 서버가 메시지를 수락한다.
2. message와 outbox를 하나의 transaction으로 영속화한다.
3. commit이 성공한 뒤 발신자에게 성공을 응답한다.
4. Redis/Kafka/WebSocket 전달은 commit된 메시지를 상대방에게 알린다.

WebSocket 전달 뒤 비동기로 DB에 저장하면 수신 화면에는 보였지만 장애 후 history에서 사라지는 ghost message가 발생할 수 있다. 따라서 최초 영속 쓰기는 동기 경계에 남기고, 이후 fan-out의 불필요한 read를 제거한다.

## 4. 측정된 병목

| 부하 | 결과 |
|---|---|
| 150/s, 30초 | 4,501건 전부 완료, drop 0, p95 198ms, p99 305ms |
| 300/s, pool 10×2 | 실효 182.86/s, drop 2,152, p95 8.59초 |
| 300/s, pool 30×2 | 실효 201.37/s, drop 2,023, p95 8.16초 |

두 앱의 Hikari connection 획득 누적 대기는 각각 약 32,978초와 32,971초, 최대 약 4.7초였다. 반면 connection 실제 사용 최대는 약 137ms와 123ms였다. pool 크기만 3배로 늘려도 목표에 도달하지 못했으므로 단순 pool tuning을 계속하지 않는다.

유력한 증폭 경로는 다음과 같다.

```text
Redis/CDC event 수신
  └─ read-only transaction 시작 + connection 확보
       └─ localRecipients() 확인
            ├─ 없음: 실제 hydrate는 없지만 connection 비용은 이미 발생
            └─ 있음: DB hydrate → WebSocket push
```

한 message가 `MESSAGE_CREATED`와 `READ_UPDATED`를 만들 수 있고, Redis fast-path와 CDC fallback이 동일 event를 다시 전달하며, 이를 2개 node가 각각 수신한다. 로컬 온라인 사용자가 없어도 이 조합이 DB connection 획득을 증폭시키면 쓰기 transaction과 같은 pool을 경합한다.

## 5. 다음 구현안

계약 변경 없는 최소 수정 목표는 다음 흐름이다.

```text
event 수신
  ├─ node-local eventId dedup
  ├─ local recipient 확인                 ← transaction 밖
  │    └─ 없음: 즉시 종료, DB 접근 0회
  └─ 있음
       └─ 별도 transactional hydrator    ← 짧은 read-only transaction
            ├─ 참여자·메시지 재검증
            └─ WebSocket push
```

필수 증거:

- 로컬 session이 없는 event에서 repository 호출 0회
- 가능하면 connection acquire 또는 transaction 시작 0회 metric
- 동일 event가 Redis와 Kafka에서 들어와도 hydrate 1회 이하
- 보안 경계 유지: 다른 방/차단 사용자/탈퇴 참여자에게 본문 미전달
- Redis 장애→Kafka replay→gap recovery와 no-loss 유지
- 150/s 회귀 후 300/s 짧은 단계 통과

## 6. 다른 선택지와 게이트 조건

### A. MySQL 유지 + fan-out 최적화 — 현재 권고

관계형 무결성, room sequence, idempotency, 차단·신고와 outbox 원자성을 유지하면서 가장 작은 변경으로 측정된 병목을 제거한다. 1:1 방은 쓰기가 여러 room으로 분산되므로 단일 공개 채널보다 row-lock hotspot 위험도 낮다.

### B. Redis에 message body 단기 cache

수신 node가 DB 대신 Redis에서 본문을 읽고 miss일 때만 DB fallback할 수 있다. 다만 개인정보 보관 위치, TTL, 암호화, eviction과 cache consistency 정책이 추가된다. A 적용 후에도 hydrate read가 병목으로 입증될 때만 검토한다.

### C. Redis/Kafka event에 최소 또는 암호화 payload 포함

read-after-write hydrate를 거의 없앨 수 있지만 현재 metadata-only 보안 계약을 변경한다. 로그·DLQ·topic retention에서 본문 노출 위험을 재검토해야 하므로 architect 영향 분석과 사용자 게이트2 승인이 필수다.

### D. 메시지 본문을 ScyllaDB/Cassandra로 분리

MySQL에는 방·참여자·권한·차단·신고를 남기고 메시지 timeline만 wide-column store로 옮기는 방식이다. 메시지가 수억~수십억 건, 지속 쓰기가 수천~수만 건/초로 증가하고 MySQL 자체 write/partitioning이 병목임이 측정될 때 검토한다. 현재 300/s 목표에서는 운영·백업·일관성·마이그레이션 복잡도가 이득보다 크다.

## 7. 대형 메신저 사례에서 가져올 원칙

- Discord는 MongoDB에서 Cassandra, 이후 수조 메시지 규모와 hot partition·운영 비용 문제로 ScyllaDB로 이동했다. 이는 FinalCall의 현재 규모보다 훨씬 큰 단계에서의 선택이다.
- Slack은 MySQL을 버리지 않고 Vitess를 사용해 메시지 데이터를 수평 샤딩했다. RDBMS도 적절한 분할과 라우팅으로 대규모 채팅을 지원할 수 있음을 보여준다.
- Meta Messenger는 전달 큐, read-through cache와 message history 저장 서비스를 분리했고 HBase에서 MyRocks로 이전했다. 핵심은 실시간 전달과 영속 저장의 역할 분리다.

참고:

- Discord, *How Discord Stores Trillions of Messages*: https://discord.com/blog/how-discord-stores-trillions-of-messages
- Slack, *Scaling Datastores at Slack with Vitess*: https://slack.engineering/scaling-datastores-at-slack-with-vitess/
- Meta, *Migrating Messenger storage to optimize performance*: https://engineering.fb.com/2018/06/26/core-infra/migrating-messenger-storage-to-optimize-performance/
- Meta, *Building end-to-end security for Messenger*: https://engineering.fb.com/2023/12/06/security/building-end-to-end-security-for-messenger/

## 8. 재검증 순서와 중단 기준

1. listener transaction 경계와 eventId dedup을 수정한다.
2. 로컬 수신자 없음에서 DB 접근 0회 테스트를 통과시킨다.
3. 실제 2 app + 2 gateway + MySQL + Redis + Kafka/Connect topology를 재구성한다.
4. 50/s와 150/s로 기능·지연 회귀를 확인한다.
5. 300/s 30초에서 drop 0과 계약 p95/p99를 확인한다.
6. 짧은 300/s가 실패하면 장시간·20k socket 시험을 중단하고 connection/transaction/event 증폭을 다시 계측한다.
7. 짧은 단계가 통과한 경우에만 300/s 5분, 1,000/s 60초, 20k sockets, reconnect storm, slow-client를 진행한다.
8. A 적용 후에도 DB write 자체가 병목으로 측정될 때만 B/C/D 중 하나를 게이트2 안건으로 올린다.

## 9. 내일 세션에서 피할 것

- 300/s 실패만으로 MySQL을 제거하거나 Cassandra/ScyllaDB를 바로 도입하지 않는다.
- connection pool 크기만 계속 올려 결과를 통과시키려 하지 않는다.
- Redis Pub/Sub을 메시지 정본으로 간주하지 않는다.
- metadata-only 계약을 조용히 변경해 Kafka/Redis에 본문을 싣지 않는다.
- 짧은 300/s 단계가 실패한 상태에서 20k socket·장시간 시험으로 시간을 소모하지 않는다.
