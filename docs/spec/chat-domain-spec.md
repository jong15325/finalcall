# Chat 도메인 스펙

> 상태: **v1.5 — APPROVED** (2026-08-21, FC-340 채팅 burst DB connection capacity 게이트2 승인 반영)
>
> EPIC-CHAT의 도메인·성능 정본이다. 외부 계약 정본은 `docs/spec/api-contract.md` v1.27,
> 스키마 정본은 `docs/spec/erd.md` v2.1이다.
> Vuexy 기반 채팅 워크벤치 디자인 게이트도 2026-08-18 승인됐으며 소비 티켓은 FC-317이다.

---

## 1. 목적과 범위

FinalCall 사용자 사이의 **1:1 텍스트 채팅**을 제공한다. 채팅 쓰기 성공의 의미는 MySQL에 메시지가
커밋됐다는 뜻이며, WebSocket·Redis·Kafka 전달 성공을 뜻하지 않는다. 실시간 계층 장애가 메시지 유실이나
쓰기 전면 중단으로 전파되지 않도록 DB 조회·재접속 복구 계약을 함께 정의한다.

### 1.1 1차 범위

- 사용자 두 명 사이의 direct room 생성/재사용
- 텍스트 메시지 전송, 과거 조회, 재접속 gap 복구
- 방 목록, 읽지 않은 메시지 수, 단조 증가 읽음 위치
- WebSocket/STOMP 기반 새 메시지·읽음 상태 push
- 사용자 차단, 메시지 신고
- 멀티노드 fan-out, 오프라인 복구, rate limit
- 메시지 보존·정리, 장애 복구, 관측성, 부하 검증

### 1.2 1차 범위 밖

- 그룹 채팅, 이미지/파일 첨부, 답장·반응, 메시지 수정/회수
- 입력 중 표시, presence, push notification, 전문 검색
- 고객센터/운영자 대화와 신고 처리 UI
- 종단간 암호화(E2EE), 외부 브로커의 메시지 원문 보관
- SockJS fallback, RSocket, 모바일 전용 바이너리 프로토콜

이 항목은 별도 게이트2 없이 자동 포함하지 않는다. 특히 첨부 파일·E2EE·그룹 채팅은 스키마와 인가 모델을
바꾸므로 새 계약 승인이 필요하다.

---

## 2. 현재 기준선과 기술 조사

### 2.1 저장소 기준선

| 구분 | 현재 값 | 채팅 설계 영향 |
|---|---|---|
| 애플리케이션 | Spring Boot 3.5.16, Java 21, Servlet MVC | WebFlux 전환 없이 Spring WebSocket/STOMP 사용 |
| Spring Cloud Gateway | 2025.0.0, WebFlux | `ws://` 전용 route와 handshake IP rate limit 추가 필요 |
| Redis | Redis 7, Lettuce + Redisson 3.50.0 | 정확성 수단이 아닌 저지연 fan-out/rate limit에만 사용 |
| Kafka | Apache Kafka 3.8.0 단일 KRaft broker(local) | 현재 검색 CDC 용도. 채팅에는 별도 outbox 경로가 필요 |
| Kafka Connect | Debezium 2.7 + Elasticsearch sink | 기존 source가 `auction,shop`만 캡처하므로 그대로 재사용 불가 |
| 앱 의존성 | WebSocket/STOMP starter·Spring Kafka·RSocket 모두 미도입 | 구현 티켓에서 필요한 두 starter만 가법 추가, RSocket 제외 |
| 인증 | 서비스 JWT 검증, `SecurityContext` principal=userId | REST·STOMP 모두 토큰에서 주체를 얻고 요청 userId를 신뢰하지 않음 |
| Gateway 신뢰 | `X-Gateway-Token`을 gateway가 덮어씀 | WebSocket HTTP upgrade도 같은 검증을 통과해야 함 |

### 2.2 2026-08-18 공식 자료 검토

기술 비교에는 2026-08-18 현재 upstream 공식 문서를 사용하되, 구현 버전은 현재 프로젝트 BOM을 유지한다.
Spring Framework upstream 최신 안정 라인은 7.0.x이지만 Boot 3.5.16과 호환되는 6.2 문서 라인을 기준으로
설계하며 채팅 때문에 플랫폼 업그레이드를 결합하지 않는다.

