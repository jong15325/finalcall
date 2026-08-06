---
id: EPIC-COMMENT-V2
type: epic
jira_key: KAN-233
title: 네이버식 댓글 v2 — 대댓글·공감/비공감·정렬·BEST
state: done
children: [FC-206, FC-207, FC-208, FC-209, FC-210, FC-211, FC-212]
gate: null
---

> **게이트1 승인(2026-08-06)**: 사용자 "승인". 범위 = **풀 네이버**(대댓글 + 공감/비공감 + 정렬 + BEST) · 중첩 = **1단계**(답글의 답글도 같은 레벨, 대상에게 @멘션). 분해안 7티켓(FC-206~212) 확정.

## 목표

기존 평면 댓글(FC-199 백엔드·FC-203 프론트)을 네이버 댓글 구조로 확장한다. 대댓글(답글) 1단계 + "답글 N개" 지연 로딩, 댓글별 공감/비공감 반응, 정렬(순공감순·최신순·과거순), BEST 댓글.

## 제품 결정 (게이트1 확정)
- **범위**: 풀 네이버 — 대댓글 + 공감/비공감 + 정렬 + BEST.
- **중첩**: 1단계(모든 답글이 최상위 댓글에 붙고 @멘션으로 대상 표시). 다단계 트리 기각.

## FC-206에서 상신될 게이트2 후보
1. 답글 모델(1단계 저장·@멘션 형상).
2. 반응 스키마(comment_reaction·유저당 댓글당 1행 LIKE/DISLIKE 전환·카운트 비정규화).
3. 기존 댓글 API 형상 교체 파급(FC-199/203 방금 배포 — 평면→최상위+replyCount, 하위호환/마이그레이션 범위).

## 분해 (7티켓)
| 티켓 | owner | 내용 | 의존 |
|---|---|---|---|
| FC-206 | architect | 계약·스키마 — 대댓글·comment_reaction·정렬·BEST·API 변경 (게이트2) | — |
| FC-207 | backend-impl | 대댓글 threading + 답글 목록 API + 최상위 replyCount | FC-206 |
| FC-208 | backend-impl | 공감/비공감(comment_reaction·토글·카운트) | FC-206, FC-207 |
| FC-209 | backend-impl | 정렬(순공감/최신/과거) + BEST 댓글 | FC-208 |
| FC-210 | frontend-impl | 네이버식 댓글 UI — 대댓글·답글 펼치기·답글 폼·@멘션 (디자인 게이트) | FC-207 |
| FC-211 | frontend-impl | 공감/비공감 버튼·카운트 | FC-208, FC-210 |
| FC-212 | frontend-impl | 정렬 드롭다운 + BEST 표시 | FC-209, FC-210 |

## 상태
- **게이트3 완료(2026-08-06)**: FC-206~212 전건 done. reviewer 백엔드 PASS(M-1 same-user 반응 UK 500→비관적 직렬화+잠금read 수렴)·프론트 PASS(MAJOR-1 수정/삭제 BEST 캐시 무효화). E2E 라이브 7시나리오 전건 그린(대댓글 평탄화·@멘션·정렬 3종·반응 토글/전환/취소·M-1 12병렬 수렴·COMMENT_003·BEST·tombstone·IDOR·admin override). security-review clean(HIGH/MEDIUM 0). 사용자 Done 승인. 커밋 5건(계약·백엔드·프론트·nav·보드문서). push 사용자 직접. minor 이월(중복렌더 연타·정렬메뉴 a11y·닉스냅샷 엣지·BEST filesort). 범위 밖: 다단계 트리·반응 append 로그.
