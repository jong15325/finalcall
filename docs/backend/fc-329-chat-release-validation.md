# FC-329 채팅 출시 용량·장애 복구 재검증

- 티켓: FC-329 / KAN-373
- 기준일: 2026-08-19
- 계약 정본: `docs/spec/chat-domain-spec.md` §14
- 결론: **출시 차단**. 300 write/s 짧은 단계부터 처리량·지연 목표에 미달했고, 필수 장시간 용량 및 장애·보존 회귀는 중단 지시에 따라 미측정이다.

## 1. 환경과 측정 경계

| 항목 | 값 |
|---|---|
| 호스트 | Windows 11 Pro, Ryzen 9 7900 12C/24T, RAM 63.1 GiB |
| 앱 | 현재 source의 bootJar 2개 OS process, port 18088/18089, heap 각 1.5 GiB |
| Gateway | SCG 2개 OS process, port 18090/18091, 각 앱 node로 고정 라우팅 |
| 데이터/CDC | 실제 MySQL 8, Redis 7, Kafka 3.8, chat Kafka Connect/Debezium |
| 발생기 | Docker `grafana/k6:0.57.0`, Docker memory limit 30.9 GiB |
| fixture | 실제 signup/login/direct-room API로 1,500명·750방 생성(201.1초), socket smoke는 동일 HS256 검증 경로의 고유 subject fixture |

두 Gateway를 k6 VU 기준으로 교대 선택했다. 단일 load-generator가 수천 client IP를 물리적으로 만들 수 없어
용량 단계에서는 `trusted-proxy-count=1`과 fixture별 `X-Forwarded-For`로 **통제된 앞단 프록시를 모사**했다.
따라서 이는 실제 ingress hop을 포함한 IP 경계 검증으로 과장하지 않는다. JWT·비밀번호·fixture는 임시
디렉터리에만 두었고 보고서와 로그에 기록하지 않았다.

## 2. 완료한 검증

### 2.1 멀티노드 WebSocket smoke

두 Gateway가 각각 다른 앱 node로 연결되는 조건에서 실제 STOMP 1.2 CONNECT/SUBSCRIBE를 2/2 수립했다.
upgrade 성공률과 CONNECT 성공률은 모두 100%, CONNECT p95는 267.1ms였다. 이는 topology smoke일 뿐
20,000 socket 용량 증거가 아니다.

### 2.2 단계 쓰기 부하

지연은 Gateway를 포함한 end-to-end 값이다. DB commit 전용 계약 metric이 현재 앱에 노출되지 않아 정확한
DB commit histogram으로 대체하지 못했다. end-to-end가 SLO 이하면 DB commit도 상한 안이라는 보수적
근거로만 사용했고, 초과한 경우 DB commit SLO 통과를 주장하지 않는다.

| 조건 | 예정/완료/drop | 실효량 | 성공 | avg / p95 / p99 / max | 판정 |
|---|---:|---:|---:|---:|---|
| 50/s, 30초, pool 10×2 | 1,501 / 1,501 / 0 | 49.98/s | 201 100% | 48.2 / 105 / 미수집 / 643ms | 단계 통과(p99 증거 없음) |
| 150/s, 30초, pool 10×2 | 4,501 / 4,501 / 0 | 149.88/s | 201 100% | 79.7 / 198 / 305 / 492ms | 단계 통과 |
| 300/s, 30초, pool 10×2 | 9,001 / 6,849 / 2,152 | 182.86/s | 완료분 201 100% | 5.23 / 8.59 / 9.48 / 11.96초 | 실패 |
| 300/s, 30초, pool 30×2 | 9,000 / 6,977 / 2,023 | 201.37/s | 완료분 201 100% | 5.59 / 8.16 / 9.24 / 12.92초 | 실패 |

`완료분 100%`를 용량 통과로 해석하지 않는다. 300/s에서 arrival-rate를 따라가지 못해 1,500 VU 상한까지
증가하고 22~24%가 drop됐다.

### 2.3 generator와 애플리케이션 병목 분리

- pool 10 기준 300/s 중간 표본: k6 CPU 32.6%, memory 412 MiB, OOM 없음; MySQL 244.8%, Redis 16.8%,
  Kafka 170.1%. generator CPU·memory 한계보다 서버 응답 대기가 먼저 발생했다.
- 두 앱 Hikari의 커넥션 획득 누적 대기는 각각 약 32,978초/32,971초, 최대 4.62초/4.70초였다. 반면
  커넥션 실제 사용 최대는 137ms/123ms였다. pool 대기가 직접 포화 증거였다.
