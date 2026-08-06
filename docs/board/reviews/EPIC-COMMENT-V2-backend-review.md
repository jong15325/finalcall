# EPIC-COMMENT-V2 백엔드 통합 리뷰 (FC-207~209)

- 리뷰어: reviewer 서브에이전트 (읽기전용)
- 일자: 2026-08-06
- 계약 정본: board-domain-spec v1.1 §13/§14 · api-contract v1.24 §6.3 · erd v1.9

## 권고: **CHANGES-REQUESTED** (major 1) → M-1 수정 후 PASS. critical 없음·데이터 정합 안전.

## MAJOR M-1 — 동일 유저 동시 반응 UK 위반 → 500 노출 (§13.2 재조회·전환 경로 미구현)
- 위치: `CommentService.toggleReaction` — `findByCommentIdAndUserId`(비잠금 스냅샷, line~310)를 카운트 X락 UPDATE(line~329) **전에** 수행. `GlobalExceptionHandler`(line~98) DataIntegrityViolationException 미처리→500.
- 재현: same-user 동시 LIKE 2건(모바일 더블탭·BEST+목록 중복렌더 연타) → 둘 다 existing=empty 판정→INSERT 경로 → 패자 TX가 UK(uk_comment_reaction) 위반 → 500. switch/cancel 경합은 switchTo() flush 0행 → StaleStateException → 500 동종.
- 완화: DB 카운트는 롤백으로 정합 보존(데이터 손상 없음)·프론트 pending 가드로 빈도 낮음. 그러나 프론트 중복인스턴스(BEST+목록)로 도달 가능 → 수정 결정.
- 수정: 충돌(DataIntegrityViolation/StaleState) 시 현재 반응 상태 재조회해 권위값 반환(멱등 수렴), 또는 SELECT를 X락 후로 이동. spec §13.2 "재조회·전환 경로"에 정합.

## PASS 판정
- **멀티유저 반응 동시성**: 카운트 원자 UPDATE(X락) 선행→반응행 후행 재배열이 FK S→X 승격 교착 제거·완전 직렬화. 40스레드=40 정합 테스트 고정. (잔여=same-user M-1만.)
- **tombstone**: isTombstone=isDeleted&&replyCount>0, 목록 (is_deleted=false OR reply_count>0) 인출+마스킹, 답글 삭제 reply_count−1로 마지막 답글 시 자연 배제, comment_count 총계 정합.
- **인가/IDOR**: 주체 SecurityContext, update/delete owner||admin, 반응 self-금지 COMMENT_003, 답글 tombstone 루트 COMMENT_001.
- **대댓글 평탄화**: 답글의 답글→루트 정규화·mentioned_nickname 스냅샷.
- **정렬/BEST**: 화이트리스트(잘못된 값 400)·BEST like-dislike 랭킹·임계·max-count·tombstone 제외·myReaction. @Validated fail-fast.
- **V24**: ix_comment_root_list 선생성 후 구인덱스 드롭(fk 커버 유지·errno 회피)·comment_reaction UK/FK 적절.

## MINOR (accept)
- m-2 BEST ORDER BY (like-dislike) filesort(계산식·인덱스 미커버) — 결과셋 소규모라 영향 미미. spec "커버" 과표현.
- m-3 fk_comment_parent 자동인덱스 ix_comment_reply_list와 중복 존치(errno 1091 회피 방어적 선택) — 타당.
- m-1 반응 응답 카운트=스냅샷+델타(viewCount 선례 트레이드오프·저장값은 원자 보장).
