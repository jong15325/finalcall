# FC-323 채팅 통합·장애·용량 검증 보고서

- 티켓: FC-323 / KAN-367
- 기준일: 2026-08-18
- 계약 정본: `docs/spec/chat-domain-spec.md` v1.0 §11~14, `docs/spec/api-contract.md` v1.27 §2.7
- 결론: 기능·장애 복구 핵심 경로는 검증했지만, 단일 로컬 앱의 쓰기 처리량은 목표에 미달한다. 20,000 socket과 장시간 300/s·1,000/s는 미실측이므로 운영 용량 승인의 근거로 사용할 수 없다.

## 1. 검증 환경과 범위

| 항목 | 값 |
|---|---|
| 호스트 | Windows 11 Pro, Ryzen 9 7900 12C/24T, RAM 63.1 GiB |
| 런타임 | Microsoft OpenJDK 21.0.11, Docker Desktop 29.5.2 |
| 저장소 | 실제 MySQL 8 Testcontainers 또는 local Docker MySQL, Redis 7 |
| 실시간 통합 | 실제 Spring Boot 2개 context, native WebSocket/STOMP 1.2, 실제 JWT, Redis Pub/Sub |
| 부하 도구 | `grafana/k6:0.57.0` Docker 이미지 |
| 앱 부하 조건 | local profile 단일 JVM, port 18088, MySQL/Redis local Docker, Kafka consumer/검색/worker 비활성 |

테스트용 사용자는 공개 REST signup/login으로 만들었고 JWT와 방 ID fixture는 저장소 밖 임시 파일에만 기록했다. 부하 수치는 로컬 단일 JVM과 로컬 컨테이너 조합의 관찰값이며 production topology 외삽값이 아니다.

## 2. 자동 통합 검증

### 2.1 실제 REST → DB/outbox → Redis → STOMP

`ChatRealtimeInteropIntegrationTest`가 다음 경로를 한 테스트에서 연결한다.

1. node 2에 실제 JWT `CONNECT` 후 `/user/queue/chat.events`를 구독한다.
2. node 1 REST에서 direct room과 메시지를 생성한다.
3. MySQL `chat_message` 1행과 `chat_event_outbox` 2행을 확인한다.
4. AFTER_COMMIT fast-path가 Redis Pub/Sub에 metadata envelope를 발행한다.
5. node 2가 DB에서 본문을 hydration하고 recipient 관점 `ChatEventResponse`를 STOMP로 전송한다.
6. `eventId`, `eventVersion=1`, `roomPublicId`, `eventType`, `occurredAt`, `payload.message`, `sentByMe=false`, `roomSequence`를 frontend 계약과 비교한다.

같은 `clientMessageId` 재시도는 새 요청 `201` 뒤 재시도 `200`, `deduplicated=true`, DB/outbox 행 증가 없음으로 확인했다. block/unblock은 각각 `204 No Content`를 확인했다.

### 2.2 멀티노드·재연결·중복/순서 복구

- 서로 다른 실제 Spring Boot context가 같은 MySQL/Redis를 공유한다. node 1 REST write가 node 2의 user destination session으로 전달됐다.
- node 2 session을 끊고 node 1로 재접속한 다음 node 2에서 REST write하여 반대 방향 fan-out과 sequence 2를 확인했다.
- 같은 Kafka outbox record를 listener에 두 번 넣었을 때 같은 `eventId`가 at-least-once로 두 번 전달됐지만 DB 메시지는 한 행이었다.
- `afterSequence=0` REST gap 조회가 중복 event와 무관하게 sequence 1 한 행으로 수렴했다.
- 이는 별도 OS process/node kill이 아니라 한 JVM 안의 독립 Spring context 2개 검증이다.

### 2.3 Redis 장애/복구

실제 Redis Testcontainer를 pause한 상태에서 REST 메시지 생성이 `201`이고 message/outbox가 커밋되며 실시간 event는 오지 않음을 확인했다. Redis unpause와 subscriber 복구 후 같은 outbox의 Kafka replay 경로가 STOMP를 복구했고 REST gap에도 한 행만 존재했다.

