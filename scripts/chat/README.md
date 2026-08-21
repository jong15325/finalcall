# FC-323 채팅 부하·장애 검증

`k6-chat-load.js`는 계약 §14의 WebSocket 20,000개, 지속 300 write/s, 60초 1,000 write/s,
reconnect storm을 서로 독립 실행할 수 있다. 실제 JWT와 방 public ID는 커밋하지 않고
`chat-load-fixtures.example.json` 형상으로 별도 JSON을 만든다.

socket quota가 사용자당 3개이므로 20,000 socket에는 최소 6,667개의 서로 다른 실제 JWT가 필요하다.
write fixture의 각 사용자는 자신이 참여한 방만 지정한다. 토큰은 30분 안에 끝나는 시험 직전에 발급한다.

```powershell
$env:CHAT_LOAD_PASSWORD='<일회성 로컬 비밀번호>'
$env:CHAT_GATEWAY_TOKEN='<환경변수에서 주입>'
./scripts/chat/prepare-chat-load-fixtures.ps1 `
  -UserCount 100 `
  -OutputPath 'D:\secure\chat-load-fixtures.json'

# API 생성은 끝났지만 fixture 파일 쓰기만 실패한 경우 run id로 멱등 재개
./scripts/chat/prepare-chat-load-fixtures.ps1 `
  -UserCount 100 -ExistingRunId 1787055969 `
  -OutputPath 'D:\secure\chat-load-fixtures.json'
```

```powershell
# 설치형 k6
$env:CHAT_FIXTURE_FILE='D:\secure\chat-load-fixtures.json'
$env:CHAT_GATEWAY_TOKEN='<환경변수에서 주입>'
$env:CHAT_MODE='sustained' # socket | sustained | burst | reconnect | all
k6 run scripts/chat/k6-chat-load.js

# 설치가 없으면 Docker k6. fixture 경로는 컨테이너 내부 /fixtures.json으로 전달한다.
docker run --rm -i `
  -v "${PWD}/scripts/chat:/scripts:ro" `
  -v "D:/secure/chat-load-fixtures.json:/fixtures.json:ro" `
  -e CHAT_FIXTURE_FILE=/fixtures.json `
  -e CHAT_GATEWAY_TOKEN=$env:CHAT_GATEWAY_TOKEN `
  -e CHAT_MODE=sustained `
  grafana/k6:0.57.0 run /scripts/k6-chat-load.js
```

단계 부하는 먼저 `CHAT_SOCKET_VUS=100`, `1,000`, `5,000`으로 올린 뒤 20,000을 실행한다. 순수 연결
용량 측정은 `CHAT_SOCKETS_PER_USER=1`, 사용자당 최대 quota도 함께 검증할 때는 계약 상한인 `3`을 사용한다. 쓰기도
`CHAT_SUSTAINED_RATE=50`, `150`, `300`과 `CHAT_BURST_RATE=300`, `600`, `1,000` 순서로 올린다.
한 단계에서 socket 연결 성공률 99% 초과, write HTTP 201 성공률 100%·scheduled iteration drop 0,
DB p95 200ms/p99 500ms 또는 호스트 CPU·메모리
한도를 넘으면 다음 단계로 외삽하지 않고 병목을 기록한다.

장애 창은 별도 셸에서 실행한다. 스크립트는 명시한 컨테이너 하나만 pause/unpause하며 `finally`에서 복구한다.

```powershell
./scripts/chat/chat-chaos.ps1 -Target redis -Seconds 30
./scripts/chat/chat-chaos.ps1 -Target kafka -Seconds 60
./scripts/chat/chat-chaos.ps1 -Target connect -Seconds 60
./scripts/chat/chat-chaos.ps1 -Target node -NodeContainer finalcall-app-1
```

Redis/Kafka/Connect 중단 중에도 REST 201 row 수와 outbox row 수가 일치해야 한다. 복구 뒤 connector lag가
0으로 수렴하고 같은 `eventId`가 중복 수신돼도 클라이언트 timeline은 `roomSequence` 기준 한 행이어야 한다.
실행 결과 JSON은 `k6 run --summary-export <경로>`로 작업 외부에 저장하고 시크릿 fixture는 삭제한다.

## Linux CI 성능 진단

`.github/workflows/chat-performance.yml`은 `workflow_dispatch`로만 실행한다. 기본 `diagnostic`은
GitHub-hosted Linux runner에서 topology/readiness와 consumer 2개·monitor 1개를 확인하고, 각 gateway에 2/s로
5초간 비채점 prewarm을 수행한 뒤 10/s smoke까지만 실행한다. hosted 결과는 출시 용량 근거로 사용하지 않는다.
10/s smoke는 scheduled iteration drop 0, HTTP 201 100%, p95 200ms 미만·p99 500ms 미만을 모두 만족해야 한다.
keep-alive 활성화와 모든 fixture의 client IP 존재·2개 이상 분산도 부하 전에 검증한다.

