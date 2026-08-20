# 총괄 세션 핸드오버

> 갱신: 2026-08-19 KST / 브랜치 `master`

## Git·환경
- 로컬 HEAD: `481ce41`
- upstream 추적 HEAD: `481ce41`
- unpushed commit: 0
- 작업 트리: dirty — EPIC-CHAT 전체 구현·문서·테스트와 기존 FC-315 관련 사용자 변경이 함께 있다. 이번 세션에서도 기존 변경을 되돌리거나 정리하지 않았다.
- 실행 서비스: 현재 source의 backend 2개(`18088`, `18089`)와 gateway 2개(`18090`, `18091`)가 실행 중이다. Java PID는 각각 `24804`, `50980`, `18660`, `47000`이며 모두 저장소의 최신 bootJar를 가리킨다.
- Docker: `finalcall-mysql`, `finalcall-redis`, `finalcall-kafka`, `finalcall-chat-kafka-connect`, `finalcall-elasticsearch`, `finalcall-minio`가 healthy다. 별도 on-race 컨테이너들도 실행 중이므로 종료·재기동 시 FinalCall 컨테이너만 정확히 지정한다.
- 부하 산출물·로그: 저장소 밖 `D:\tmp\fc329-recheck\`에 보존했다. native k6 0.57.0은 `D:\tmp\k6-v0.57.0-windows-amd64\k6.exe`다.

## 이번 세션 완료
- FC-330 / `KAN-374` 완료·reviewer 통과: fan-out listener의 트랜잭션을 제거하고, 로컬 수신자 판정 → node-local eventId dedup → 별도 read-only hydrator → 트랜잭션 종료 후 STOMP dispatch 경계로 분리했다. hydration 또는 dispatch 실패 시 dedup claim을 해제해 Kafka fallback 재시도를 보존했다.
- FC-331 / `KAN-375` 완료·reviewer 통과: 부하 fixture의 signup/login/room 생성 요청에 사용자별 고유 `X-Forwarded-For`를 실제 적용해 인증 rate limiter 위양성을 제거했다.
- FC-332 / `KAN-376` 완료·통과: outbox retention `(created_at, id)`와 pipeline 관측 `(occurred_at, id)` 인덱스의 역할, V27 DDL·롤백·검증 기준을 계약에 확정했다.
- FC-333 / `KAN-377` 완료·reviewer 통과: `V27__chat_outbox_retention_index.sql`과 MySQL 통합 테스트를 추가했다. fresh V1~V27 migration, 두 인덱스 공존, EXPLAIN의 신규 인덱스 선택/no filesort, cutoff·batch 경계, `SKIP LOCKED` 다중 connection 분리를 MySQL 8.0.46에서 검증했다.
- V27을 현재 로컬 DB에 적용했다. Flyway 27 성공과 `ix_chat_event_outbox_retention(created_at,id)`, 기존 `ix_chat_event_outbox_occurred(occurred_at,id)` 공존을 확인했다.
- 관련 FC-330/333 테스트, checkstyleMain/checkstyleTest와 spotlessApply가 통과했다. FC-331 PowerShell parser와 2-user smoke도 통과했다.

## 수정 이력·핵심 파일
- fan-out 경계: `backend/src/main/java/com/finalcall/domain/chat/listener/ChatRedisFanoutListener.java`
- 신규 dedup/hydration/delivery: `backend/src/main/java/com/finalcall/domain/chat/listener/ChatFanoutEventDeduplicator.java`, `ChatFanoutHydrator.java`, `ChatFanoutDelivery.java`
- fan-out 회귀 테스트: `backend/src/test/java/com/finalcall/domain/chat/listener/ChatRedisFanoutListenerTest.java`, `ChatFanoutHydratorTest.java`
- fixture 수정: `scripts/chat/prepare-chat-load-fixtures.ps1`
- retention 계약·ERD: `docs/spec/chat-domain-spec.md`, `docs/spec/erd.md`
- V27·통합 테스트: `backend/src/main/resources/db/migration/V27__chat_outbox_retention_index.sql`, `backend/src/test/java/com/finalcall/integration/ChatOutboxRetentionIndexIntegrationTest.java`
- 성능·원인 기록: `docs/backend/fc-329-chat-release-validation.md`, `docs/backend/chat-storage-and-fanout-briefing.md`
- 티켓·리뷰: `docs/board/tickets/FC-330.md`~`FC-333.md`, `docs/board/reviews/FC-330-review.md`, `FC-331-review.md`, `FC-333-review.md`

## 최신 검증과 판정
- Windows native k6의 HTTP/1.1 chunked keep-alive에서 `http_req_receiving` tail이 비정상적으로 커지는 측정 왜곡을 확인했다. direct와 gateway 응답은 모두 `Transfer-Encoding: chunked`였다.
- `K6_NO_CONNECTION_REUSE=true`로 같은 환경을 통제하자 50/s 30초가 정상화됐다.
  - app 직접: 1,500/1,500, drop 0, avg 25.31ms, p95 34.04ms, p99 39ms.
  - gateway 경유: 1,500/1,500, drop 0, avg 27.21ms, p95 37ms, p99 48ms.
- 같은 조건의 gateway 150/s 30초는 실제 실패했다: 완료 3,340, drop 1,160, 실효 77.45/s, 완료분은 모두 HTTP 201, avg 7.61초, p95 13.03초, p99 13.16초.
- V27 이후 retention purge의 수초 slow log는 사라졌고 Hikari acquire max 약 1ms·pending 0, Kafka lag 0, Redis publish failure 0이었다. 그러나 connection usage max는 app1 4.455초, app2 4.11초이고 HTTP 201 max도 약 6.5초였다.
- 현재 가장 유력한 잔여 병목은 `ChatOutboxFastPathAspect`의 `afterCommit()`이 JDBC resource cleanup 전에 `StringRedisTemplate.convertAndSend`를 동기 호출하는 구조다. outbox 2건마다 동기 Redis publish가 수행되어 150/s에서 이미 획득한 connection을 오래 붙잡는 관측과 일치한다. publish 시간 계측으로 단독 확정한 상태는 아니므로 구현 후 동일 topology 재측정이 필수다.
- 50/s 통과에 사용한 no-connection-reuse는 Windows k6 측정 왜곡 통제값이다. 최종 용량 판정에는 Linux 실행기에서 keep-alive 조건을 별도로 재확인해야 한다.

## 진행 중·출시 차단
- EPIC-CHAT / `KAN-359`: `doing`. 사용자 게이트3 승인 전이며 출시 차단 상태다.
- FC-329 / `KAN-373`: `doing`, `review_status: pending`. 150/s 단계가 실패했으므로 300/s·장시간·장애 matrix를 진행하지 않았다.
- FC-324 / `KAN-368`: `doing`, `review_status: changes-requested`. FC-329를 포함한 release 검증 완료 후 최종 reviewer 재판정이 필요하다.
- 미검증: 300/s 5분, 1,000/s 60초 burst, 20,000 socket 10분, reconnect storm, slow-client chaos, release topology의 Kafka/Connect/app kill 복구, 최종 전체 backend/gateway/frontend build·test.

## 사용자 결정을 기다리는 게이트2
- 다음 변경은 성능·전달 경계 변경이라 게이트2 승인 전에는 구현하지 않는다. FC-334/FC-335 티켓도 아직 생성하지 않았다.
- 권고안 A: commit 성공 후 민감정보를 제외한 immutable event metadata snapshot만 전용 bounded executor에 enqueue하고 `afterCommit()`은 즉시 반환한다. 유한 queue/pool, 명시적 thread name, rejection·worker failure는 요청 실패나 동기 fallback 없이 metric/drop 처리하며 Kafka outbox를 내구 fallback으로 유지한다.
- 금지: 무한 queue·무한 retry·blocking enqueue·`CallerRunsPolicy`·공용 `@Async` executor·무제한 virtual thread. shutdown은 bounded drain 후 잔여 drop으로 종료하고 DB outbox 복구 경로는 유지한다.
- 외부 REST/STOMP/event schema와 ERD는 바꾸지 않는다. 내부 delivery/backpressure/metric/performance 계약만 `chat-domain-spec.md`에 보정한다.
- 검증 기준: rollback 0 enqueue, commit당 1 enqueue, Redis 5초 지연에도 HTTP/JDBC 반환 비차단, 포화 시 요청 성공+fast-path drop, 민감 context 미전달, bounded shutdown, reorder/duplicate의 sequence·dedup·gap replay 수렴, 이후 50→150→300/s 단계 검증.

## Jira 미러 패리티
- 파일 보드 형식 검사: 정상, 총 369건.
- Jira REST 인증: 정상(`KAN`). FC-330~333 생성·상태·요약은 이미 반영됐다.
- 원격 `--check` 결과: 506건의 `Blocks` 링크 드리프트가 남았다. 대부분 같은 링크를 양 끝 티켓에서 중복 기대하는 검사/방향 정규화 문제이며, 이전 `--apply` 후에도 재검출된 기존 Jira sync 이슈다. 이번 퇴근 절차에서는 대량 링크 재작성으로 확대하지 않았다.
- 내일 Jira 작업 전 `node scripts/jira-sync.mjs --check`로 재확인하고, 새 티켓은 파일 생성 직후 `--apply --only=<ID>`로 순차 미러한다.

## 다음 세션 첫 행동
1. 이 문서와 `docs/backend/chat-storage-and-fanout-briefing.md`, `docs/backend/fc-329-chat-release-validation.md`를 읽어 기준을 복원한다.
2. 사용자에게 권고안 A의 게이트2 승인을 확인한다. 승인되면 architect 티켓 FC-334와 backend 티켓 FC-335를 파일/Jira에 순차 생성하고 EPIC-CHAT·FC-329 의존을 연결한다.
3. architect가 `chat-domain-spec.md`의 내부 async fast-path/backpressure/metric/DoD만 확정한다. API 계약·ERD는 변경하지 않는다.
4. backend-impl이 bounded executor와 immutable snapshot, rejection/failure/shutdown metric 및 경계 테스트를 구현한다. 구현 후 spotless·관련 테스트·checkstyle을 수행하고 reviewer 판정을 받는다.
5. 정확한 PID를 다시 확인해 FinalCall 앱·게이트웨이만 최신 bootJar로 재기동한다. fresh fixture를 만들고 토큰 30분 만료 전에 native k6 `K6_NO_CONNECTION_REUSE=true`로 10/s warmup → 50/s → 150/s → 통과 시 300/s를 단계 실행한다. 실패 즉시 후속 부하를 중단한다.
6. 짧은 단계가 모두 통과한 뒤에만 300/s 5분, 1,000/s burst, 20k socket과 장애 matrix를 진행하고 FC-329/FC-324 reviewer 재판정을 요청한다.

## 커밋·push
- 이번 세션에서 commit과 push를 실행하지 않았다.
- EPIC-CHAT 전체 변경이 아직 하나의 큰 dirty worktree에 있으므로 커밋 전에는 사용자 승인과 atomic 범위 재확인이 필요하다.