검증 중 Redis `convertAndSend`가 subscriber 0명인데도 성공으로 반환되어 Kafka offset을 ACK할 수 있는 결함을 발견했다. publisher는 수신 node 수가 1 이상일 때만 성공하도록 수정했다. Redis 예외, `null`, 0명, 1명 이상을 회귀 테스트한다.

### 2.4 인증·목적지·종료 계약

- 유효 JWT `CONNECT`가 실제 user principal과 user destination을 만든다.
- 위조 JWT의 실제 socket은 best-effort `COMMON_005` ERROR frame 후 WebSocket close code `1008`로 종료한다. ERROR frame 자체는 계약대로 보장하지 않는다.
- query token, Origin 누락/불일치, STOMP 협상 헤더 누락, 임의 destination, `SEND`, non-auto ACK는 interceptor 테스트가 거절한다.
- 인증 실패로 socket이 닫힐 때 생성되는 synthetic `DISCONNECT`를 다시 인증 거절하던 결함을 수정해 이중 close 경고를 없앴다.

### 2.5 REST/DB 경합과 입력 계약

- 같은 방 20개 동시 전송: sequence 1..20 연속/유일, 본문 보존, message 20행/outbox 40행.
- 서로 다른 방 8개 × 5개 병렬 전송: 각 방 sequence 1..5, 전역 sequence/전역 lock 없음.
- 같은 멱등 키 12개 동시 retry: message 한 행, 동일 public ID, 신규 결과 한 건. 다른 본문 재사용은 `CHAT_004`/409.
- send/block 경합: 방 row lock 순서 중 하나로 선형화되고 block 뒤 양방향 신규 전송은 `CHAT_005`.
- read 24개 중복/역순/동시 갱신: 최댓값으로만 전진하며 room 범위 초과는 `CHAT_006`.
- 쌍방 room 동시 생성: room 한 행, member state 두 행.
- 비참여자의 room/history/send/read/report는 `CHAT_001` 404로 통일한다.
- REST 메시지 burst 제한은 `CHAT_009`/429와 `Retry-After`를 함께 반환한다.
- body는 1,000 Unicode code point를 허용하고 1,001 code point와 금지 C0 control을 `COMMON_001`로 거절한다. HTML은 서버가 해석하지 않고 원문 DTO로 반환한다.

## 3. chat-domain-spec §14.3 추적표

| # | 상태 | 근거/미달 |
|---:|---|---|
| 1 | 통과 | 실제 MySQL 동시 20건, sequence·본문·sender/outbox 정합 |
| 2 | 통과 | 실제 MySQL 8 rooms × 5 writes, 방별 sequence 독립 |
| 3 | 통과 | 같은 키 12개 동시 retry 한 행/같은 응답 |
| 4 | 통과 | 같은 키 다른 본문 `CHAT_004`/409 |
| 5 | 통과 | send/block 동시 경합 후 차단 상태에서 전송 0 |
| 6 | 통과 | read 24개 동시/역순 갱신 단조성 |
| 7 | 부분 | send가 발신자 lastRead를 새 sequence로 전진시키는 구현 경로는 기존 API 테스트에서 관찰되나, 별도 고립 테스트로 자기 unread=0을 직접 단언하지 않음 |
| 8 | 통과 | 쌍방 동시 room 생성 한 room/두 state |
| 9 | 통과 | 비참여자 5개 하위 경로 전건 404 |
| 10 | 통과 | 실제 Redis pause 중 DB 성공, unpause 후 replay+gap 복구 |
| 11 | 부분 | Kafka listener duplicate/nack/replay와 fast-path는 검증. 실제 broker/Connect process 중단과 binlog backlog catch-up은 미실측 |
| 12 | 미실측 | DB commit 직후 실제 app process kill 및 CDC 발견 검증 없음 |
| 13 | 부분 | fast-path+동일 Kafka record 중복과 REST sequence 수렴 검증. frontend store의 역순 event 렌더링은 이 backend 범위 밖 |
| 14 | 통과 | 독립 app context 두 개, 타 node user session fan-out 및 반대 node 재접속 |
| 15 | 미실측 | 실제 느린 socket/send buffer 초과 종료와 다른 session 무영향 검증 없음 |
| 16 | 미달 | 100 socket만 통과. 300/s·1,000/s 짧은 부하도 SLO/처리량 목표 실패. 20k/장시간 미실측 |
| 17 | 통과 | body boundary/control/XSS, 목적지, Origin, query token, JWT 위조와 1008 |
| 18 | 미실측 | 실제 retention batch가 online p95/replica lag에 미치는 영향 미검증 |