- MySQL `max_connections=151`에서 pool을 10→30/node로만 올려 재측정했다. 연결 상한은 73으로 안전했지만
  실효량은 201.4/s, p95는 8.16초로 목표에 크게 미달했다. 수치만 더 키우는 튜닝은 중단했다.
- 소스 프로파일링에서 확인한 가장 유력한 애플리케이션 병목은 `ChatRedisFanoutListener`의 클래스 레벨
  read-only transaction이
  `localRecipients()` 빈 결과를 확인하기 **전에** 시작된다. online socket이 없어 hydration이 불필요해도
  fast-path와 CDC가 만든 Redis event마다 각 node가 DB connection을 획득한다. 한 message가
  `MESSAGE_CREATED`와 `READ_UPDATED`를 만들고 fast-path+CDC 중복 및 2개 node fan-out이 겹치므로,
  불필요한 connection acquisition이 쓰기 pool과 경합할 수 있는 구조다. 이는 Hikari 대기와 정합하는
  원인 후보이나 per-event connection trace로 인과를 확정하지는 못했다. 중단 지시에 따라 코드 수정·재측정은 수행하지 않았다.

## 3. 스크립트 보강

- `k6-chat-load.js`: app/Gateway endpoint 복수 선택, 통제된 proxy client IP, p99 export,
  fixture 수 사전 검증, 실제 짧은 hold를 쓰는 reconnect, 원격 socket close metric을 추가했다.
- `prepare-chat-load-fixtures.ps1`: 각 실제 API 사용자에 테스트용 고유 client IP를 부여했다.
- `prepare-chat-socket-fixtures.ps1`: 20k socket의 사용자당 3개 quota를 지키기 위한 6,667개 고유 HS256
  subject fixture를 저장소 밖에 생성한다. secret은 환경변수로만 받는다.
- `verify-chat-slow-client.ps1`: 누적 counter가 이미 증가한 경우의 위양성을 막아 before/after delta를
  단언하고, 느린 socket의 server-side close와 정상 socket 전건 수신을 별도로 확인한다.

PowerShell 전 스크립트 parser와 k6 `inspect`는 통과했다. 보강한 slow-client 스크립트의 실제 chaos 실행은
중단 지시로 수행하지 않았다.

## 4. 미측정·미재검증

다음 항목은 FC-329에서 통과 증거가 없으므로 모두 출시 차단 잔여다.

- 20,000 socket 10분 heartbeat, 1,000-user reconnect storm
- 300/s 5분, 1,000/s 60초 burst
- slow-client buffer metric 증가·느린 연결 종료·정상 session 격리 실제 실행
- retention batch 중 online p95와 replica lag(로컬에는 replica 자체가 없음)
- 실제 Gateway peer/신뢰 ingress를 포함한 IP 120/분 limiter
- 신고 10건 DB quota의 이번 release 환경 회귀
- Kafka/Connect/app process kill 및 catch-up/no-loss의 이번 release 환경 회귀
- 100개 gap p95, dispatch hydration 600 read/s
- 최종 backend/gateway/frontend 전체 build·test

FC-326/FC-327 선행 티켓의 개별 테스트 기록은 존재하지만 FC-329 release topology에서 재실행하지 않았으므로
이번 판정의 통과 근거로 재사용하지 않는다.

## 5. 검증 명령 결과와 출시 판정

- `:backend:bootJar :backend:gateway:bootJar`: 통과.
- PowerShell parser(`scripts/chat/*.ps1`): 통과.
- k6 inspect: 통과.
- 최종 전체 build/test: 미실행(중단 지시).

300/s 짧은 단계가 이미 처리량과 p95/p99를 크게 위반하고 필수 장시간·장애·보존 matrix가 미측정이므로
**FC-329는 실패이며 채팅 출시는 차단한다.** 다음 검증은 Redis fan-out listener의 transaction 시작 위치를
외부 transaction bean 또는 명시적 transaction template로 local-recipient 판정 뒤로 옮기고, 회귀 테스트로
online session이 없는 event가 DB connection을 얻지 않음을 증명한 뒤 동일 topology에서 처음부터 다시 해야 한다.

## 6. FC-330 적용 후 재측정

FC-330의 local recipient 선판정, node-local event dedup, 짧은 read-only hydration transaction 분리를 적용한 현재 source로
기존 production-like 2 app + 2 gateway + MySQL + Redis + Kafka/Connect topology를 재구성했다.