- Spring Framework 6.2.19
  - [STOMP 활성화와 simple broker](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/enable.html)
  - [STOMP 토큰 인증](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/authentication-token-based.html)
  - [사용자 목적지](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/user-destination.html)
  - [외부 broker relay와 simple broker 한계](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/handle-broker-relay.html)
  - [메시지 순서 보존 옵션](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/ordered-messages.html)
  - [WebSocket 전송 한도](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/server-config.html)
  - [STOMP 런타임 통계](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/stats.html)
  - [RSocket 지원](https://docs.spring.io/spring-framework/reference/rsocket.html)
- [Spring Security 6.5 WebSocket 인가](https://docs.spring.io/spring-security/reference/6.5/servlet/integrations/websocket.html)
- [STOMP 1.2 사양](https://stomp.github.io/stomp-specification-1.2.html)
- Spring Data Redis
  - [Redis Pub/Sub](https://docs.spring.io/spring-data/redis/reference/redis/pubsub.html)
  - [Redis Streams](https://docs.spring.io/spring-data/redis/reference/redis/redis-streams.html)
- Redis 7
  - [Pub/Sub의 at-most-once 전달](https://redis.io/docs/latest/develop/pubsub/)
  - [Streams와 consumer group](https://redis.io/docs/latest/develop/data-types/streams/)
- Apache Kafka
  - [Kafka 4.1 delivery semantics](https://kafka.apache.org/41/design/design/)
  - [producer idempotence와 partition 내 순서](https://kafka.apache.org/41/configuration/producer-configs/)
- [Debezium stable Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)
- [Spring Cloud Gateway WebSocket Routing Filter](https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/#websocket-routing-filter)

Spring 공식 문서는 브라우저 WebSocket handshake에서 임의 HTTP 헤더를 넣을 수 없으므로 STOMP `CONNECT`
프레임에 토큰을 담고 `ChannelInterceptor`에서 인증하는 방식을 설명한다. Redis 공식 문서는 Pub/Sub 메시지가
at-most-once이며 끊긴 구독자가 복구할 수 없음을 명시한다. 따라서 어느 것도 영속 메시지 정본으로 삼지 않는다.

### 2.3 저장소 내부 선행 결정과의 정합성

- `auction-domain-spec.md`, `bid-domain-spec.md`: 정확성은 DB row lock/CAS로 보장하고 Redis를 정확성
  수단으로 쓰지 않는 원칙을 room sequence와 차단 경합에도 적용한다.
- `closing-domain-spec.md`(정산/마감), `purchase-spec.md`: 금전·거래 정본과 채팅을 결합하지 않는다.
  채팅 장애가 낙찰·구매·정산 상태 전이를 막지 않으며 거래 ID 자동 연결은 1차 범위 밖이다.
- `delivery-domain-spec.md`: DB 상태가 정본이고 AFTER_COMMIT Redis 알림 실패는 지연으로 처리하는
  선행 패턴을 재사용한다. 채팅은 여기에 outbox/CDC fallback을 추가한다.
- `search-spec.md`와 현재 connector: 검색용 CDC의 table/SMT 경계를 유지하고 채팅 outbox connector를
  분리해 검색 색인과 실시간 채팅의 장애·배포 단위를 섞지 않는다.

---

## 3. 실시간 후보 비교와 결정

| 후보 | 장점 | 현재 스택에서의 비용/위험 | 판정 |
|---|---|---|---|
| Raw WebSocket | 프레임 오버헤드가 가장 작고 자유도가 높음 | 인증, 목적지, heartbeat, 오류, 재연결, 구독 규약을 자체 발명해야 함 | 제외 |
| WebSocket + STOMP 1.2 | Spring MVC와 직접 통합, user destination·heartbeat·interceptor 제공 | simple broker는 영속성·cluster·ACK 정본이 아님 | **채택** |
| RSocket | 양방향 stream/backpressure, 바이너리 효율 | reactive transport와 클라이언트 프로토콜 도입, Servlet 기준선과 불일치 | 제외 |
| SSE + REST | 브라우저 자동 재접속, 단방향 push가 단순함 | 향후 양방향 실시간 신호 확장 시 별도 채널 필요, 연결당 HTTP stream 운영 | 보류 |
| 주기적 polling | 인프라가 단순하고 복구가 명확함 | 지연·DB 읽기 증폭·배터리 비용 | 장애 fallback만 |

### 결정 CHAT-D1

1. **REST가 모든 영속 명령과 replay의 정본**이다.
2. **STOMP/WebSocket은 서버→클라이언트 best-effort 알림 전용**이다.
3. 클라이언트의 STOMP `SEND`로 메시지를 저장하지 않는다. 메시지 전송은 REST만 허용한다.
4. SockJS는 1차 범위에서 사용하지 않는다. 지원 브라우저는 native WebSocket을 전제로 한다.

이 경계로 HTTP의 기존 validation·`ApiResponse`·idempotency·rate limit을 재사용하고, STOMP broker ACK를
비즈니스 성공으로 오해하는 문제를 제거한다. WebSocket이 끊겨도 REST 전송과 조회는 정상 동작한다.
RabbitMQ 같은 외부 STOMP broker relay는 새 핵심 인프라를 하나 더 요구하므로 도입하지 않는다. Kafka는 STOMP
relay가 아니라 outbox 사건의 내구 전파에만 사용한다.

---

## 4. 정본과 전체 흐름

```text
Client ──REST POST──> Gateway ──> App ──TX──> MySQL(chat_message + chat_event_outbox)
                                      │
                                      ├─ AFTER_COMMIT best-effort PUBLISH
                                      │                         │
                                      │                         ▼
                                      │                    Redis Pub/Sub
                                      │                         │ all app nodes
                                      │                         ▼
                                      └────────────────── local STOMP sessions

MySQL binlog ──> 별도 Debezium outbox connector ──> Kafka(chat.events.v1)
                                                    │ one consumer group
                                                    ▼
                                             Redis Pub/Sub 재발행

Client reconnect ──REST afterSequence──> MySQL (최종 복구 경로)
```

### 4.1 정본 우선순위

1. MySQL `chat_message`, `chat_room`, `chat_room_member_state`
2. 같은 DB 트랜잭션의 `chat_event_outbox`
3. Kafka 이벤트: 내구 전파·재처리 수단, 메시지 정본 아님
4. Redis Pub/Sub: 저지연 깨우기 신호, 저장·복구 수단 아님
5. STOMP frame: UI 갱신 힌트, 전달 성공 보장 아님

Redis·Kafka·WebSocket 장애는 DB 커밋을 롤백하지 않는다. 클라이언트가 받은 REST 성공 응답의
`roomSequence`가 성공의 최종 증거다.

---

## 5. 데이터 모델

모든 시간은 `Instant`/UTC, 외부 식별자는 ULID `CHAR(26)`, 내부 조인은 `BIGINT`를 사용한다. 테이블과
스키마 정본은 `erd.md` v2.0이며 실제 DDL은 후속 Flyway migration 티켓이 구현한다.

### 5.1 `chat_room`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 내부 식별자 |
| `public_id` | CHAR(26) NOT NULL UK | 외부 room ID |
| `member_low_id` | BIGINT NOT NULL FK user(id) | 더 작은 user id |
| `member_high_id` | BIGINT NOT NULL FK user(id) | 더 큰 user id |
| `last_sequence` | BIGINT NOT NULL DEFAULT 0 | 방별 마지막 메시지 순번 |
| `last_activity_at` | DATETIME(6) NOT NULL | 방 목록 정렬 기준 |
| `created_at` | DATETIME(6) NOT NULL | 생성 시각 |
| `updated_at` | DATETIME(6) NOT NULL | 변경 시각 |

- `CHECK (member_low_id < member_high_id)`
- `UNIQUE (member_low_id, member_high_id)`: 같은 사용자 쌍에 방은 하나뿐이다.
- `INDEX (member_low_id, last_activity_at, id)`, `INDEX (member_high_id, last_activity_at, id)`
- 방을 지우고 다시 만드는 API는 제공하지 않는다. archive는 사용자별 상태일 뿐이다.

### 5.2 `chat_room_member_state`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 전역 ERD 규약의 내부 대리키 |
| `room_id` | BIGINT NOT NULL FK chat_room(id) | 방 |
| `user_id` | BIGINT NOT NULL FK user(id) | 참여자 |
| `last_read_sequence` | BIGINT NOT NULL DEFAULT 0 | 단조 증가 읽음 위치 |
| `last_read_at` | DATETIME(6) NULL | 마지막 읽음 갱신 시각 |
| `archived_at` | DATETIME(6) NULL | 내 목록에서 숨긴 시각(1차 API 미제공) |
| `created_at`, `updated_at` | DATETIME(6) NOT NULL | 감사 시각 |

- `UNIQUE (room_id, user_id)`, `INDEX (user_id, archived_at, room_id)`
- v0.1의 논리 복합 PK는 정본 승격 시 전역 ERD 단일 대리 PK 규약에 맞춰 `id` PK + 복합 UK로 물리화했다.
  방-사용자당 1행이라는 승인 불변식은 그대로다.
- 방 생성 트랜잭션에서 정확히 두 행을 생성한다.
- 두 `user_id`가 방 참여자임은 서비스 불변식과 테스트로 강제한다.
- 메시지를 보낸 행위는 그 시점까지 대화를 읽은 것으로 간주해 발신자의 읽음 위치도 새 sequence까지 전진시킨다.
- unread는 `chat_room.last_sequence - last_read_sequence`다. 보존 purge 시 읽음 floor도 함께 전진시킨다.

### 5.3 `chat_message`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 내부 식별자 |
| `public_id` | CHAR(26) NOT NULL UK | 외부 message ID |
| `room_id` | BIGINT NOT NULL FK chat_room(id) | 소속 방 |
| `room_sequence` | BIGINT NOT NULL | 방별 엄격 증가 순번 |
| `sender_id` | BIGINT NOT NULL FK user(id) | 발신자 |
| `sender_nickname_snapshot` | VARCHAR(30) NOT NULL | `user.nickname`과 같은 길이의 당시 표시명 |
| `client_message_id` | CHAR(36) NOT NULL | 클라이언트 UUID v4 멱등 키 |
| `body` | VARCHAR(1000) NOT NULL | 평문 텍스트 |
| `created_at` | DATETIME(6) NOT NULL | DB 생성 시각 |

- `UNIQUE (room_id, room_sequence)`
- `UNIQUE (room_id, sender_id, client_message_id)`
- 방별 sequence UK B-tree를 정·역방향 스캔해 최신/과거 조회를 모두 커버하므로 같은 컬럼 보조 인덱스는
  중복 생성하지 않는다.
- 1차 버전 메시지는 immutable이다. 수정·soft delete 플래그를 미리 넣지 않는다.
- 본문은 최대 1,000 Unicode code point와 UTF-8 4,000 byte를 모두 만족해야 한다.

### 5.4 `chat_user_block`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 전역 ERD 규약의 내부 대리키 |
| `blocker_id` | BIGINT NOT NULL FK user(id) | 차단한 사용자 |
| `blocked_id` | BIGINT NOT NULL FK user(id) | 차단된 사용자 |
| `created_at` | DATETIME(6) NOT NULL | 생성 시각 |

- `UNIQUE (blocker_id, blocked_id)`, `CHECK (blocker_id <> blocked_id)`
- v0.1의 논리 복합 PK는 정본 승격 시 `id` 대리 PK + 복합 UK로 물리화했다. 방향성 차단 유일성은 동일하다.
- 방향 있는 전역 사용자 차단이다. 어느 한쪽이 차단하면 **양쪽 모두 새 메시지를 보낼 수 없다**.
- 기존 방과 메시지 기록은 유지된다. 누가 나를 차단했는지는 API로 직접 노출하지 않는다.

### 5.5 `chat_report`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 내부 식별자 |
| `public_id` | CHAR(26) NOT NULL UK | 외부 report ID |
| `room_id` | BIGINT NOT NULL FK chat_room(id) | 신고 당시 방 |
| `message_id` | BIGINT NULL FK chat_message(id) ON DELETE SET NULL | 보존 중인 대상 메시지 |
| `message_public_id` | CHAR(26) NOT NULL | purge 뒤에도 남는 대상 외부 ID snapshot |
| `reporter_id` | BIGINT NOT NULL FK user(id) | 신고자 |
| `reported_user_id` | BIGINT NOT NULL FK user(id) | 피신고자 |
| `reason` | VARCHAR(30) NOT NULL | `SPAM`, `ABUSE`, `FRAUD`, `OTHER` |
| `detail` | VARCHAR(500) NULL | 사용자 설명 |
| `message_body_snapshot` | VARCHAR(1000) NOT NULL | 보존 만료와 독립된 증거 |
| `sender_nickname_snapshot` | VARCHAR(30) NOT NULL | `user.nickname`과 같은 길이의 당시 표시명 |
| `status` | VARCHAR(20) NOT NULL | `PENDING`, `REVIEWED`, `DISMISSED`, `ACTIONED` |
| `created_at`, `updated_at` | DATETIME(6) NOT NULL | 생성·상태 변경 시각 |
| `resolved_at` | DATETIME(6) NULL | 처리 완료 시각 |

- `UNIQUE (reporter_id, message_public_id)`
- 신고자는 방 참여자여야 하고 상대방이 보낸 같은 방 메시지만 신고할 수 있다.
- 신고 생성은 메시지를 자동 삭제하거나 계정을 자동 정지하지 않는다.
- 일반 메시지 purge가 신고 보존을 막지 않도록 FK는 `ON DELETE SET NULL`이고 증거·외부 ID snapshot은 남는다.

### 5.6 `chat_event_outbox`

| 컬럼 | 타입/제약 | 의미 |
|---|---|---|
| `id` | BIGINT PK AUTO_INCREMENT | 정렬/정리 키 |
| `event_id` | CHAR(26) NOT NULL UK | 전 구간 dedup ID |
| `aggregate_type` | VARCHAR(30) NOT NULL | `CHAT_ROOM` |
| `aggregate_id` | CHAR(26) NOT NULL | room public ID/Kafka key |
| `event_type` | VARCHAR(40) NOT NULL | 아래 이벤트 타입 |
| `event_version` | INT NOT NULL | 초기값 1 |
| `payload` | JSON NOT NULL | 원문 없는 전달 metadata |
| `occurred_at` | DATETIME(6) NOT NULL | DB 사건 시각 |
| `created_at` | DATETIME(6) NOT NULL | 전역 ERD 규약의 행 생성 감사 시각 |

- `INDEX (occurred_at, id)`
- `aggregate_id`는 논리 aggregate 연결이며 `chat_room` 물리 FK를 걸지 않는다.
- 이벤트 타입: `MESSAGE_CREATED`, `READ_UPDATED`, `BLOCK_CHANGED`
- payload에는 room/message/event ID, sequence, 송수신자 internal ID, 시각만 둔다. **메시지 본문·토큰을 Kafka에 싣지 않는다.**
- Redis에도 같은 metadata만 전파한다. local session이 있는 app node가 DB 정본을 읽어 STOMP 응답을 구성한다.

### 5.7 본문 보호

1차 버전은 신고와 여러 기기 replay 때문에 E2EE를 제공하지 않는다. TLS로 전송 구간을 보호하고 운영 DB/backup은
플랫폼 암호화-at-rest와 최소권한으로 보호한다. 로그·metric·Kafka·Redis에는 본문을 남기지 않는다. 프론트는
본문을 text node로만 렌더링하고 HTML을 해석하지 않는다.

---

## 6. 쓰기 동시성, 순서, 멱등

### 6.1 메시지 전송 트랜잭션

1. `SecurityContext`에서 `senderId`를 얻는다.
2. `chat_room`을 `SELECT ... FOR UPDATE`로 잠그고 참여자 여부를 확인한다.
3. `(room_id, sender_id, client_message_id)` 기존 행을 확인한다.
4. 기존 행이 있고 정규화한 본문이 같으면 현재 차단 상태와 무관하게 원 응답을 `200 OK`,
   `deduplicated=true`로 반환한다. 이는 새 전송이 아니라 이미 성공한 요청의 재확인이다.
5. 기존 행이 있고 본문이 다르면 `CHAT_004`로 거절한다.
6. 새 요청이면 양방향 `chat_user_block` 존재 여부를 확인한다.
7. `nextSequence = last_sequence + 1`을 계산해 room을 갱신하고 message를 삽입한다.
8. 발신자의 `last_read_sequence`를 `nextSequence`까지 전진시킨다. 실제 전진했다면 읽음 시각도 갱신한다.
9. 같은 트랜잭션에 `MESSAGE_CREATED`와 필요한 `READ_UPDATED` outbox를 삽입한다.
10. 커밋 후 §7.4의 immutable metadata snapshot을 전용 bounded executor에 non-blocking enqueue하고
    `afterCommit()`은 즉시 반환한다. enqueue 거절·worker publish 실패는 요청 실패나 동기 fallback으로
    전파하지 않고 metric/drop으로 처리한다.

room row lock은 **한 방 안의 순번과 차단 경합**만 직렬화하며 서로 다른 방은 병렬 처리된다. block/unblock도
같은 room row를 먼저 잠가 lock 순서를 통일한다. unique constraint 위반은 멱등 재조회로 수렴시킨다.
멱등 보장 기간은 원 message의 180일 보존 기간과 같다. 그보다 오래된 요청을 재시도하지 않는 것이
클라이언트 계약이다.

### 6.2 권위 있는 순서

- `roomSequence`만 대화 순서의 권위다. `createdAt`, Redis 도착, Kafka offset은 순서 기준이 아니다.
- Kafka key는 `roomPublicId`로 하여 같은 방 사건은 같은 partition에 둔다.
- fast-path와 CDC-path가 같은 이벤트를 두 번 전파할 수 있다. 서버와 클라이언트는 `eventId` 및
  `(roomPublicId, roomSequence)`로 dedup한다.
- 클라이언트가 `N+1`을 먼저 받고 `N`이 없으면 즉시 `afterSequence=N-1` REST gap 조회를 수행한다.

### 6.3 읽음 위치

- 읽음 갱신은 `new = max(current, throughSequence)`인 단조 연산이다.
- `throughSequence > room.lastSequence`는 `CHAT_006`으로 거절한다.
- 값이 실제 전진한 경우에만 `READ_UPDATED` outbox를 생성한다.
- 메시지 전송도 발신자의 읽음을 새 메시지 sequence까지 암묵적으로 전진시킨다. 따라서 본인이 보낸 메시지는
  본인의 unread에 포함되지 않고, 상대방은 같은 `READ_UPDATED` 계약으로 읽음 상태를 갱신한다.
- 지연·중복된 읽음 이벤트를 받은 클라이언트도 `max(current, received)`로 적용한다.

---

## 7. Redis, Kafka, outbox 역할

### 7.1 Redis Pub/Sub 채택

- 전 app node가 단일 versioned channel `finalcall:chat:fanout:v1`을 구독한다.
- 각 node는 metadata의 recipient 중 **자기 node 로컬 세션**이 있는지 먼저 확인하고, 있을 때만 DB에서
  메시지 응답을 읽어 해당 세션에 STOMP 전송한다. 세션 없는 node는 DB를 조회하지 않는다.
- subscriber는 event version/type/ID 형상을 검증하고 DB의 room 참여자·message 소속과 일치할 때만 전송한다.
  Redis payload만 믿어 임의 user destination으로 보내지 않는다.
- 같은 사용자의 여러 탭/기기는 모두 받는다.
- session 상태는 node local이지만 모든 사건을 broadcast하므로 gateway sticky session은 요구하지 않는다.
- Redis Pub/Sub은 at-most-once다. 연결 단절 중 유실은 REST gap 조회가 복구한다.
- Redis Streams는 사용하지 않는다. consumer group 하나는 node 간 분배이지 전체 node broadcast가 아니며,
  node별 group은 retention·pending·고아 group 운영비를 만든다.

### 7.2 Kafka 역할

- topic: `finalcall.chat.events.v1`
- key: `roomPublicId`
- value: versioned metadata envelope, 메시지 원문 없음
- retention: 7일, 최소 3 replica/`min.insync.replicas=2`는 production 배포 전제
- application consumer group 하나가 outbox 사건을 소비해 Redis channel로 재발행한다.
- consumer offset 커밋 전 Redis publish 실패 시 retry한다. 중복 publish는 허용한다.

Kafka를 WebSocket broker나 메시지 조회 정본으로 사용하지 않는다. 앱 노드마다 같은 Kafka consumer group을
두면 한 node만 사건을 받아 그 node의 세션에만 전달되는 문제가 생긴다. Kafka consumer는 전역 사건을
Redis broadcast로 변환하고, 모든 node 전달은 Redis가 담당한다.

### 7.3 CDC/outbox 결정

**권고:** 현재 검색 CDC connector와 분리된 채팅 outbox 전용 Debezium connector를 둔다.

- 현재 connector는 `auction,shop`만 capture하고 unwrapped row의 `public_id`를 key로 바꾸는 검색 전용 SMT다.
- 채팅은 `chat_event_outbox`만 capture하고 Debezium Outbox Event Router를 적용해야 한다.
- 별도 connector는 MySQL binlog reader·운영 설정이 하나 늘지만, 검색 pipeline 장애/SMT 변경과 채팅을 격리한다.
- connector name, MySQL `database.server.id`, schema-history/offset 저장소를 검색 connector와 분리하고 binlog
  retention이 최대 허용 장애시간보다 길도록 운영한다.
- outbox cleanup에서 생긴 delete/tombstone은 business event가 아니며 connector/consumer가 no-op으로 처리한다.
- 같은 DB 트랜잭션의 message+outbox로 dual-write 간극을 제거한다.
- outbox publisher를 앱 polling으로 직접 구현하는 대안은 CDC 추가 reader를 피하지만 polling lock,
  retry 상태, leader 경쟁, 배치 지연 코드를 새로 소유해야 하므로 비권고다.

Kafka/Connect가 중단돼도 Redis fast-path와 REST 복구가 동작한다. Redis도 함께 중단되면 실시간 push만
지연되고 DB 메시지는 유지되며, connector 복구 후 outbox 사건이 재전파된다.

### 7.4 commit 이후 Redis fast-path 비동기 경계

2026-08-20 승인된 권고안 A에 따라 DB commit 이후 Redis publish는 요청·JDBC 반환 경계 밖의 **채팅
fast-path 전용 bounded executor**에서 실행한다.

- 트랜잭션 안에서 outbox 저장 시점에 `eventId`, `aggregateType`, `aggregateId`, `eventType`,
  `eventVersion`, 원문 없는 `payload`, `occurredAt`만 immutable snapshot으로 만든다. entity나 영속성
  context를 worker에 넘기지 않는다.
- snapshot에는 메시지 본문, 신고 상세, JWT·Authorization, `SecurityContext`, MDC, request/response 객체,
  세션 및 기타 민감 context를 포함하지 않는다. §5.6의 metadata-only privacy 계약은 그대로 유지한다.
- rollback이면 enqueue는 0회다. commit 성공 시 해당 트랜잭션에서 저장된 event마다 정확히 1회의 enqueue를
  시도한다. 이는 Redis 전달 exactly-once 보장이 아니며 CDC 재발행과의 중복은 §6.2 dedup으로 수렴한다.
- `afterCommit()`은 blocking Redis I/O를 수행하지 않고 snapshot을 queue에 **non-blocking offer**한 뒤 즉시
  반환한다. Redis publish가 5초 지연돼도 HTTP 응답과 JDBC connection 반환을 기다리게 하지 않는다.
- executor는 유한한 thread pool과 유한한 queue를 가지며 `chat-fast-path-`처럼 식별 가능한 thread name을
  사용한다. 실제 pool/queue 수치는 배포 설정과 FC-335 부하 검증으로 조정하되 유한성은 계약이다.
- `CallerRunsPolicy`, blocking enqueue, unbounded queue, executor 내부 retry, shared `@Async` executor,
  작업마다 생성하는 unbounded virtual thread는 금지한다. 이 경계가 포화·Redis 장애를 요청 thread나 다른
  비동기 workload로 역전파해서는 안 된다.
- queue 포화·shutdown 중 거절은 요청을 실패시키거나 요청 thread에서 동기 publish하지 않는다. 즉시
  metric을 증가시키고 해당 fast-path 시도를 drop한다. worker publish 실패도 동일하게 metric/drop하며
  동기 fallback이나 자체 retry를 하지 않는다. **동일 DB 트랜잭션에 저장된 outbox→Debezium→Kafka 경로가
  내구성 fallback**이고, REST gap replay가 최종 복구 수단이다.
- 정상 종료는 새 enqueue를 닫고 설정된 유한 시간 동안 queue를 drain한다. 기한 뒤 실행 중이거나 남은
  작업은 drop하고 shutdown drop metric에 반영한다. 종료를 무기한 기다리지 않는다.

이 변경은 내부 실행·실패 의미론만 보정한다. 외부 REST/STOMP 계약, Redis/Kafka event schema와 version,
`chat_event_outbox` 스키마 및 전체 ERD는 변경하지 않는다.

---

## 8. WebSocket/STOMP 계약

### 8.1 연결과 gateway

- 외부 endpoint: `GET /ws/chat` HTTP Upgrade
- gateway는 HTTP `/api/v1/**` route보다 앞선 `ws://<service>` 전용 route를 둔다.
- upgrade 요청도 `X-Gateway-Token` 덮어쓰기와 서비스 `GatewayAccessFilter` 검증을 통과한다.
- handshake에는 JWT query parameter를 허용하지 않는다. URL·proxy log 유출 위험 때문이다.
- 서비스 Security HTTP 규칙은 `/ws/chat` handshake만 `permitAll`로 두되 gateway token은 필수다.
- 연결 후 5초 안에 인증된 STOMP `CONNECT`가 없으면 끊는다.

### 8.2 인증과 인가

클라이언트는 다음 header로 STOMP `CONNECT`를 보낸다.

```text
accept-version:1.2
heart-beat:10000,10000
Authorization:Bearer <access-token>
```

- JWT 인증 `ChannelInterceptor`를 Spring Security message authorization보다 먼저 실행한다.
- interceptor가 HTTP JWT filter와 같은 검증기를 호출해 `Principal=userId`를 설정한다.
- 만료·위조 토큰은 STOMP `ERROR` 뒤 WebSocket close code `1008`로 종료한다.
- 허용 Origin은 frontend 운영 origin의 exact allowlist다. `*`와 credential 혼합을 금지한다.
- cookie/session 인증은 fallback으로 허용하지 않는다. ambient credential이 없는 bearer-only 연결이므로 별도
  STOMP CSRF token을 public 계약에 추가하지 않고 strict Origin + CONNECT bearer를 강제한다.
- 서버는 CONNECT에서 읽은 JWT `exp` 시각에 socket을 강제 종료한다. token refresh 후 기존 principal은
  자동 갱신되지 않으며 클라이언트는 새 access token으로 재연결한다.
- `exp`를 얻기 위해 STOMP adapter가 JWT를 별도로 해석하지 않는다. 공용 `TokenProvider`의 검증 결과가
  만료 시각을 함께 제공하도록 확장해 HTTP와 WebSocket이 같은 서명·만료 검증 경로를 사용한다.
- logout 시 frontend는 socket을 즉시 끊는다. 현재 전역 access JWT가 무상태라 서버 강제 폐기는 만료 전까지
  불가능하다는 잔여 위험은 REST와 같고, chat이 별도 장기 session을 만들지 않는다(현재 최대 30분).

### 8.3 허용 frame과 목적지

| frame | 목적지/정책 |
|---|---|
| `CONNECT` | JWT 필수, 연결당 1회 |
| `SUBSCRIBE` | `/user/queue/chat.events`만 허용 |
| `UNSUBSCRIBE`, `DISCONNECT` | 허용 |
| `SEND`, `ACK`, `NACK`, `BEGIN`, `COMMIT`, `ABORT` | 1차 버전 거절 |

room topic이나 `/user/{id}/...`를 클라이언트가 선택하게 하지 않는다. 서버는 인증된 principal의
user destination으로만 보낸다. Spring simple broker는 node-local session registry/dispatch에만 쓰며,
broker relay·durable ACK·cluster source of truth로 사용하지 않는다.

### 8.4 전송 옵션

- STOMP 1.2, native WebSocket only
- heartbeat: client/server 각 10초 제안, 30초 이상 무응답 시 종료
- application message 최대 8 KiB, transport buffer 최대 16 KiB
- per-session send time limit 10초, send buffer 512 KiB
- `setPreservePublishOrder(true)`로 한 session outbound 순서를 보존한다.
- 느린 consumer가 buffer 한도를 넘으면 연결을 종료하고 REST replay로 복구시킨다.
- simple broker ACK에 의존하지 않으므로 subscription `ack:auto`만 허용한다.

### 8.5 실시간 event envelope

구현 DTO 이름은 허용 어휘에 맞춰 `ChatEventResponse`로 고정한다.

```json
{
  "eventId": "01K...",
  "eventType": "MESSAGE_CREATED",
  "eventVersion": 1,
  "occurredAt": "2026-08-18T10:00:00Z",
  "roomPublicId": "01K...",
  "payload": {
    "message": {
      "messagePublicId": "01K...",
      "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
      "roomSequence": 42,
      "sender": {
        "memberPublicId": "01K...",
        "nickname": "구매자닉네임"
      },
      "body": "안녕하세요",
      "sentByMe": false,
      "createdAt": "2026-08-18T10:00:00Z"
    }
  }
}
```

| eventType | recipient | payload |
|---|---|---|
| `MESSAGE_CREATED` | 두 참여자의 모든 활성 세션 | recipient 관점의 `ChatMessageResponse` |
| `READ_UPDATED` | 두 참여자의 모든 활성 세션 | `readerMemberPublicId`, `throughSequence`, `readAt` |
| `BLOCK_CHANGED` | 두 참여자의 활성 세션 | `changedAt`(상태값 없이 invalidate만 지시) |

`MESSAGE_CREATED`의 원문은 DB에서 local dispatch 직전에 읽어 TLS WebSocket으로만 전달한다. Kafka·outbox·Redis에는
원문을 넣지 않는다. 이벤트가 빠졌거나 sequence gap이 있으면 `GET .../messages?afterSequence=`로 복구한다.
session이 존재하는 node당 DB read가 최대 한 번 늘지만, 클라이언트의 매 메시지 REST hydration과 영속 broker의
개인정보 사본을 피한다. 같은 node의 여러 탭에는 한 번 읽은 응답을 재사용한다.
`BLOCK_CHANGED`는 지연/역순 event가 과거 상태를 덮지 않도록 boolean 상태를 직접 싣지 않는다. 수신자는
room detail query를 invalidate해 현재 DB 상태를 다시 읽는다.

---

## 9. 인증, 인가, abuse 방어

### 9.1 REST 인가

- 모든 `/api/v1/me/chat-*` API는 access token 인증이 필요하다.
- sender/reporter/reader ID를 request body나 query로 받지 않는다.
- room/message 조회는 매번 `SecurityContext` user가 두 참여자 중 하나인지 확인한다.
- 신규 room/메시지 쓰기는 발신자와 상대 user가 모두 활성 상태인지 DB에서 확인한다.
- 미존재 room과 비참여 room은 모두 `CHAT_001` 404로 통일해 IDOR oracle을 막는다.
- 신고 대상도 room 소속·상대 발신 메시지인지 검증한다.

### 9.2 본문 validation

- 앞뒤 whitespace는 보존하되 전체가 whitespace면 거절한다.
- NUL과 `\n`, `\t` 이외 C0 control 문자를 거절한다.
- Unicode는 NFC로 정규화한 뒤 code point/byte 한도를 검사한다.
- HTML·Markdown을 서버에서 렌더링하지 않는다. 클라이언트도 text로 escape한다.
- URL은 단순 텍스트이며 1차 버전에서 unfurl/preview하지 않는다.

### 9.3 차단

- `PUT block`과 `DELETE block`은 멱등이고 성공 시 204다.
- 어느 방향의 차단이든 양쪽 신규 전송을 `CHAT_005`로 거절한다.
- `CHAT_005` 메시지는 누가 누구를 차단했는지 구별하지 않는다.
- 차단 후에도 본인의 기존 history와 신고 기능은 유지한다.
- send/block race는 항상 room row lock을 먼저 잡아 한쪽 결과가 선형화된다.

### 9.4 신고

- 사용자당 10건/일, 같은 메시지는 한 번만 신고한다.
- 신고 detail에는 토큰·비밀번호 등 민감정보를 넣지 말라는 UX 안내를 둔다.
- 증거 snapshot 접근은 향후 운영자 전용 API에서 별도 ADMIN 인가를 요구한다.
- 신고 API와 로그에 상대의 internal user id를 노출하지 않는다.

### 9.5 rate limit

| 구간 | 초기값 | 키/실패 정책 |
|---|---:|---|
| WebSocket handshake | IP당 10회/분, burst 5 | gateway Redis token bucket |
| STOMP CONNECT | 사용자당 20회/분 | service Redis token bucket |
| 메시지 REST POST | IP당 120회/분 | gateway 1차 방어 |
| 메시지 전송 | 사용자당 5회/초 burst 10, 60회/분 | 서비스 Redis token bucket |
| 방 생성 | 사용자당 20회/시간 | 서비스 Redis token bucket |
| 신고 | 사용자당 10회/일 | DB/Redis 이중 검증 |
| 활성 socket | 사용자당 최대 3개 | Redis lease + node local registry |

서비스 Redis limiter 장애 시 gateway IP 제한을 남기고 **fail-open**하되 경고한다. DB write 성공률을 Redis
가용성에 종속시키지 않기 위한 선택이다. socket quota는 `userId`별 connection lease를 heartbeat보다 긴 TTL로
Redis에 두고 atomic claim/release하며, Redis 장애 시 node별 최대 3개로 축소 적용한다. node crash의 고아 lease는
TTL로 제거한다. 반복 abuse는 차단·계정 제재 도메인으로 승격한다.

---

## 10. 오프라인, 재접속, 보존

### 10.1 클라이언트 재접속 절차

1. REST 방 목록을 조회해 각 room의 `lastSequence`, `lastReadSequence`를 동기화한다.
2. STOMP 연결 후 `/user/queue/chat.events`를 구독한다.
3. 로컬 마지막 sequence보다 서버가 크면 `afterSequence`로 gap을 채운다.
4. event 중복은 `eventId`, 메시지 중복은 `messagePublicId`/sequence로 제거한다.
5. exponential backoff + full jitter로 1, 2, 4, 8, 16초(최대 30초) 재연결한다.
6. offline 중 전송은 각 request의 같은 `clientMessageId`로 재시도한다.

연결 자체가 동기화 barrier는 아니다. subscribe 직전/직후 race는 반드시 REST sequence 비교가 닫는다.

### 10.2 보존

| 데이터 | 권고 보존 | 정리 방식 |
|---|---:|---|
| 일반 메시지 | 180일 | `created_at,id` index 기반 소배치 물리 삭제 |
| room/member state | 계정/room 존속 기간 | 메시지와 별도 유지 |
| 신고 및 증거 snapshot | 3년 | 운영·법무 정책에 따라 조정 |
| DB outbox | 7일 | connector 정상·binlog 여유 확인 후 age 기반 배치 삭제 |
| Kafka chat event | 7일 | metadata only topic retention |
| Redis Pub/Sub | 0 | 원래 비영속 |

- 메시지 purge 시 각 room의 삭제된 최대 sequence까지 두 참여자의 `last_read_sequence` floor를 전진시켜
  unread 계산이 음수/과대가 되지 않게 한다.
- report snapshot은 원 message purge와 독립적으로 유지한다.
- 계정 탈퇴의 법적 삭제/익명화 정책은 member 도메인의 별도 계약을 따른다.
- 단일 대량 DELETE를 금지하고 짧은 트랜잭션 배치로 replica lag/undo 증가를 제한한다.
- outbox 정리는 `created_at < cutoff AND id <= CDC safe checkpoint`를 `created_at,id` 순서로 잠그므로
  **`(created_at,id)` retention 인덱스**를 사용한다. **`(occurred_at,id)` 인덱스**는 최신 도메인 사건의
  pipeline head lag 관측용으로 유지하며 retention 기준으로 대체하지 않는다.

보존 기간은 G2-CHAT-5 승인값이며 변경 시 새 게이트2 영향 분석이 필요하다.

---

## 11. 장애와 복구

| 장애 | 쓰기 결과 | 실시간 영향 | 복구 |
|---|---|---|---|
| MySQL 장애 | 503, 성공 응답 금지 | 기존 socket은 유지 가능 | DB 복구 후 같은 멱등 키 재시도 |
| Redis 장애 | DB 성공 유지 | 새 push 지연/누락 | REST gap 조회, Redis 복구 후 Kafka 재발행 |
| Kafka/Connect 장애 | DB+Redis fast-path 성공 | online은 대체로 정상 | outbox/binlog backlog catch-up |
| Redis+Kafka 동시 장애 | DB 성공 유지 | push 중단 | 재접속/polling 조회, 복구 후 catch-up |
| app node crash | 커밋 전 rollback, 커밋 후 유지 | 해당 node socket 종료 | gateway 재연결, sequence gap 조회 |
| fast-path executor 포화·종료 중 거절 | DB 성공 유지 | 해당 Redis fast-path drop | metric 경보, outbox→Kafka 재발행·REST gap 조회 |
| fast-path worker/Redis 지연·실패 | DB 성공 및 HTTP/JDBC 비차단 | 해당 fast-path 지연·drop | metric 경보, outbox→Kafka 재발행·REST gap 조회 |
| gateway 장애 | 외부 REST/socket 불가 | 연결 종료 | gateway 복구 후 jitter 재연결 |
| 느린 client | DB 무영향 | buffer limit에서 연결 종료 | REST replay |
| 중복/역순 event | DB 무영향 | UI 순서가 일시 흔들릴 수 있음 | sequence 정렬·dedup·gap fetch |

### 11.1 outbox backlog 운영

- outbox row에는 `published` 상태를 쓰지 않는다. DB의 최신 outbox `occurred_at/event_id`와 Kafka consumer가
  마지막으로 관측한 값을 비교한 **pipeline head lag**, Debezium source lag, Kafka consumer lag를 함께 본다.
- pipeline head lag가 30초를 넘으면 warning, 5분을 넘으면 critical이다.
- connector 상태나 binlog retention 여유를 확인할 수 없으면 outbox cleanup을 멈춘다.
- connector offset/스키마 history를 임의 초기화하지 않는다.
- 재처리는 at-least-once이며 consumer와 client가 dedup한다.

### 11.1.1 outbox retention 인덱스 배포

- 기존 `(occurred_at,id)`는 유지하고, append-only **`V27`**에서 `(created_at,id)`를 가법 추가한다.
- 운영 적용 전 대상 MySQL 8에서 online secondary-index DDL 지원 여부를 확인하고, 장기 트랜잭션·metadata
  lock 대기·테이블/인덱스 크기·임시 및 영구 디스크 여유를 점검한다. 지원되는 배포 환경에서는
  `ALGORITHM=INPLACE, LOCK=NONE`을 명시하고 낮은 트래픽 창에 단일 migration 주체가 적용한다.
- 롤백은 V27을 수정하거나 삭제하지 않는다. 문제 시 후속 append-only migration에서 신규 retention
  인덱스만 제거하며, 코드 롤백 시에도 안전하면 인덱스를 유지한다.
- 검증 DoD는 fresh/upgrade migration, 두 outbox 인덱스 공존과 컬럼 순서, `EXPLAIN ANALYZE`의 retention
  인덱스 사용·filesort/full scan 부재, cutoff/CDC safe ID/batch 경계, 멀티노드 동시 purge 정합성과
  deadlock 부재, retention 중 §14 SLO·DB lock/IO·replica lag, pipeline head 관측 회귀 없음이다.

### 11.2 DB hot room

1:1 방은 메시지 전송 rate limit 때문에 단일 room row lock이 합리적이다. lock wait p95가 100ms를 넘거나
동일 room이 50 msg/s를 지속하면 abuse 또는 그룹 채팅 요구로 분류한다. 전역 sequence/lock을 도입하지 않는다.

---

## 12. API 계약

공통 prefix, `ApiResponse<T>`, 오류 envelope, ULID, `Instant`, `CursorResponse<T,C>`는
`api-contract.md` §1을 따르며 외부 정본은 동 문서 §2.7(v1.27)이다.

### 12.1 REST endpoint

| Method | Path | 성공 | 설명 |
|---|---|---|---|
| POST | `/api/v1/me/chat-rooms/direct` | 신규 201, 기존 200 | nickname으로 direct room 생성/재사용 |
| GET | `/api/v1/me/chat-rooms` | 200 | 내 방 목록 cursor 조회 |
| GET | `/api/v1/me/chat-rooms/{roomPublicId}` | 200 | 내 방 현재 상태 상세 |
| GET | `/api/v1/me/chat-rooms/{roomPublicId}/messages` | 200 | 최신/과거/gap 메시지 조회 |
| POST | `/api/v1/me/chat-rooms/{roomPublicId}/messages` | 신규 201, dedup 200 | 메시지 영속 전송 |
| PUT | `/api/v1/me/chat-rooms/{roomPublicId}/read` | 200 | 읽음 위치 단조 갱신 |
| PUT | `/api/v1/me/chat-rooms/{roomPublicId}/block` | 204 | 상대 차단 |
| DELETE | `/api/v1/me/chat-rooms/{roomPublicId}/block` | 204 | 내 차단 해제 |
| POST | `/api/v1/me/chat-rooms/{roomPublicId}/reports` | 201 | 상대 메시지 신고 |
| GET | `/api/v1/me/chat-rooms/unread-count` | 200 | 전체 unread 합계 |

### 12.2 방 생성

```json
{
  "counterpartNickname": "판매자닉네임"
}
```

- 본인 nickname은 `CHAT_003`이다.
- 같은 쌍의 동시 생성은 unique constraint 후 기존 room 재조회로 수렴한다.
- 기존 방은 차단 상태여도 history 접근을 위해 반환한다. 방이 없는 차단 쌍의 새 방 생성과 신규 전송은
  `CHAT_005`로 거절한다.

### 12.3 방 응답

방 생성과 방 상세는 `ChatRoomResponse`, 목록은 `CursorResponse<ChatRoomResponse, String>`을 반환해 같은
표시 형상을 재사용한다.

```json
{
  "roomPublicId": "01K...",
  "counterpart": {
    "memberPublicId": "01K...",
    "nickname": "판매자닉네임"
  },
  "lastMessage": {
    "messagePublicId": "01K...",
    "roomSequence": 42,
    "senderNickname": "구매자닉네임",
    "bodyPreview": "안녕하세요",
    "createdAt": "2026-08-18T10:00:00Z"
  },
  "lastSequence": 42,
  "lastReadSequence": 40,
  "counterpartLastReadSequence": 38,
  "unreadCount": 2,
  "blockedByMe": false,
  "canSend": true,
  "createdAt": "2026-08-17T10:00:00Z",
  "lastActivityAt": "2026-08-18T10:00:00Z"
}
```

방 목록은 `(lastActivityAt DESC, room id DESC)` keyset cursor, 기본 20/최대 100건이다. `lastMessage`는
아직 메시지가 없거나 보존 만료로 남은 메시지가 없는 방에서 `null`이다. `bodyPreview`는 최대 80 code point다.
목록 cursor는 version을 포함한 `(lastActivityAt,id)` Base64URL opaque 문자열이며 손상된 값은 `COMMON_001`이다.
`lastReadSequence`는 현재 주체, `counterpartLastReadSequence`는 상대의 단조 읽음 위치다.
`blockedByMe`는 해제 UI를 위한 본인 행만 뜻하고, `canSend=false`는 어느 방향 차단·상대 비활성 등 사유를
합친 값이다. 상대가 나를 차단했는지 별도 필드나 사유로 노출하지 않는다.
탈퇴한 상대의 `nickname`은 서버가 `탈퇴한 사용자`로 치환하고 `canSend=false`로 반환한다.

### 12.4 메시지 조회

```text
GET .../messages?beforeSequence=42&size=50  # 42 미포함, 더 오래된 메시지
GET .../messages?afterSequence=40&size=50   # 40 미포함, gap/새 메시지
GET .../messages?size=50                    # 최신 50건
```

- `beforeSequence`와 `afterSequence`는 동시에 보낼 수 없다.
- 응답은 어떤 모드든 `roomSequence ASC`로 정렬한다.
- `CursorResponse<ChatMessageResponse, Long>`의 `nextCursor`는 반환된 가장자리 sequence다.
- 채팅은 순서 복구 자체가 공개 계약이므로 공통 opaque cursor의 가법적 예외로 숫자 sequence를 사용한다.
- 최신/과거 조회의 `hasNext`는 더 오래된 메시지 존재 여부, gap 조회는 더 새로운 메시지 존재 여부다.

```json
{
  "messagePublicId": "01K...",
  "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
  "roomSequence": 42,
  "sender": {
    "memberPublicId": "01K...",
    "nickname": "구매자닉네임"
  },
  "body": "안녕하세요",
  "sentByMe": true,
  "createdAt": "2026-08-18T10:00:00Z"
}
```

### 12.5 메시지 전송

```json
{
  "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
  "body": "안녕하세요"
}
```

성공 응답은 `ChatMessageSendResponse`다.

```json
{
  "message": {
    "messagePublicId": "01K...",
    "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
    "roomSequence": 42,
    "sender": {
      "memberPublicId": "01K...",
      "nickname": "구매자닉네임"
    },
    "body": "안녕하세요",
    "sentByMe": true,
    "createdAt": "2026-08-18T10:00:00Z"
  },
  "deduplicated": false
}
```

### 12.6 읽음, 차단, 신고

읽음 request/response:

```json
{ "throughSequence": 42 }
```

```json
{
  "lastReadSequence": 42,
  "readAt": "2026-08-18T10:01:00Z"
}
```

신고 request/response:

```json
{
  "messagePublicId": "01K...",
  "reason": "FRAUD",
  "detail": "거래와 무관한 외부 송금을 요구했습니다."
}
```

```json
{
  "reportPublicId": "01K...",
  "createdAt": "2026-08-18T10:02:00Z"
}
```

전체 unread 응답은 `{ "count": 12 }`이며 Java `long` 범위다.

### 12.7 채팅 오류 코드

| code | HTTP | 의미 |
|---|---:|---|
| `CHAT_001` | 404 | 방/메시지가 없거나 요청자가 당사자가 아님 |
| `CHAT_002` | 404 | 대화 상대가 없거나 비활성 |
| `CHAT_003` | 422 | 자기 자신과 direct room 생성 시도 |
| `CHAT_004` | 409 | 같은 clientMessageId를 다른 본문에 재사용 |
| `CHAT_005` | 409 | 차단 등으로 현재 대화할 수 없는 상태 |
| `CHAT_006` | 422 | 읽음 sequence가 room 범위를 벗어남 |
| `CHAT_007` | 422 | 신고 대상이 상대방의 같은 방 메시지가 아님 |
| `CHAT_008` | 409 | 같은 메시지 중복 신고 |
| `CHAT_009` | 429 | 사용자 채팅 rate limit 또는 socket quota 초과 |

Bean Validation 실패는 기존 `COMMON_001`, unauthenticated/forbidden은 기존 `COMMON_005`/`COMMON_006`을 사용한다.
STOMP `CONNECT` 인증 실패도 같은 401-shaped 오류 body를 `ERROR` frame으로 보낸 뒤 1008로 종료하되,
클라이언트는 ERROR frame 수신 자체를 보장받지 않는다고 간주한다.
REST `CHAT_009` 응답은 가능한 재시도까지의 초를 `Retry-After` header로 제공한다. STOMP 연결 quota/rate
초과는 `CHAT_009` body를 보낼 수 있으면 보낸 뒤 1008로 종료한다.

---

## 13. 관측성

### 13.1 metric

- `chat.message.persist.total{result=new|deduplicated|rejected|failed}`
- `chat.message.persist.duration`, `chat.room.lock.wait.duration`
- `chat.websocket.connections`, `chat.websocket.connect.auth.failures`
- `chat.websocket.closes{reason}`, `chat.websocket.send.buffer.exceeded`
- `chat.redis.publish.failures`, `chat.redis.events.received`
- `chat.fast_path.enqueue.total{result=accepted|rejected|shutdown}`
- `chat.fast_path.publish.total{result=success|failed}`
- `chat.fast_path.queue.depth`, `chat.fast_path.active.workers`
- `chat.fast_path.shutdown.dropped`
- `chat.outbox.rows`, `chat.event.pipeline.head.lag`
- `chat.kafka.consumer.lag`, `chat.kafka.consumer.lag.collection.failures`
- `chat.kafka.consumer.lag.collection.age`, `chat.kafka.republish.failures`, `chat.debezium.source.lag`
- `chat.realtime.delivery.delay`, `chat.reconnect.gap.messages`
- `chat.rate_limit.rejections{scope}`, `chat.block.total`, `chat.report.total{reason}`

fast-path metric의 허용 tag는 위에 열거한 고정 `result` 값뿐이다. exception class/message, thread name,
event type/version도 tag로 추가하지 않고 필요하면 제한된 구조화 로그 필드로 남긴다. userId, roomId,
messageId, eventId, nickname은 모든 metric tag로 쓰지 않는다. 고카디널리티와 개인정보 노출을 막는다.

### 13.2 log/trace

- REST traceId, eventId, roomPublicId hash, sequence, 결과, latency만 구조화한다.
- message body, report detail, JWT, STOMP Authorization header는 로그에서 전면 마스킹한다.
- DB commit→Redis publish→node receive→STOMP send 구간은 eventId로 추적한다.
- Kafka 재처리와 fast-path 중복은 error가 아니라 dedup metric이다.

### 13.3 초기 alert 기준

- DB persist p95 > 200ms 또는 p99 > 500ms 5분 지속
- room lock wait p95 > 100ms, deadlock 1건 이상
- event pipeline head lag > 30초 warning, > 5분 critical
- Kafka consumer lag 시간 > 30초, Redis publish failure > 1%
- WebSocket abnormal close ratio > 5%, send buffer exceeded 발생
- gateway handshake 429 비율 급증 또는 단일 IP reconnect storm

### 13.4 멀티 replica 전역 backlog/lag collector

- Kafka fan-out consumer는 메시지 분산 처리와 장애 복구를 위해 모든 app replica에서 활성화한다.
- `chat.outbox.rows`와 consumer group 전체의 `chat.kafka.consumer.lag`는 전역 지표이므로 배포 전체에서
  정확히 1개의 active app replica만 수집한다. consumer 활성화와 collector 활성화는
  `chat.kafka.consumer.monitor-enabled`로 독립 제어하며, 배포 설정은 active collector 수가 1인지 검증한다.
- active collector 장애 시 마지막 성공 수집 이후 경과를 `chat.kafka.consumer.lag.collection.age`로,
  수집 실패를 `chat.kafka.consumer.lag.collection.failures`로 관측한다. collection age가 monitor interval의
  3배를 넘거나 failure가 증가하면 alert하고, runbook에 지정 replica 복구 또는 다른 replica로 collector를
  이전하는 절차를 둔다.
- collector leader 선출에 Redis 분산락을 사용하지 않는다. 고정 임대와 Redis 장애 전파가 정확성·가용성
  기준에 맞지 않는다. 단일 관측 작업을 위해 DB lock/별도 lock table도 추가하지 않는다.
- 장기적으로는 Kafka exporter 또는 전용 observability collector로 전역 lag 수집을 app 밖으로 이관할 수 있다.
  이관 전까지 단일 active app collector가 정본이며 replica별 중복 수집이나 단순 위상 분산은 허용하지 않는다.

---

## 14. 용량 가정, SLO, 검증

수치는 제품 예측이 아니라 1차 설계와 부하시험의 기준이다.

### 14.1 기준 부하

- 20,000 DAU, 동시 WebSocket 20,000개
- 일 200,000 메시지, 평균 본문 120 UTF-8 byte
- 지속 300 message write/s, 60초 burst 1,000/s
- 양쪽 사용자가 서로 다른 node에 online인 최악 조건에서 지속 최대 600 dispatch hydration read/s
- 사용자당 활성 socket 최대 3개
- 180일 보존 시 약 3,600만 message row, 인덱스 포함 약 30~50GB 예상

실측 row 크기, index amplification, backup/replica 비용이 추정의 2배를 넘으면 보존/partition/archive 설계를
다시 게이트2에 올린다. 1차는 FK와 단순 운영을 위해 partition 없이 시작하고, 5천만 row 또는 purge batch
10분 초과를 재검토 trigger로 둔다.

### 14.2 SLO

- REST 메시지 DB 커밋 p95 ≤ 200ms, p99 ≤ 500ms
- Redis 정상 시 DB commit→로컬 STOMP send p95 ≤ 500ms
- 100개 gap REST 복구 p95 ≤ 2초
- Redis/Kafka 장애 중 DB에 성공 응답한 메시지 유실 0
- 같은 room에서 승인된 메시지 sequence 중복 0, client 멱등 중복 row 0

### 14.3 필수 테스트

1. 같은 room N개 동시 전송: sequence unique/연속, 본문과 sender 정합
2. 서로 다른 room 병렬 전송: 전역 lock/처리량 병목 없음
3. 같은 clientMessageId 동시 retry: 한 행, 같은 응답
4. 같은 멱등 키 다른 본문: 409
5. send와 block 경합: room lock 순서로 결정되고 차단 뒤 전송 없음
6. 읽음 갱신 중복/역순/동시 실행: 값 단조 증가
7. 읽지 않은 상대 메시지가 있는 상태의 send: 발신자 읽음이 새 sequence까지 전진하고 자기 unread는 0
8. room 생성 쌍방 동시 실행: 한 room, member state 두 행
9. 비참여자의 room/history/send/read/report IDOR 전건 404/거절
10. Redis 중단: REST 쓰기 성공, 재접속 gap 복구
11. Kafka/Connect 중단: fast-path 유지, outbox backlog와 복구 catch-up
12. DB commit 직후 app kill: CDC 또는 REST로 메시지 발견
13. fast-path+CDC 중복/역순: client 최종 목록 정합
14. 2개 이상 app node: recipient의 어느 node 세션에도 fan-out
15. 느린 client: buffer limit 종료, 다른 session/DB 무영향
16. 20k socket heartbeat/reconnect storm과 300/s 지속·1,000/s burst
17. 본문 boundary/control/XSS, STOMP 목적지 위조, Origin/JWT 위조
18. message/report/outbox retention 배치가 online p95와 replica lag 한도를 지킴
19. rollback은 fast-path enqueue 0회, commit은 저장 event별 enqueue 시도 1회
20. Redis publish를 5초 지연해도 HTTP 응답과 JDBC connection 반환이 publish 완료를 기다리지 않음
21. 작은 pool/queue 강제 포화에서 non-blocking rejection/drop metric이 증가하고 요청 성공은 유지됨
22. worker에 immutable metadata snapshot만 전달되고 본문·JWT·SecurityContext·MDC가 전달되지 않음
23. worker publish 실패에서 동기 fallback·내부 retry 없이 outbox→Kafka와 gap replay로 수렴
24. bounded shutdown drain 완료와 timeout 뒤 잔여 drop/shutdown metric 검증
25. fast-path와 CDC의 중복·역순·gap이 eventId/roomSequence dedup 및 REST replay로 최종 수렴
26. 전용 self-hosted Linux runner의 동일 멀티노드 topology에서 10→50→150→300 message write/s 단계별
    출시 회귀를 검증한다. runner는 CPU 8개 이상, memory 16GiB 이상, file descriptor 65,536 이상이며
    시험 중 다른 workload를 실행하지 않는다. 각 단계는 drop·처리율, REST p95/p99, DB connection
    acquire/usage/pending 시계열, queue depth/rejection, publish failure, Kafka lag와 §14.2 SLO를 기록하고,
    이전 단계 실패 시 상위 단계 및 20k socket·장시간 시험을 진행하지 않는다.
27. GitHub-hosted diagnostic은 topology/readiness, 양 gateway prewarm, Kafka consumer 2개와 active monitor 1개,
    keep-alive와 fixture별 client IP 분산을 assert한 뒤 10/s smoke까지만 수행한다. scheduled iteration drop 0,
    HTTP 201 100%, REST p95 < 200ms, p99 < 500ms를 검증하지만 가변 공유 host 결과는 release capacity
    evidence로 사용하지 않는다. self-hosted extended는 같은 assert와 10/s 검증부터 다시 시작하고 통과한 뒤에만
    50→150→300/s를 순서대로 출시 판정한다. 어느 환경에서든 실패하면 즉시 중단하고 상위 단계로 진행하지 않는다.
    HTTP timing·collector 실행 시각·app/gateway/infra metric과 로그, host/container CPU·memory·I/O,
    Hikari acquire/usage/pending 시계열, Kafka lag를 artifact로 남긴다. 모든 monitor를 꺼서 SLO를 판정하거나
    hosted 10/s smoke를 self-hosted 10/s 출시 검증 대신 사용하는 것은 허용하지 않는다.
28. 2-app release topology의 Hikari pool은 app별 `minimum-idle=32`, `maximum-pool-size=32`인 fixed pool,
    전체 64 connection으로 검증한다. `connection-timeout=1s`로 acquisition wait를 제한하며 timeout으로
    성공률이나 latency 실패를 숨기지 않는다. MySQL `@@max_connections`는 96 이상이고 app pool 합계 64 외에
    Connect·worker·관리 connection을 위한 32 이상의 reserve가 남는지 부하 전에 assert한다. 단계별로
    `Threads_connected`, `Threads_running`, `Connections`, `Aborted_connects`와 Hikari timeout을 수집한다.
    동일 extended를 10→50→150→300/s, 300/s 5분, 1,000/s 60초 burst 순서로 처음부터 재검증하고 burst가
    drop 0·HTTP 201 100%·§14.2 SLO를 통과한 뒤에만 100→1,000→5,000→20,000 socket 단계로 진행한다.
    pool 32에서 burst가 실패하면 pool을 추가 증설하지 않고 DB CPU·lock·I/O 또는 send 응답 후속 조회 제거안을
    게이트2에 다시 상신한다.

---

## 15. 게이트2 승인 결정

아래 6건은 2026-08-18 사용자가 권고안 전부를 승인해 확정됐다. 대안 표는 선택 근거 보존용이다.

### G2-CHAT-1 — 영속 명령과 실시간 protocol 경계 — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (권고) | REST write/replay + STOMP push, STOMP SEND 금지 | 기존 MVC/보안/validation 재사용, 장애 복구 명확 |
| B | STOMP SEND까지 영속 명령 허용 | 단일 socket UX, 별도 validation/idempotency/error/ACK 복잡도 |
| C | SSE push + REST write | 더 단순한 단방향이나 향후 실시간 상호작용 확장 제약 |

**승인:** A. `/ws/chat` native WebSocket, `/user/queue/chat.events` 하나만 허용한다.

### G2-CHAT-2 — DB 순서·멱등·스키마 — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (권고) | direct room row lock + 방별 sequence + client UUID unique | 단순하고 엄격한 방별 순서, hot room만 직렬화 |
| B | DB auto id를 전역 순서로 사용 | 방별 gap/정확한 cursor 의미가 약함 |
| C | Redis/Kafka에서 sequence 배정 | 인프라 장애가 정확성과 쓰기에 전파 |

**승인:** A와 §5의 6개 테이블. Redis는 정확성 수단으로 사용하지 않는다.

### G2-CHAT-3 — 멀티노드 fan-out과 outbox/CDC — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (권고) | Redis Pub/Sub fast-path + DB outbox→별도 Debezium→Kafka fallback | 저지연+내구 복구, connector/consumer 운영 증가 |
| B | DB + Redis Pub/Sub만 | 가장 단순, node crash 직후 push는 reconnect 전까지 유실 |
| C | Kafka만, node별 broadcast group | Redis 제거 가능하나 node group lifecycle/latency/운영 복잡 |
| D | Redis Streams node별 group | Redis 내구성, 고아 group·retention·fan-out 운영 복잡 |

**승인:** A. 기존 검색 connector를 수정하지 않고 outbox 전용 connector를 추가한다.

### G2-CHAT-4 — 인증·차단·abuse 정책 — APPROVED

**승인값:** STOMP CONNECT bearer 인증, query token 금지, strict Origin, user destination only,
양방향 전송을 막는 방향성 block, 메시지 snapshot 신고, user+IP 이중 rate limit, Redis limiter 장애 시
gateway 제한을 남긴 fail-open을 승인한다.

대안은 handshake cookie 인증/CSRF 또는 rate limiter fail-closed다. 현재 stateless JWT 기준선과 가용성 원칙상
승인값이 일관된다.

### G2-CHAT-5 — 본문·보존·event privacy — APPROVED

**승인값:** 평문 텍스트 DB 저장(E2EE 없음), 일반 메시지 180일, 신고 증거 3년, outbox/Kafka metadata 7일,
outbox·Kafka·Redis에는 원문을 넣지 않고 local DB hydration 뒤 TLS STOMP frame에만 원문을 담는다.

보존 30/90일은 비용·개인정보 면에서 유리하지만 거래 분쟁 증거가 짧고, 무기한 보존은 UX는 좋지만 비용과
삭제권 위험이 크다. 실제 기간은 운영/법무 요구와 함께 승인해야 한다.

### G2-CHAT-6 — 용량과 성능 기준 — APPROVED

**승인값:** §14의 20k 동시 socket, 300 write/s 지속, 1,000/s burst, 3,600만 row 기준이며,
초기에는 table partition을 도입하지 않는다. 5천만 row 또는 purge 10분을 재상신 trigger로 둔다.

### G2-CHAT-7 — commit 이후 Redis fast-path 비동기 전달 — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (승인) | immutable metadata snapshot을 전용 bounded executor에 non-blocking enqueue | HTTP/JDBC와 Redis I/O 격리, 포화 시 fast-path drop을 명시적으로 수용 |
| B | `afterCommit()`에서 Redis 동기 publish | 단순하나 Redis 지연이 JDBC resource 반환과 요청 처리량에 전파 |
| C | shared `@Async`/무제한 queue·thread | 구현은 간단하나 workload 격리·backpressure·종료 상한을 보장하지 못함 |

**승인:** A와 §7.4의 실패·포화·종료 의미론을 2026-08-20 승인했다. rejection/worker failure는 요청 실패나
동기 fallback이 아니며 DB outbox→Kafka가 내구성 fallback이다. 외부 REST/STOMP/event schema와 ERD는 불변이다.

### G2-CHAT-8 — 전역 backlog/Kafka lag collector 단일 실행 — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (승인) | consumer와 monitor를 분리하고 배포당 1개 active app collector 운영 | 중복 전역 조회 제거와 최소 변경, collector 장애 시 stale 감시·이전 runbook 필요 |
| B | 모든 replica에서 수집하되 initial delay/jitter 적용 | 동시 충돌은 줄지만 replica 수에 비례한 중복과 개별 probe 간섭이 남음 |
| C | Kafka exporter/전용 observability collector로 즉시 이관 | 책임 분리와 고가용성은 우수하나 FC-329 해소 범위를 넘는 배포·metric 변경 필요 |

**승인:** A와 §13.4·§14.3의 단일 active collector 및 단계별 Linux 검증 계약을 2026-08-21 승인했다.
Kafka consumer는 양 app replica에서 유지하고 collector 장애는 stale/failure metric·alert·runbook으로 보완한다.
외부 REST/STOMP/event 계약과 DB schema·ERD는 불변이다. C는 장기 운영 고도화 선택지로 남긴다.

### G2-CHAT-9 — hosted smoke와 self-hosted 출시 판정 경계 — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (승인) | hosted는 10/s smoke, self-hosted extended는 10→50→150→300/s 출시 판정 | hosted wiring 회귀를 빠르게 찾으면서 출시 수치는 격리된 자원에서 재현 |
| B | diagnostic 전체를 self-hosted로 이전 | 환경은 일관되나 모든 진단이 희소 전용 runner에 의존하고 hosted smoke를 잃음 |
| C | hosted에서 자원·container를 조정해 50/s 이상 판정 유지 | 공유 host CPU·I/O와 noisy neighbor를 통제할 수 없어 출시 근거가 재현되지 않음 |

**승인:** A와 §14.3의 runner 책임 경계를 2026-08-21 승인했다. §14.2 SLO와 10→50→150→300/s
순서, 단계 실패 즉시 중단 조건은 불변이다. hosted smoke는 출시 용량 증거가 아니며 self-hosted extended가
10/s부터 독립적으로 판정한다. 외부 REST/STOMP/event 계약과 DB schema·ERD는 불변이다.

### G2-CHAT-10 — 1,000/s burst DB connection capacity — APPROVED

| 선택지 | 내용 | 장단점 |
|---|---|---|
| A (승인) | app별 Hikari fixed pool 32, 전체 64와 MySQL connection reserve를 bounded 검증 | 확인된 acquisition queue를 최소 설정으로 해소, DB 병목 전이를 telemetry로 통제 |
| B | send 결과에 sender public ID를 담아 응답 후속 사용자 조회 제거 | 요청당 DB 작업을 줄이나 내부 서비스 계약·코드 변경이며 pool 10으로 burst 충족 보장 없음 |
| C | app replica를 4개 이상으로 수평 확장 | app CPU/pool은 늘지만 중앙 MySQL connection·CPU 부하와 운영 topology 변경 반경이 큼 |

**승인:** A와 §14.3의 fixed pool·MySQL reserve·전체 extended 재검증 계약을 2026-08-21 승인했다.
pool 32는 추가 증설 전 재상신이 필요한 단일 bounded 후보이며, 실패 시 B 또는 DB 병목 분석으로 돌아간다.
외부 REST/STOMP/event 계약과 DB schema·ERD는 불변이다.

---

## 16. 확정 영향 티켓/산출물

현재 확인되는 EPIC-CHAT 하위 티켓 중 직접 영향은 다음과 같다.

| 대상 | 영향 |
|---|---|
| `FC-316` | 본 문서 v1.0, `api-contract.md` v1.27, `erd.md` v2.0 정본 확정 |
| `FC-317` | 승인된 Vuexy 방 목록·대화·차단·신고 UX가 REST/STOMP DTO와 reconnect/gap 계약을 소비 |
| `FC-335` | §7.4 bounded executor 구현·단위/통합 테스트와 fast-path 저카디널리티 metric을 소비 |
| `FC-338` | §13.4의 monitor 독립 설정·단일 active collector·stale/failure 관측과 Linux topology assert를 구현 |
| `FC-339` | §14.3에 따라 hosted diagnostic을 10/s smoke로 한정하고 self-hosted extended의 출시 판정 경계를 구현 |
| `FC-340` | §14.3의 app별 Hikari fixed pool 32·MySQL reserve/assert·connection telemetry와 burst 재검증을 구현 |
| `FC-329` | §14.3의 self-hosted 10→50→150→300/s release topology 재검증과 출시 판정을 수행 |
| `FC-324` | FC-335 구현 및 FC-329 재검증 결과를 reviewer 변경 요청 해소의 근거로 재검토 |

메인세션이 발급할 구현 티켓 입력은 다음과 같다. `CHAT-*`는 발급 전 임시 키다.

| 임시 키 | owner | depends_on | 책임/쓰기 집합 | contract_ref |
|---|---|---|---|---|
| CHAT-BE-CORE | backend-impl | FC-316 | V25, 6 entity/repository, room sequence·멱등·읽음·차단 경합, 신고·보존 worker | 본 문서 §5·§6·§10, erd §4.6·§5·§6 |
| CHAT-BE-REST | backend-impl | CHAT-BE-CORE | REST controller/service/DTO/ChatErrorCode와 통합테스트 | api-contract §2.7·§5 |
| CHAT-BE-RT | backend-impl | CHAT-BE-CORE | WebSocket/STOMP 인증·인가·session lease, gateway ws route/IP limit, Redis Pub/Sub adapter | 본 문서 §7~§9, api-contract §2.7.1~2.7.2 |
| CHAT-BE-CDC | backend-impl | CHAT-BE-CORE | outbox AFTER_COMMIT fast-path, 별도 Debezium connector, Kafka consumer/재발행·lag metric | 본 문서 §4·§7·§11·§13 |
| CHAT-FE | frontend-impl | FC-316, FC-317 | 승인 Vuexy UI의 REST/STOMP client, optimistic/dedup, gap replay, 차단·신고 UX | api-contract §2.7, 본 문서 §8·§10 |
| CHAT-PERF | backend-impl | CHAT-BE-REST, CHAT-BE-RT, CHAT-BE-CDC | 멀티노드·장애·20k socket·300/s 지속·1k/s burst 부하/복구 테스트 | 본 문서 §11·§14 |
| CHAT-REVIEW | reviewer | CHAT-BE-REST, CHAT-BE-RT, CHAT-BE-CDC, CHAT-FE, CHAT-PERF | 보안·IDOR·JWT exp·접근성/UX·장애 복구 최종 판정 | 본 문서 §8~§14, api-contract §2.7·§5 |

계약을 바꾸면 위 티켓 전체와 FC-317의 mock/workbench 계약을 먼저 영향 분석해야 한다.
특히 CHAT-BE-RT는 공용 `TokenProvider`/`TokenClaims`에 검증된 access-token 만료 시각을 노출하는 가법적 변경과
기존 JWT 필터 회귀 테스트를 포함한다. access/refresh token의 외부 형상이나 만료 시간 자체는 바꾸지 않는다.

---

## 17. 정본 반영 결과

2026-08-18 architect가 다음 정본 반영을 완료했다.

1. 본 문서 v1.0/APPROVED 승격
2. `docs/spec/erd.md` v2.0에 6개 테이블·인덱스·관계 반영
3. `docs/spec/api-contract.md` v1.27에 REST/STOMP 계약과 `CHAT_*` 오류 반영
4. 후속 구현 티켓은 메인세션이 생성하면서 `contract_ref`를 본 문서/API/ERD의 구체 절로 고정

계약 확정은 구현 승인이며 migration, WebSocket dependency, gateway route, Kafka connector의 실제 변경은
각 후속 구현 티켓 소유자가 수행한다.

---

## 변경 이력

| 버전 | 날짜 | 상태 | 변경 |
|---|---|---|---|
| v1.5 | 2026-08-21 | **APPROVED** | G2-CHAT-10 권고안 A 승인 반영. app별 Hikari min/max 32 fixed pool·connection timeout 1초, MySQL `@@max_connections` 96 이상과 32 connection reserve/assert·운영 telemetry를 확정. 동일 extended 전체 재검증과 burst 통과 후 socket 진입, 실패 시 추가 pool 증설 금지·재상신 조건 명시. FC-340·FC-329·FC-324 영향. 외부 REST/STOMP/event 계약과 DB schema·ERD 불변 |
| v1.4 | 2026-08-21 | **APPROVED** | G2-CHAT-9 권고안 A 승인 반영. hosted diagnostic은 topology·prewarm·단일 monitor·10/s smoke로 한정하고, 격리된 self-hosted extended에서 10→50→150→300/s 출시 판정을 수행하도록 runner 경계를 확정. SLO·실패 즉시 중단은 불변이며 host/container 자원·Hikari 시계열·Kafka lag artifact를 추가. FC-337·FC-329·FC-324 영향 명시. 외부 REST/STOMP/event 계약과 DB schema·ERD 불변 |
| v1.3 | 2026-08-21 | **APPROVED** | G2-CHAT-8 권고안 A 승인 반영. consumer는 양 app에서 유지하되 전역 outbox/Kafka lag collector는 배포당 1개만 활성화하고 stale/failure 관측·alert·runbook 및 Linux 10→50→150→300/s 중단 조건을 확정. FC-338·FC-329·FC-324 영향 명시. 외부 REST/STOMP/event 계약과 DB schema·ERD 불변 |
| v1.2 | 2026-08-20 | **APPROVED** | G2-CHAT-7 권고안 A 승인 반영. commit 이후 metadata-only snapshot을 전용 bounded executor에 non-blocking enqueue하고 포화·실패·종료는 metric/drop, outbox→Kafka는 내구 fallback으로 확정. FC-335·FC-329·FC-324 영향 명시. 외부 REST/STOMP/event schema·ERD 불변 |
| v1.1 | 2026-08-19 | **APPROVED** | FC-332 outbox retention 인덱스 게이트2 승인 반영. V27 `(created_at,id)` 가법 인덱스와 배포·롤백·검증 계약 확정 |
| v1.0 | 2026-08-18 | **APPROVED** | G2-CHAT-1~6 권고안 전건 사용자 승인. API v1.27·ERD v2.0 정본 반영. 전역 ERD 규약에 따라 association 2종에 내부 대리 PK 추가(논리 UK 불변) |
| v0.1 | 2026-08-18 | 게이트2 초안 | 1:1 채팅 DB/REST/STOMP/Redis/Kafka/보안/보존/성능 설계 |
