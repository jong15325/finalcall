# FC-362 검색 Kafka Connect 내부 토픽 정책 복구 리뷰

## 최종 판정

- PASSED
- Critical: 0
- Major: 0
- Minor: 0

## 발견

- 없음

## 확인 범위

- `--create --if-not-exists`와 별도 `kafka-configs --alter` 조합의 반복 실행 멱등성
- 기존 내부 토픽을 삭제·재생성하지 않고 `cleanup.policy`만 `compact`로 보정하는지
- 기존 토픽의 파티션 수를 강제로 변경하지 않아 저장된 config/status/offset 레코드의 파티션 배치를 보존하는지
- 신규 생성 시 `connect-configs=1`, `connect-offsets=25`, `connect-status=5`, 로컬 단일 브로커 replication factor 1 적용
- Kafka healthy → 내부 토픽 init 성공 → Kafka Connect 시작의 `depends_on` 순서
- one-shot init의 정상 종료와 반복 실행 후 Kafka Connect/connector/task 회귀 여부
- 복구 절차와 `Exited (0)` 의미에 대한 문서 정확성

## 검증 증거

- Compose 구성 검증: `docker compose -f backend/docker-compose.local.yml config --quiet` 통과
- `finalcall-search-kafka-connect-topic-init`: 반복 실행 후 `Exited (0)`
- init 로그: 세 토픽 모두 `Completed updating config`
- `finalcall-kafka-connect`: `healthy`
- 세 내부 토픽: 모두 `cleanup.policy=compact`, leader/ISR 정상
- 기존 내부 토픽: 각 1 partition을 그대로 유지하여 복구 과정에서 파티션 재배치 없음
- `finalcall-mysql-source`: connector/task 모두 `RUNNING`
- `finalcall-elasticsearch-sink`: connector/task 모두 `RUNNING`
- worker 로그: source offset commit 성공 및 GTID 기반 binlog streaming 연결 확인
- README 검증 명령: `connect-configs`, `connect-offsets`, `connect-status`를 반복해 모두 describe하도록 보완 확인

## 판정 근거

정책 변경은 토픽 삭제나 볼륨 초기화 없이 동적 topic config만 보정한다. 기존 토픽에는 `--if-not-exists`가 파티션 수를 변경하지 않으므로 기존 offset/config/status 레코드의 파티션 배치를 보존하고, fresh Kafka에서는 명시한 권장 파티션 수로 생성한다. 초기화 성공 조건이 Kafka Connect의 시작 의존성에 포함되어 원래 장애였던 잘못된 cleanup policy 상태에서 worker가 먼저 시작하는 순서도 차단된다. 문서도 세 내부 토픽을 모두 검사하도록 보완되어 발견 없이 통과 판정한다.
