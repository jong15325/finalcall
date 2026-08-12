---
id: EPIC-WORLD-MAP-BACKGROUND
type: epic
jira_key: KAN-265
title: 실제 게임 소스 세계지도 공통 배경 통합
state: done
children: [FC-261, FC-262, FC-263, FC-264, FC-265, FC-266]
gate: null
---

## 목표

`world-map-game-sources-a-v2.png`를 모든 AppShell route의 단일 공통 배경으로 적용하고 승인된 네 속성 효과를
고정 권역에 단일 Canvas·RAF로 합성한다. AuthLayout은 제외한다.

## 하위 티켓과 의존

- FC-261: 확정 계약·에픽 연결
- FC-262 → FC-263: responsive 자산·공통 scene → 네 권역 승인 효과
- FC-264: 상세 dynamic·목록 static accent 통합과 중복 scene 제거
- FC-265 → FC-266: 기능/접근성/성능 리뷰 → 시각 parity·crop 최종 리뷰

## 게이트

- 게이트1·게이트2·디자인 게이트: 2026-08-12 사용자 승인 완료.
- 게이트3: FC-266 reviewer 통과 뒤 사용자 Done·push 승인 필요.

## 감사 이력

기존 두 배경 에픽의 티켓은 수정하지 않는다. 이 에픽이 scene ownership의 후속 변경만 추적하며 상태 전이는
메인세션이 담당한다.