## 4. 단계 부하 결과

### 4.1 측정값

| 시나리오 | 요청/연결 | 성공 정확성 | 실효량/지연 | 판정 |
|---|---:|---:|---|---|
| write 50/s, 30s | 1,501 | 201 100% | 49.99/s, p95 34ms, avg 27.18ms, max 121ms | 단계 통과 |
| write 150/s, 30s | 4,501 | 201 100% | 149.91/s, p95 32.1ms, avg 27.11ms, max 53ms | 단계 통과 |
| write 300/s, 30s | 8,521 완료, 479 drop | 완료분 201 100% | 실효 262.0/s, p95 2.80s, avg 1.48s, max 6.13s | 목표 실패 |
| burst 1,000/s, 10s | 4,552 완료, 5,450 drop | 완료분 201 100% | 실효 259.9/s, p95 8.01s, avg 5.29s, max 10.29s | 목표 실패 |
| STOMP 100 VU, 12s, 1 socket/user | 200 sessions | CONNECTED 100%, upgrade 100% | CONNECT p95 194.05ms, max 202ms | 단계 통과 |
| STOMP 100 VU, 12s, 3 sockets/user, 즉시 재연결 | 204 sessions | CONNECTED 98.03% | CONNECT p95 220ms | 스트레스 관찰: 종료 lease 정리와 즉시 reconnect가 겹쳐 quota 거절 가능 |

300/s와 1,000/s에서 HTTP 오류는 없었지만 open-model arrival rate를 따라가지 못해 VU와 queueing latency가 증가하고 iteration이 drop됐다. 따라서 "응답된 요청 100% 성공"을 용량 목표 통과로 해석하면 안 된다. 이 환경의 관찰 포화점은 약 260 write/s이며 300/s p95≤200ms SLO도 실패했다.

### 4.2 외삽 제한

- 50→150/s 구간의 평탄한 latency를 300/s 이상으로 선형 외삽할 수 없다. 실제로 300/s에서 비선형 queueing이 발생했다.
- 100 socket의 file descriptor, heap, heartbeat, Redis lease 비용을 20,000 socket으로 단순 200배 환산할 수 없다.
- 20,000 socket에는 계약상 최소 6,667개 JWT 사용자 fixture, OS ephemeral port/file descriptor 조정, gateway 포함 다중 node, 별도 부하 발생기가 필요하다.
- 300/s 5분과 1,000/s 60초는 사용자별 5/s·60/min 제한을 보존하려면 각각 최소 1,500·1,000개 이상의 분산 사용자가 필요하고, 단일 호스트 결과는 production 승인 증거가 아니다.

## 5. 재현 스크립트

- `scripts/chat/prepare-chat-load-fixtures.ps1`: 실제 signup/login/direct-room API로 JWT fixture를 생성한다. `-ExistingRunId`로 생성 완료 후 파일 쓰기만 실패한 run을 멱등 재개할 수 있다.
- `scripts/chat/k6-chat-load.js`: `socket`, `sustained`, `burst`, `reconnect`, `all` 모드. 실제 STOMP CONNECT/SUBSCRIBE와 REST write를 사용한다.
- `scripts/chat/chat-chaos.ps1`: Redis/Kafka/Connect pause·unpause와 명시 node restart 절차.
- `scripts/chat/chat-load-fixtures.example.json`: 비밀값 없는 형상 예시.
- `scripts/chat/README.md`: 단계별 실행법과 production-scale 선행 조건.

