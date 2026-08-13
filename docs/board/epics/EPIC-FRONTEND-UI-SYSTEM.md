---
id: EPIC-FRONTEND-UI-SYSTEM
type: epic
jira_key: KAN-303
title: 프론트 공통 UI 시스템과 AppShell 시각 일관성 개선
state: done
children: [FC-270, FC-271, FC-272, FC-273, FC-274, FC-275, FC-276, FC-277, FC-278, FC-279, FC-280, FC-281, FC-282, FC-304]
gate: null
---

## 목표

네이비·골드·오렌지 브랜드 토큰을 단일 정본으로 확정하고, route accent가 공통 chrome으로 누수되지 않도록
AppShell·목록·아이템 카드의 소유권과 재사용 경계를 재구성한다.

## 하위 티켓과 의존

- FC-270: 디자인 정본과 UI 시스템 계약 확정
- FC-271: 런타임 토큰과 Tailwind 매핑 정합화
- FC-272: AppShell chrome과 route accent 격리
- FC-272: 고정 chrome·route accent·선언형 route UI metadata
- FC-273: ListFrame과 공통 상태 레이아웃 구현
- FC-274: 아이템 카드 표시·상호작용 composition 분리
- FC-275~276: 공개·보호 소비자 단계적 이관
- FC-277: 구 API·palette alias 제거와 정적 guard
- FC-278: 접근성·시각회귀·성능 통합 리뷰
- FC-279: 디자인·프론트 규약 정본 동기화
- FC-280: 아이템 카드 시각·클릭 회귀 복구
- FC-281: 목록별 아이템 이미지 clipping 회귀 수정
- FC-282: 모바일 공통 배경과 판매 CTA 색상 회귀 수정

## 게이트

- 게이트1·게이트2: 2026-08-12 사용자 승인 완료.
- 디자인 게이트: 새 화면이 아닌 기존 공통 UI 정합·리팩터링이므로 별도 발동하지 않는다.
- 게이트3: FC-278 reviewer 통과 뒤 사용자 Done·push 승인 필요.