- fixture: 실제 API로 1,500명 생성, 사용자별 고유 client IP 1,500개, 생성 시간 201.2초
- 조건: 50 write/s, 30초, 두 gateway 교대 호출
- 결과: 예정 1,501건 / 완료 1,501건 / drop 0, 실효 처리율 49.987/s, HTTP 201 성공 1,501/1,501
- 지연: avg 100.06ms, p95 625ms, p99 1,195ms, max 1,278ms
- 판정: 성공률과 drop 조건은 충족했으나 `chat_write_duration` p95 < 200ms, p99 < 500ms threshold를 모두 초과해 실패
- 중단: 단계 중단 기준에 따라 150/s와 300/s는 실행하지 않았다.
- 참고 summary: 저장소 밖 `D:\tmp\fc329-recheck\k6-50s-summary.json`

따라서 FC-330은 무수신 fan-out의 불필요한 transaction 경계를 제거했지만, 이번 cold topology 첫 50/s 측정만으로는 출시 지연 기준을
충족하지 못했다. 다음 재측정 전에 app/gateway warmup, connection acquire, Redis/Kafka backlog를 분리 계측해야 한다.

### 6.1 V27 적용 후 50/s 응답 구간 분리

V27 retention 인덱스를 포함한 최신 bootJar로 native k6 50/s를 다시 측정했다. 두 측정 모두 HTTP 201 응답 자체는 전건 성공했지만 계약 지연 기준은 통과하지 못했다.

| 경로 | 완료 / drop | waiting p95 / p99 | receiving p95 / p99 | duration p95 | 판정 |
|---|---:|---:|---:|---:|---|
| app 직접(18088/18089) | 1,501 / 0 | 24.92 / 27.09ms | 641.76 / 766.01ms | 662.29ms | 실패 |
| gateway 2대 경유 | 1,496 / 5 | 28.18 / 30.91ms | 1,559.90 / 2,012.20ms | 1,582.22ms | 실패 |

근거 summary는 저장소 밖 `D:\tmp\fc329-recheck\k6-v27-native-direct-50s.json`, `D:\tmp\fc329-recheck\k6-v27-native-50s.json`에 보존했다.

확정된 사실:

- `http_req_waiting`은 direct와 gateway 모두 p99 약 31ms 이하이므로 인증, room lock, DB transaction, Jackson이 첫 바이트를 만들기 전까지의 처리가 이번 지연의 주된 구간은 아니다.
- 지연은 첫 바이트 이후인 `http_req_receiving`에 집중된다. direct에서도 p95 641.76ms이며 gateway hop을 추가하면 p95 1.56초로 커진다.
- `ChatController.sendMessage()`는 작은 record DTO를 `ApiResponse`로 감싸는 일반 Jackson 응답이다. 스트리밍, 대용량 본문, response caching wrapper는 없다.
- `AccessLogFilter`는 본문이나 헤더를 복사하지 않고 `chain.doFilter()` 경과시간만 기록한다. `ServiceLogAspect`도 메서드 경과시간 로깅만 수행한다.
- 응답 압축 및 Tomcat connector/thread 별도 튜닝은 없다. 작은 동적 JSON은 명시적인 `Content-Length` 계산 없이 servlet 응답 버퍼와 HTTP framing에 맡겨진다.

가장 유력한 추정은 Windows loopback의 작은 응답 패킷, HTTP/1.1 chunked framing, delayed ACK/Nagle 상호작용 또는 native k6 Go transport의 body drain 스케줄링이다. 첫 바이트는 즉시 도착하지만 작은 나머지 body 수신만 수백 ms 단위로 늘어나고 gateway hop에서 더 확대되는 관측과 맞는다. gateway의 Netty-to-Tomcat 프록시 hop이 작은 chunk 전달 및 flush 횟수를 늘려 같은 현상을 증폭했을 가능성이 뒤를 잇는다. DTO 직렬화나 `afterCommit`은 통상 첫 바이트 이전 waiting에 포함되므로 가능성이 낮다.

분석 시점에는 토폴로지가 종료되어 단일 요청의 실제 `Content-Length`/`Transfer-Encoding` 헤더와 TCP packet trace를 회수하지 못했다. 다음 재검증에서는 부하 전에 curl verbose로 framing을 기록하고 Linux 실행기 또는 `TCP_NODELAY`/명시적 content-length 조건을 한 번에 하나씩 비교해야 한다.

## 7. fresh token warmup과 150/s 원인 분리

