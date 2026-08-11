---
id: EPIC-ELEMENT-DETAIL-BACKGROUND
type: epic
jira_key: null
title: 속성별 상세 몰입 배경 적용
state: doing
children: [FC-233, FC-234, FC-235, FC-236, FC-237, FC-238]
gate: null
---

## 목표

게이트2에서 승인한 하이브리드안(최적화 배경 1장 lazy load + CSS 중심 + 물 속성 제한 Canvas)을
경매 상세와 아이템 상세의 route-scoped 전체 뷰포트/AppShell 시각 영역에 적용하고 접근성·성능 회귀 없이
닫는다. 목록과 다른 라우트에는 적용하지 않는다.

## 하위 티켓과 의존

- FC-233: 공용 배경 기반·자산 최적화
- FC-234 ∥ FC-235: 공용 기반 완료 후 경매/아이템 상세에 병렬 연결
- FC-236: 두 화면 구현 완료 후 통합 리뷰
- FC-237: v1.1 변경 승인에 따른 route-scoped 전체 뷰포트 적용
- FC-238: stacking·scroll·modal·접근성·성능 재리뷰

## 게이트

- 게이트2: 2026-08-11 하이브리드안 및 route-scoped 전체 뷰포트 변경 사용자 승인 완료.
- 게이트3: FC-238 reviewer 통과 뒤 사용자 Done·push 승인 필요.

## 감사 이력

- FC-233~FC-236은 v1.0 콘텐츠 래퍼 범위 구현·리뷰 이력으로 보존한다.
- v1.1 범위 변경은 FC-237~FC-238에서만 추적한다.
