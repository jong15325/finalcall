---
id: EPIC-DESIGN-WORKBENCH
type: epic
jira_key: KAN-317
title: 실제 프론트 기반 디자인 워크벤치 구축
state: review
children: [FC-283, FC-284, FC-285, FC-286, FC-287, FC-288, FC-290, FC-291, FC-292, FC-293]
gate: design
---

## 목표

정적 HTML 목업의 CSS·AppShell 드리프트를 제거하고 실제 frontend 토큰·레이아웃·공용 컴포넌트를 재사용하는 개발 전용 디자인 워크벤치를 구축한다.

## 하위 티켓과 의존

- FC-283: 계약·운영 규약 확정
- FC-284 → FC-285 → FC-286: 라우트·프레임·첫 시나리오 이관
- FC-287: production 유입 및 복제 방지 가드
- FC-288: 통합 리뷰
- FC-290: 실제 프론트 기반 메인 색상 후보 비교와 브라이트 스틸 선택
- FC-291 → FC-292: 승인 토큰 적용과 통합 리뷰

## 게이트

- 게이트1: 2026-08-13 사용자 승인.
- 게이트2: 2026-08-13 브라이트 스틸 전역 채택과 light/dark focus 분기를 사용자 승인.
- 디자인 게이트: 2026-08-13 브라이트 스틸 선택 완료.
- 게이트3: FC-288 통과 후 사용자 승인.

## 리뷰

- 통합 리뷰: PASS — critical 0 / major 0 / minor 0
- 완료 직전 보안 리뷰: PASS — critical 0 / major 0 / minor 2(비차단 방어 심화)
- 게이트3: 브라이트 스틸 전역 적용과 최종 리뷰 완료, 사용자 승인 대기