앞선 warmed 측정은 JWT 만료로 401 경로를 측정한 것으로 확인돼 무효 처리했다. 새 1,500명 fixture를 만든 직후 10/s 10초
warmup과 신규 write 50/s 30초를 연속 실행한 결과는 다음과 같다.

| 조건 | 완료 / drop | 실효 처리율 | 201 성공 | avg / p95 / p99 / max | 판정 |
|---|---:|---:|---:|---:|---|
| fresh warmup 후 50/s, 30초 | 1,500 / 0 | 49.988/s | 1,500/1,500 | 26.56 / 30 / 57.02 / 292ms | 통과 |
| fresh 150/s, 30초 | 3,367 / 1,134 | 77.96/s | 완료분 201 | 미기록 / 13.12초 / 미기록 / 미기록 | 실패 |

150/s 실패 시점 관측값은 Hikari acquire max가 약 1ms인 반면 connection usage max는 app1 9.738초, app2 9.955초였고,
HTTP 201 처리 max는 6.36초였다. Kafka consumer lag는 전 partition 0, Redis publish failure도 0이었다. 중단 기준에 따라
300/s는 실행하지 않았다.

### 7.1 원인 분석

확정된 사실:

- connection을 얻기 위한 대기는 병목이 아니다. acquire max 약 1ms와 달리 이미 얻은 connection의 점유 시간이 최대 약 10초다.
- `sendMessage()` transaction은 room row `FOR UPDATE` 뒤 idempotency 조회, 상대/차단/발신자 조회, message insert,
  sender read state 갱신, `MESSAGE_CREATED`와 `READ_UPDATED` outbox insert를 수행한다.
- fast-path는 outbox `save()`마다 transaction synchronization을 등록하고 `afterCommit()`에서 Redis publish를 실행한다.
  Spring transaction synchronization의 `afterCommit()`은 resource cleanup보다 먼저 호출되므로 이 동기 publish 동안 JDBC connection이
  transaction resource에 묶여 있을 수 있다.
- Kafka lag 0과 Redis publish failure 0은 유실·backlog가 없다는 뜻이지 Redis publish 호출이 빠르다는 증거는 아니다.
- 부하 종료 후 processlist는 app connection이 모두 Sleep이었고 앱 로그에는 connection timeout, deadlock, Redis publish failure가 없었다.
  현재 계정에는 `performance_schema.data_lock_waits` 조회 권한이 없어 과거 lock wait를 직접 확정하지 못했다.

가장 유력한 추정:

1. 두 outbox event의 동기 `afterCommit()` Redis publish가 connection 반환 전에 실행되어, 150/s에서 Redis/Lettuce 또는 후속 local
   listener 처리 경합이 connection usage를 수초까지 늘린다. connection acquire가 아니라 usage만 긴 관측과 코드 경계가 직접 부합한다.
2. room row lock 경합은 각 fixture가 서로 다른 1:1 room을 사용하고 DB commit은 `afterCommit()`보다 먼저 끝나므로 전역적인 13초
   p95의 주원인 가능성이 낮다. 동일 room 요청이 집중됐다면 commit 전 구간의 증폭 요인일 수는 있다.
3. idempotency·참여자·차단 조회와 message/outbox insert 자체의 누적 DB 비용은 남지만, 50/s에서 p95 30ms이고 Hikari acquire가 약 1ms라
   단독으로 150/s의 13.12초 p95를 설명하는 근거는 부족하다.

다음 검증에서는 `afterCommit` publish 시간과 transaction resource cleanup 시점을 별도 metric으로 계측하고, Redis publish를 connection
반환 뒤 실행하는 경계로 분리한 뒤 같은 150/s 짧은 단계를 재측정해야 한다.

## 8. FC-335 비동기 fast-path 적용 후 재검증 (2026-08-20)

FC-335의 bounded executor와 metadata-only snapshot을 포함한 최신 bootJar로 기존 release topology를 다시 구성했다.
FinalCall 전용 MySQL, Redis, Kafka, chat Kafka Connect, Elasticsearch, MinIO와 backend 2개(18088/18089),
gateway 2개(18090/18091)만 기동했다. 별도 on-race 컨테이너와 프로세스는 변경하지 않았다.

- backend heap: 노드별 1.5 GiB, Hikari 기본 pool
- gateway heap: 노드별 512 MiB, 각 backend node로 고정 라우팅
- gateway client IP: `trusted-proxy-count=1`, fixture별 고유 `X-Forwarded-For`
- fixture: 실제 signup/login/direct-room API로 fresh 1,500명·750방 생성
- 발생기: native k6 0.57.0, `K6_NO_CONNECTION_REUSE=true`
- 외부 결과: `D:\tmp\fc329-fc335-recheck\k6-warmup-10s.json`, `k6-50s.json`

