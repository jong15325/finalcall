---
id: EPIC-QUALITY-CLEANUP
type: epic
jira_key: null
title: 댓글 정확도·접근성 및 테스트 환경 품질 정리
state: doing
owner: main
children: [FC-220, FC-221, FC-222, FC-223, FC-224, FC-194]
gate: null
review_status: pending
artifacts: []
---

## 목표

댓글 UI의 접근성과 본인 판정 정확도를 높이고 프론트·백엔드 테스트가 로컬 환경값과 무관하게 신뢰할 수 있도록 정리한다.

## 게이트

- 게이트1 승인: 2026-08-07 — 사용자 승인.
- 게이트2 승인: 2026-08-07 — 댓글 응답에 `ownedByMe: boolean`을 가법 추가하고 서버 회원 식별자로 계산.
- 게이트3: 전 티켓 reviewer 통과 후 사용자 Done·push 승인 대기.

## 의존

`FC-221 → FC-222 → FC-223`. FC-220·FC-224·FC-194는 계약 작업과 독립적으로 진행 가능하다.
