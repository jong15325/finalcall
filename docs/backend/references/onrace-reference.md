# On-Race 참고 — 차용 후보 (작업 노트, 유형4·근거 인용 금지·참고용)

출처: D:\Java\ktcloud\backend\On-Race\backend (이전 팀 프로젝트, SCG+MSA, 선착순 티켓팅).
FinalCall과 "한정 재고 + 마감 직전 동시 폭주" 문제가 동일 → 차용 가치 높음.
주의: 산출물의 근거는 확정 스펙/ACCEPTED 결정이어야 함. 이 노트는 미확정 참고.

## A. 지금 안건에 반영 (백엔드 자율)

### A-1. 페이징 응답 = CursorResponse 차용 (안건3 B-007 수정)
- On-Race `CursorResponse<T>(List<T> content, String nextCursor, boolean hasNext)`. 근거: common/response/CursorResponse.java
- fetchSize+1 조회로 hasNext 판정, nextCursor는 마지막 원소의 정렬키. 다중 정렬키셋은 `ofKeyset`.
- 결정: 내 초기 `items+pageInfo` 안을 폐기하고 검증된 `content/nextCursor/hasNext`로 통일. offset은 별도 `PageResponse`.

### A-2. 에러 코드 — 도메인 접두 + 의미형 enum
- On-Race: prefix `CMN/AUTH/EVT/...` + `[도메인]_[상태]_[대상]` enum명. 근거: common/exception/BusinessErrorCode.java
- FinalCall 스켈레톤은 `COMMON_001`(전체 도메인명)+의미형 enum(LOCK_ACQUISITION_FAILED)로 이미 정합. 차용은 "도메인별 풍부한 코드 세분화"(429 rate limit 등) 수준. 스켈레톤 split 유지.

## B. 아키텍처 — 총괄 에스컬레이션 대상 (CLAUDE.md 단일 서비스와 충돌)

### B-1. SCG 게이트웨이 전면 + MSA 여부
- On-Race: gateway/auth/main/queue/common 5모듈, SCG(WebFlux) 단일 진입점.
- FinalCall CLAUDE.md: 단일 서비스 com.finalcall (api>domain>infra>common). → 정면 충돌. 4기준 #2·#3·#4 전부 해당 → 총괄 결정.

### B-2. 인증 모델 — 서비스 JWT 검증 vs 게이트웨이 X-User-Id 주입
- On-Race: 게이트웨이만 JWT 검증 → `X-User-Id`/`X-User-Role` 주입, 클라 위조 헤더 stripInternalHeaders로 선제거, 뒤단은 `X-Gateway-Token` 공유비밀로 직접접근 403 차단. 근거: gateway JwtAuthenticationWebFilter, common/filter/GatewayAccessFilter.java
- FinalCall: Stage F1에서 서비스가 직접 JWT 검증(HS256). → 컨트롤러 사용자 식별 방식(`@RequestHeader X-User-Id` vs SecurityContext)이 갈림. 계약·보안 게이트에 영향 → 총괄+보안 검토.

## C. 동시성 — 입찰/정산 구현(E1·도메인) 참고, 지금 구현 금지(029 범위 밖)

- C-1. 고경합 카운터·최고가 갱신 = Redis Lua 단일 원자 스크립트(반환코드 분기). 분산락으로 감싸면 마감 직전 병목. 근거: event/service/EventStockService.java, docs/portfolio/06-troubleshooting-01-lua-stock.md
- C-2. Redisson `tryLock(0, lease)` = 저빈도 배치 실행권(정산 배치 단일 인스턴스). 근거: queue/processor/QueueBatchScheduler.java
- C-3. 3단계 상태(가용/홀드/확정) + TTL 자동 만료 복원 → 미입금·미결제 누수 차단. 스케줄러 없이 Redis Keyspace Notification으로 복원. 근거: entry/listener/EntryExpListener.java
- C-4. DB-Redis 이중쓰기 정합: `@TransactionalEventListener(AFTER_COMMIT)` + TX 분리(`NOT_SUPPORTED`). 돈 걸린 경매는 Outbox+멱등성 키+보상 배치를 처음부터. 근거: docs/portfolio/06-troubleshooting-03-consistency.md
- C-5. 마감 폭주 흡수 = Redis ZSet 대기열 + 배치 파이프라인(ZPOPMIN+RBatch, RTT 2N→2) + 서버사이드 jitter 폴링. 근거: queue/service/QueueService.java, docs/portfolio/06-troubleshooting-02-batch-dequeue.md