### 8.1 단계 결과와 중단

| 조건 | 예정 / 완료 / drop | 실효 처리율 | HTTP 성공 | avg / p95 / p99 / max | 판정 |
|---|---:|---:|---:|---:|---|
| 10/s warmup, 10초 | 101 / 101 / 0 | 10.07/s | 201 101/101 | 41.77 / 51 / 310 / 410ms | 통과 |
| 50/s, 30초 | 1,501 / 1,501 / 0 | 49.99/s | 201 1,501/1,501 | 83.79 / 551 / 652 / 770ms | 실패 |

50/s에서 요청 손실과 처리량 미달은 없었지만 `chat_write_duration`의 p95 200ms, p99 500ms 기준을 모두
위반했다. 실패 즉시 중단 규칙에 따라 150/s, 300/s 단기 단계와 300/s 5분, 1,000/s burst, 20,000 socket,
reconnect/slow-client 및 Kafka/Connect/app kill 복구 matrix는 실행하지 않았다.

### 8.2 서버·파이프라인 관측

50/s의 응답 구간은 `http_req_waiting` p95 32.81ms, p99 39.72ms인 반면 `http_req_receiving` p95 526.19ms,
p99 622.02ms였다. 즉 DB commit과 첫 byte 이전 서버 처리보다 Windows native k6가 작은 chunked 응답 body를
수신하는 구간에 tail이 집중됐다.

| 관측 | app1 | app2 |
|---|---:|---:|
| Hikari acquire max | 1.157ms | 1.162ms |
| Hikari usage max | 92ms | 166ms |
| Hikari pending | 0 | 0 |
| fast-path accepted / rejected | 1,600 / 0 | 1,604 / 0 |
| fast-path publish success / failed | 1,600 / 0 | 1,604 / 0 |
| fast-path queue depth / active worker | 0 / 0 | 0 / 0 |
| fast-path shutdown drop | 0 | 0 |
| Redis publish success / failed | 3,200 / 0 | 3,208 / 0 |

Kafka consumer group `finalcall-chat-fanout-v1`은 12개 partition 모두 lag 0이었고 lag 수집 실패도 0이었다.
Redis publish failure, Hikari timeout, deadlock 로그는 없었다. 이전 150/s 실패에서 관측한 9~10초 connection usage는
재현되지 않았으므로 FC-335가 동기 `afterCommit` Redis I/O와 JDBC resource 반환의 결합을 제거했다는 증거와 정합한다.
다만 이번 release 판정은 50/s 응답 지연 기준 위반으로 여전히 실패다.

### 8.3 판정 한계와 후속 검증

이번 결과는 Windows loopback + native k6 + HTTP/1.1 no-connection-reuse 통제 조건이다. 작은 chunked response의
`receiving` tail이 지배하므로 서버 write 용량 한계로 해석할 수 없다. Linux 실행기에서 keep-alive 조건으로 최종 용량을
별도 재확인해야 한다. 그 검증 없이 150/s 이상이나 장시간·장애 matrix의 통과를 주장할 수 없다.

### 8.4 Linux k6 기본 keep-alive 재확인

동일하게 실행 중인 topology와 fresh fixture를 유지하고 공식 `grafana/k6:0.57.0` Linux/amd64 컨테이너에서
gateway 18090을 `host.docker.internal`로 호출했다. 부하 스크립트와 fixture는 read-only mount했고 결과 디렉터리만
쓰기 mount했다. 이 측정은 단일 gateway 18090과 그 하위 app1(18088) 경로다.

| 조건 | 예정 / 완료 / drop | 실효 처리율 | HTTP 성공 | avg / p95 / p99 / max | 판정 |
|---|---:|---:|---:|---:|---|
| Linux 10/s warmup, 10초 | 100 / 100 / 0 | 10.00/s | 201 100/100 | 30.50 / 29.24 / 234.99 / 333ms | 통과 |
| Linux 50/s, 30초 | 1,501 / 1,501 / 0 | 49.99/s | 201 1,501/1,501 | 25.08 / 36 / 39 / 72ms | 통과 |
| Linux 150/s, 30초 | 4,501 / 3,594 / 907 | 77.03/s | 완료분 201 3,594/3,594 | 8.59초 / 16.22초 / 16.54초 / 16.66초 | 실패 |

