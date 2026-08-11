---
id: EPIC-ELEMENT-DETAIL-BACKGROUND
type: epic
jira_key: null
title: 속성별 상세 몰입 배경 적용
state: review
children: [FC-233, FC-234, FC-235, FC-236]
gate: gate3
---

## 목표

게이트2에서 승인한 하이브리드안(최적화 배경 1장 lazy load + CSS 중심 + 물 속성 제한 Canvas)을
경매 상세와 아이템 상세에 적용하고 접근성·성능 회귀 없이 닫는다.

## 하위 티켓과 의존

- FC-233: 공용 배경 기반·자산 최적화
- FC-234 ∥ FC-235: 공용 기반 완료 후 경매/아이템 상세에 병렬 연결
- FC-236: 두 화면 구현 완료 후 통합 리뷰

## 게이트

- 게이트2: 2026-08-11 사용자 승인 완료.
- 게이트3: 전체 reviewer 통과 뒤 사용자 Done·push 승인 필요.