`extended`는 `self-hosted`, `linux`, `chat-performance` 라벨을 모두 가진 전용 runner에서만 선택할 수 있다.
`extended`도 hosted 결과를 이어받지 않고 prewarm과 10/s부터 독립적으로 시작해 50→150→300/s 출시 단계를
순서대로 실행한 뒤 기존 300/s 5분, 1,000/s burst, socket 단계를 수행한다. 공유 runner에서는 이 확장 단계를
실행하지 않는다. 전용 runner에는 Docker,
Java 21, PowerShell, curl, jq, Python 3, `ulimit -n` 65,536 이상, CPU 8개 이상, runner/Docker memory 16GiB 이상이
준비돼 있어야 하며 시작 시 실행 중인 다른 Docker workload가 없어야 한다. socket은
100→1,000→5,000→20,000 순서로 실행하고 각 단계 실패 시 즉시 중단한다.
전용 runner는 작업마다 폐기되는 ephemeral 구성을 권장한다. persistent runner라면 workflow 강제 종료 뒤 외부 workspace와
Docker 자원 및 이전 app/gateway process 정리는 runner 운영자가 보장해야 한다. workflow 시작 시 stale PID 파일은 종료에
사용하지 않고 전용 temp guard 아래에서 삭제한다. 종료 시에는 PID의 `/proc` command line이 예상 절대 jar 경로와 port에 모두
일치할 때만 TERM 후 bounded wait/KILL한다. Compose는 모든 명령에 전용 project name
`finalcall-chat-performance`를 사용한다. workflow는 이 project와 `runner.temp/chat-performance`만 정리하며 다른
project·process·경로는 삭제하지 않는다.

workflow는 runtime secret을 매번 생성·mask하고 fixture를 runner 임시 디렉터리에만 둔다. k6 summary, redaction된
app/gateway/compose log, host/container CPU·memory·I/O와 Hikari/Kafka lag 5초 시계열을 7일 artifact로 보존하며
fixture와 token은 업로드하지 않는다.
로컬에서 동일 단계만 확인할 때는 다음처럼 실행한다.

```bash
CHAT_FIXTURE_FILE=/secure/fixture.json \
CHAT_RESULT_DIR=/tmp/chat-results \
CHAT_BASE_URLS=http://localhost:18090,http://localhost:18091 \
K6_BIN=/opt/k6-v0.57.0/k6 \
bash scripts/chat/run-linux-ci-load.sh diagnostic
```

## FC-327 CDC 실제 장애 자동 검증

다음 스크립트는 로컬 Docker의 실제 Kafka broker와 채팅 전용 Connect/Debezium process를 각각
중단·재시작한다. 장애 창에 metadata-only outbox를 commit하고, 복구 뒤 같은 room key의 사건이
전부 순서대로 도착했는지 확인한다. at-least-once 중복은 집계하되 유실·sequence gap은 실패시킨다.
테스트 outbox row는 `finally`에서 eventId 한정 삭제하며 topic event는 7일 보존 정책에 따라 만료된다.

```powershell
./scripts/chat/verify-chat-cdc-chaos.ps1 -BatchSize 6 -TimeoutSeconds 180
```

실제 app process의 커밋 직후 kill은 먼저 2명 이상의 격리된 부하 fixture와 실행 중인 app PID를 준비한 뒤
검증한다. 스크립트는 별도 DB connection에서 message+outbox가 보이는 최초 시점(즉 commit 완료)에 지정 PID만
강제 종료하고, row 1개와 Debezium→Kafka 도착을 확인한다. 시험 데이터는 room sequence를 구성하므로
공용 계정이 아닌 일회성 부하 fixture를 사용한다.

```powershell
$app = Get-Process java | Where-Object { $_.CommandLine -like '*finalcall*' } | Select-Object -First 1
./scripts/chat/verify-chat-app-commit-kill.ps1 `
  -FixturePath 'D:\secure\chat-load-fixtures.json' `
  -AppProcessId $app.Id
```

CI에서는 같은 스크립트에 `-AppContainer <격리된 app container>`를 넘길 수 있다. 성공 조건은 HTTP 응답
수신 여부가 아니라 DB message 멱등 row 1개와 outbox event의 Kafka 발견이다. process kill 뒤 REST gap replay는
app을 재기동한 후 기존 k6 fixture의 `roomPublicId`로 `afterSequence=<직전 sequence>` 조회를 실행한다.

느린 client 격리는 loopback처럼 socket buffer가 큰 환경에서 단순히 receive 호출을 늦추는 방식으로 재현하지
않는다. Toxiproxy `bandwidth` downstream toxic으로 느린 session만 제한하고, 정상 session은 기존
`CHAT_MODE=socket` k6를 동시에 유지한 채 `chat_websocket_send_buffer_exceeded_total` 증가, 느린 연결 종료,
정상 session event 수신, DB write 성공을 함께 단언한다. 이 검증은 app과 실제 WebSocket endpoint가 필요한
별도 CI chaos job에서 실행하며 REST/Kafka CDC 검증과 분리한다. room sequence를 전진시키므로 반드시 일회성
fixture를 사용한다.

```powershell
./scripts/chat/verify-chat-slow-client.ps1 `
  -FixturePath 'D:\secure\chat-load-fixtures.json' `
  -MessageCount 700
```