Linux 50/s에서 `http_req_waiting` p95/p99는 25.23/28.64ms, `http_req_receiving` p95/p99는
11.22/13.14ms였다. Windows 50/s의 receiving p95 526.19ms와 달리 정상 범위이므로 Windows 결과의 chunked
receiving tail은 실행기·호스트 경계 왜곡으로 분리됐다.

반면 Linux 150/s는 `http_req_waiting` p95/p99 14.36/14.42초, `http_req_receiving` p95/p99
4.26/5.03초로 첫 byte 이전 서버 지연이 지배했다. app1 Hikari acquire max는 1.182ms, pending은 0이었지만
connection usage max는 5.155초였다. app2는 acquire max 1.238ms, pending 0, usage max 26ms였다.

Linux 세 단계의 5,195개 완료 메시지는 app1 fast-path event 10,390건으로 정확히 대응했다. app1 fast-path
accepted/publish success는 각각 10,390 증가했고 rejection, publish failure, shutdown drop은 모두 0이었다.
Redis publish failure도 양쪽 0, Kafka consumer group은 12개 partition 모두 lag 0이었다.

150/s 실패 즉시 중단 규칙에 따라 Linux 300/s 단기 단계와 모든 장시간·장애 matrix는 실행하지 않았다.
FC-335의 비동기 fast-path queue는 병목이 아니지만, 단일 gateway/app 경로의 실제 처리율이 약 77/s에서 포화되고
DB connection usage가 최대 5.155초로 증가했다. 코드 변경을 확대하지 않았으며, 다음 원인 분리는 app1의 transaction
내부 DB 구간(room lock, 참여자·차단·멱등 조회, message/read/outbox write)을 별도 계측하는 작업이 필요하다.

근거 summary는 저장소 밖 `D:\tmp\fc329-fc335-recheck\k6-linux-warmup-10s.json`,
`k6-linux-50s.json`, `k6-linux-150s.json`에 보존했다.

### 8.5 Linux 150/s 실패 원인 분리와 2-node 대조

실행 중인 프로세스의 command line을 다시 확인한 결과 gateway 18090은 backend 18088(app1), gateway 18091은
backend 18089(app2)로 HTTP와 WebSocket을 각각 고정 라우팅한다. 8.4의 Linux 측정은 gateway 18090 하나만 호출했으므로
부하가 app1에 집중됐다. 실제로 해당 실행 전후 fast-path event는 app1에서만 10,390건 증가했고 app2는 증가하지 않았다.

계약 §14.3의 20,000 socket + 300 write/s와 50→150→300 단계는 동일한 multi-node topology에서 검증하도록 규정한다.
기존 release 검증도 Hikari pool 10개인 app 2대와 gateway 2대를 두고 VU별 gateway를 교대 선택했으며,
`scripts/chat/k6-chat-load.js` 역시 `CHAT_BASE_URLS`의 복수 endpoint를 VU 기준으로 교대한다. 따라서 현재 승인된
production-like 목표는 **2-node cluster 합산 처리량**이다. 이를 node당 목표로 재해석하지 않는다.

원인 분리 중 첫 2-gateway total 100/s 실행은 `CHAT_FORWARD_CLIENT_IP=true`를 누락했다. 모든 요청이 Docker host의
동일 client IP로 보이면서 두 gateway의 chat rate-limit 초기 bucket 합계에 해당하는 180건만 201로 완료되고 나머지가
즉시 거절됐다. JWT 만료는 아니었으며 이 실행은 시스템 용량 결과에서 제외한다. summary는 원인 추적 목적으로만
`D:\tmp\fc329-fc335-recheck\k6-linux-cluster-100s.json`에 보존했다.

기존 검증 조건인 fixture별 고유 client IP 전달을 복원한 뒤 두 gateway를 교대 호출해 total 100/s를 30초간 다시 측정했다.

| 조건 | 예정 / 완료 / drop | 실효 처리량 | HTTP 성공 | avg / p95 / p99 / max | 판정 |
|---|---:|---:|---:|---:|---|
| Linux 2-gateway total 100/s, 30초 | 3,001 / 2,710 / 291 | 76.50/s | 완료분 201 2,710/2,710 | 3.80초 / 5.77초 / 5.88초 / 6.00초 | 실패 |

`http_req_waiting` p95/p99는 1.00/1.12초였지만 `http_req_receiving` p95/p99가 5.64/5.70초로 지연의 대부분을
차지했다. 실패 즉시 확대 중단 규칙에 따라 2-gateway 150/s는 실행하지 않았다. 유효 summary는
`D:\tmp\fc329-fc335-recheck\k6-linux-cluster-100s-clientip.json`에 보존했다.

