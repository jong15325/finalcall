# EPIC-COMMENT-V2 프론트 통합 리뷰 (FC-210~212)

- 리뷰어: reviewer 서브에이전트 (읽기전용)
- 일자: 2026-08-06
- 계약 정본: api-contract v1.24 §6.3

## 판정: **CHANGES-REQUESTED** (major 1 · minor 4) → MAJOR-1 수정 후 PASS 가능

## MAJOR-1 — 수정·삭제가 BEST 캐시 미무효화 → stale BEST
- 위치: `lib/queries/comments.ts` useUpdateComment·useDeleteComment.
- 문제: invalidateRootLists+invalidateReplyThreads(+postLists)만 무효화·`commentKeys.best` 누락. BEST는 refetchOnWindowFocus:false라 자연 refetch 없음.
- 재현: 자기 댓글이 BEST에 오른 상태에서 수정→BEST 카드 옛 내용 잔류(같은 화면 모순), 삭제→삭제한 댓글이 골드 BEST에 본문·공감버튼까지 리로드 전까지 공개. 계약 §6.3 BEST "삭제·tombstone 제외"와 어긋남.
- 반응은 "재정렬 튐 방지"로 best 무효화 안 함이 의도적 트레이드오프이나, 수정/삭제는 내용·존재 변경이라 그 논리 미적용 → 누락. 최소수정: 두 뮤테이션 onSuccess에 commentKeys.best 무효화 추가.

## MINOR (parent 재량·이월 가능)
- MINOR-1 중복 렌더(BEST+목록) 시 반응 연타 방지 공백(인스턴스별 pending) — 낮은 확률·내부 정합 유지·리로드 자가치유.
- MINOR-2 정렬 메뉴 roving focus·하단시트 포커스트랩 부재(a11y).
- MINOR-3 본인 판정 닉 스냅샷 역방향 오탐 엣지(닉변경+선점) — UI only·서버 COMMENT_003 방어·안전.
- MINOR-4 본인 반응 비활성 사유 hover title에만(터치·SR 접근성).

## PASS 항목
- 낙관적 업데이트/캐시 정합(반응): patchReactionInCaches가 infinite·배열(BEST) 판별·접두 스캔으로 cancel/스냅샷/패치/롤백 전부 BEST 포함, 중복노출 동기. nextReactionState 계약 §13.2 일치.
- optional-auth: getComments/getReplies/getBestComments auth:false 미사용(board MAJOR-1 재발 없음).
- XSS: JSX 텍스트 보간·dangerouslySetInnerHTML 0.
- 계약 정합: RootComment/Reply 분화·tombstone null·정렬 enum·BEST·COMMENT_003 §6.3 1:1. 가짜 데이터 없음.
- 조회수 부풀림 회피: bumpCommentCount 로컬 보정.
