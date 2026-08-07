# FC-221 리뷰 — 댓글 ownedByMe 계약

- 판정: **PASS**
- critical/major/minor: 0/0/0
- 검증일: 2026-08-07

API 계약 v1.26과 게시판 도메인 스펙 v1.3에 `ownedByMe`의 주체 ID 비교, 게스트·관리자 타인·tombstone false, `editable` 의미 분리, authorId 미노출, COMMENT_003 유지가 정합하게 반영됐다. FC-222·223 파급과 완료 티켓 흡수 방침도 일치하며 `git diff --check`가 통과했다.