같은 측정 창의 server-side access log와 인프라 지표는 다음과 같다.

| 관측 | app1 | app2 |
|---|---:|---:|
| message POST 201 건수 | 1,356 | 1,354 |
| access 처리시간 평균 / 최대 | 20.14 / 32ms | 21.23 / 60ms |
| access 처리시간 200ms 초과 | 0 | 0 |
| fast-path accepted / publish success | 14,854 / 14,854 | 4,520 / 4,520 |
| fast-path rejected / publish failed / shutdown drop | 0 / 0 / 0 | 0 / 0 / 0 |
| fast-path queue depth / active worker | 0 / 0 | 0 / 0 |
| Hikari acquire max / pending | 1.193ms / 0 | 1.075ms / 0 |
| Hikari usage max | 4.818초 | 32ms |
| Redis publish failure | 0 | 0 |

두 app의 요청 수와 실제 access 처리시간은 균등했고 모든 요청이 최대 60ms 안에 201로 처리됐다. Kafka consumer lag은
12개 partition 모두 0이고 lag 수집 실패도 0이었다. 따라서 이번 실패를 shared DB, Redis publish 또는 FC-335
fast-path queue의 처리 한계로 귀속할 증거는 없다.

app1의 긴 Hikari usage에는 별도 오염 정황이 있다. 단일 gateway 150/s 창에는
`ChatRetentionService.purgeOutboxBatch`가 2.618초 걸린 slow service log가 있었고, 2-gateway total 100/s 창에도 app1에서만
같은 작업이 1.814초 걸렸다. 실행된 app은 local 기본값에 따라 retention worker가 활성화돼 있었으며 CDC checkpoint가 없어
outbox retention을 건너뛴다는 경고도 같은 시각 기록됐다. 반면 메시지 핵심 SQL의 누적 digest 최대는 outbox insert 11ms,
room update 6ms, member state update 6ms, message insert 4ms였다. `performance_schema`의 statement history long consumer가
비활성화돼 과거 5.155초 connection usage를 개별 transaction/query에 확정적으로 연결할 수는 없다. 따라서 긴 usage는
background retention transaction과 metric 관측 창이 섞인 정황이 강하지만 **확정 원인으로 단정하지 않는다**.

Windows native k6에서는 작은 chunked response의 `receiving` tail이 이미 확인됐고, Docker Desktop 위 Linux k6도 고율에서
동일하게 5~6초의 `receiving` 지연을 보였다. 양 app access log는 약 20ms에 종료됐으므로 현재 Windows host와 Docker
Desktop 네트워크 경로에서 얻은 k6 response duration은 release latency 판정 근거로 사용할 수 없다. 이 host는 현재
**release latency 판정 장비로 부적합**하다.

다음 검증은 Docker Desktop을 경유하지 않는 실제 Linux host 또는 Linux CI runner에서 동일한 2-gateway keep-alive 조건으로
50→150→300 write/s를 순서대로 다시 수행해야 한다. 이는 기존 2-node cluster 합산 계약을 그대로 검증하는 작업이므로
게이트2가 필요 없다. 300 write/s를 node당 목표로 바꾸거나 topology, pool 또는 성능 계약을 변경할 때만 게이트2 대상이다.

### 8.6 response headers/body flush 경로 통제 진단

기존 topology를 재기동하거나 설정을 바꾸지 않고 응답 경로를 추가 진단했다. gateway 18090/18091과 backend
18088/18089 프로세스 및 listen port는 모두 유지돼 있었다. backend health의 DB, Redis, Elasticsearch는 UP이었고 local
mail 인증 실패 때문에 종합 health만 DOWN이었다. 부하 경로와 관련된 core dependency 장애는 없었다. 별도 on-race 환경은
조회하거나 변경하지 않았다.

패킷 캡처 도구는 현재 PATH에서 발견되지 않았다. 도구 설치나 광범위 capture는 수행하지 않았다. 실행 중 gateway에는
Reactor Netty access log가 활성화돼 있지 않았고 `/actuator/loggers`와 gateway request/Netty timing metric도 노출되지 않았다.
스택을 재기동하지 않고 wire-level flush timestamp를 추가로 얻을 수 없었으므로, 민감 header와 body를 기록하지 않는
`HttpClient`의 `ResponseHeadersRead` 시점과 body drain 완료 시점을 사용했다.