예시:

```powershell
$env:CHAT_LOAD_PASSWORD = '<환경변수로만 주입>'
.\scripts\chat\prepare-chat-load-fixtures.ps1 `
  -UserCount 1500 -BaseUrl 'http://localhost:8080' `
  -OutputPath "$env:TEMP\chat-load-fixtures.json"

docker run --rm `
  -v "${PWD}\scripts\chat:/scripts:ro" `
  -v "$env:TEMP\chat-load-fixtures.json:/fixtures/chat-load-fixtures.json:ro" `
  -e CHAT_FIXTURE_FILE=/fixtures/chat-load-fixtures.json `
  -e CHAT_MODE=sustained -e CHAT_SUSTAINED_RATE=300 `
  -e CHAT_SUSTAINED_DURATION=5m grafana/k6:0.57.0 run /scripts/k6-chat-load.js
```

fixture에는 JWT가 있으므로 저장소에 두지 않고 실행 후 삭제한다. 메시지 본문/JWT는 테스트 로그나 보고서에 기록하지 않는다.

## 6. 발견 결함과 최소 수정

| 파일 | 원인 | 최소 수정 | 회귀 증거 |
|---|---|---|---|
| `ChatRedisFanoutPublisher.java` | Redis `convertAndSend` receiver count 0도 성공 처리하여 subscriber 재가입 전 Kafka replay를 ACK할 수 있음 | receiver count가 1 이상일 때만 성공 | `ChatRedisFanoutPublisherTest`, 실제 Redis pause/recovery integration |
| `ChatStompAuthorizationInterceptor.java` | 인증 실패 close가 만든 synthetic `DISCONNECT`를 미인증 frame으로 다시 거절 | `DISCONNECT`는 세션 정리 frame으로 선통과 | `ChatStompInterceptorTest`, 실제 forged JWT 1008 integration |

운영 처리량 미달은 이번 검증 티켓에서 구조/풀/스키마를 추측 수정하지 않았다. 단일 local 측정만으로 운영 코드를 튜닝하면 병목을 잘못 고정할 위험이 있어 별도 profiling·production-like 부하 티켓이 필요하다.

## 7. 잔여 검증과 출시 판정

기능 상호운용과 Redis 장애 복구 회귀는 통과했다. 그러나 용량 게이트는 통과하지 않았다. 출시 전 다음을 production-like 환경에서 수행해야 한다.

1. gateway와 실제 Kafka/Connect/Debezium을 포함한 2개 이상 OS process/node에서 broker/connector/node kill matrix.
2. 20,000 socket 10분 heartbeat, 1,000-user reconnect storm, slow client buffer 초과 격리.
3. 300 write/s 5분과 1,000/s 60초에서 DB commit p95≤200ms/p99≤500ms 및 dispatch hydration read 부하 동시 측정.
4. 100개 gap replay p95, app commit 직후 kill, outbox/binlog/Kafka catch-up lag와 무손실 증명.
5. 180일 message/report/outbox retention batch와 replica lag/online p95 영향.
6. 300/s 포화 구간의 thread/connection pool, room lock wait, MySQL statement, GC/JFR profiling 후 병목별 별도 수정·재측정.

## 8. 스타일·빌드 증거

- `:backend:spotlessApply :backend:checkstyleMain :backend:checkstyleTest`: 통과.
- 최초 `:backend:build`에서 전체 `:backend:test`는 실패 없이 완료됐으나, 이후 `checkstyleTest`가 빈 lambda 공백 2건을 적발해 build 명령 전체는 실패했다.
- 해당 한 줄 수정 후 `ChatStompInterceptorTest`: 통과.
- 수정 후 `:backend:build -x :backend:test`: 통과. 따라서 compile/package/spotless/checkstyle는 최종 상태에서 green이고, 전체 테스트는 직전 실행에서 green이다.
- 시간 내 최종 상태로 무필터 `:backend:build`를 한 번 더 실행하지는 못했다. 단일 명령 전체 green 증거가 필요하면 동일 환경에서 이를 재실행해야 한다.
