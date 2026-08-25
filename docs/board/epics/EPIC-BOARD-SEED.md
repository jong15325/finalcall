---
id: EPIC-BOARD-SEED
type: epic
jira_key: KAN-445
title: 서프 감성 게시판 운영 데이터 구축
state: done
children: [FC-387, FC-388, FC-389, FC-390]
gate: null
---
## 목표
- 한국 서바이벌 프로젝트 커뮤니티의 운영·놀이 문화를 참고하되 원문과 고유 자산을 복제하지 않은 FinalCall 창작 게시판 데이터를 구축한다.

## 분해안 (게이트1 승인 2026-08-24)
- FC-387: 게시판 운영 시드 계약 확정 — architect
- FC-388: 독립 시드 fixture·CLI·통합 테스트 구현 — backend-impl
- FC-389: 보안·QA·데이터 정합성 리뷰 — reviewer
- FC-390: 운영 DB 백업·적용·API 검증 — main

## 완료 기준
- 공지 12개, 커뮤니티 36개, 이벤트 12개가 생성된다.
- 댓글 204개와 반응 312개의 집계·참여 분포가 검증된다.
- `board-surf-20-v1`이 멱등 적용되고 외부 참조가 있는 cleanup은 거부된다.
- reviewer 통과 후 현재 운영 Docker DB에 백업·적용하고 공개 API를 검증한다.

## 정본
- `docs/spec/board-operations-seed-contract.md`