단일 정상 201 응답은 392~395 byte였고 `Transfer-Encoding: chunked`, `Content-Length` 없음, 압축 없음이었다. direct backend와
gateway 각각에서 keep-alive 및 `Connection: close`를 비교한 결과, warm 상태의 headers 이후 body 완료는 0.39~0.81ms였고
connection 방식에 따른 유의한 차이가 없었다. 최초 direct 요청 한 건에서만 body 완료 336.98ms가 관측됐지만 바로 뒤 반복
요청에서 재현되지 않았다. `Accept-Encoding: gzip` 요청에도 `Content-Encoding`은 없었고 394 byte의 동일한 작은 body가
전달됐다. 즉 body 크기 변화나 압축이 tail을 만드는 증거는 없다.

fixture access token은 이미 만료돼 기존 사용자와 room을 유지한 채 local JWT 설정으로 같은 claim을 재서명했다. fixture는
저장소 밖에만 두었고 token, subject, Authorization 값은 출력하거나 문서화하지 않았다. fixture별 고유 client IP 전달도
모든 부하 실행에서 유지했다.

두 gateway를 VU별 교대하는 Windows native k6 keep-alive 조건에서 10/s와 50/s를 각각 10초간 실행했다.

| 조건 | 완료 / drop | HTTP 201 | duration avg / p95 / p99 / max | waiting p95 / p99 | receiving p95 / p99 | 판정 |
|---|---:|---:|---:|---:|---:|---|
| Windows native 10/s, 10초 | 100 / 0 | 100/100 | 26.14 / 33 / 36.03 / 39ms | 32.33 / 35.38ms | 1.04 / 1.23ms | 통과 |
| Windows native 50/s, 10초 | 500 / 0 | 500/500 | 59.27 / 290.04 / 343.01 / 364ms | 27.44 / 33.64ms | 265.59 / 316.06ms | 실패 |

50/s와 같은 16:52:31~16:52:41 창에서 app1과 app2는 각각 250건을 처리했다. app1 access duration은 평균 20.56ms,
최대 49ms였고 app2는 평균 21.64ms, 최대 48ms였다. 양쪽 모두 100ms 초과 요청은 0이었다. backend 처리와 첫 byte까지의
`waiting`은 p99 33.64ms로 일치하지만, client body 완료만 p95 265.59ms까지 늘었다. 따라서 최소 재현 조건은 현재 Windows
native k6에서 2-gateway 합산 50/s의 작은 chunked response이며 10/s에서는 재현되지 않는다. 실패 즉시 중단해 100/s는
추가 실행하지 않았다.

connection reuse는 원인을 제거하지 않지만 tail 크기에는 영향을 줬다. 이번 keep-alive 50/s의 receiving p95는 265.59ms였고,
앞선 Windows no-connection-reuse 50/s는 526.19ms였다. 반면 Docker Linux keep-alive 50/s는 11.22ms로 정상 범위였다.
따라서 매 요청 connection close는 tail을 악화하지만 필수 재현 조건은 아니다. chunked 종료 frame 자체를 packet 단위로
관측하지 못해 SCG가 마지막 chunk를 늦게 flush하는지, Windows native Go transport 또는 loopback TCP가 마지막 chunk를
늦게 소비하는지는 확정할 수 없다. 다만 backend transaction, response 생성 및 첫 byte 이전 구간은 원인에서 제외할 수 있고,
잔여 원인 계층은 **SCG response flush 이후부터 Windows client body drain 사이**로 좁혀졌다.

코드나 운영 설정 변경을 정당화할 만큼 원인이 확정되지는 않았다. 다음 최소 행동은 실제 Linux host/CI runner에서 동일한
50/s를 먼저 재현하고, 필요할 때만 해당 runner에서 gateway Reactor Netty access log 또는 지정 gateway port의 제한 packet
capture로 response headers와 마지막 chunk timestamp를 비교하는 것이다. Linux host 50/s가 정상이라면 현재 Windows
host 측정은 폐기하고 150→300/s를 이어간다. Linux host에서도 재현될 때만 SCG flush 설정과 명시적 `Content-Length` 비교를
별도 구현 티켓으로 검토한다. 이는 관측 환경을 바로잡는 작업이므로 게이트2가 필요 없으며, response framing이나 gateway
동작 계약을 변경하기로 결정할 때만 게이트2가 필요하다.

근거 summary는 저장소 밖 `D:\tmp\fc329-fc335-recheck\timing-native-10s.json`,
`timing-native-50s.json`에 보존했다.
