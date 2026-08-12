---
id: EPIC-ELEMENT-DETAIL-BACKGROUND
type: epic
jira_key: KAN-263
title: 속성별 상세 몰입 배경 적용
state: done
children: [FC-233, FC-234, FC-235, FC-236, FC-237, FC-238, FC-239, FC-240, FC-241, FC-242, FC-243, FC-244]
gate: null
---

## 목표

승인된 몰입형 글래스 셸을 두 상세 route에 적용한다. 배경·네 속성 파티클을 Sidebar·TopNavbar·footer를
포함한 AppShell 전체에 연결하고 chrome·card·CTA를 route theme으로 조정하되 다른 route baseline은 보존한다.

## 하위 티켓과 의존

- FC-233: 공용 배경 기반·자산 최적화
- FC-234 ∥ FC-235: 공용 기반 완료 후 경매/아이템 상세에 병렬 연결
- FC-236: 두 화면 구현 완료 후 통합 리뷰
- FC-237: v1.1 변경 승인에 따른 route-scoped 전체 뷰포트 적용
- FC-238: stacking·scroll·modal·접근성·성능 재리뷰
- FC-239 ∥ FC-240: AppShell route theme 기반 ∥ 네 속성 particle parity
- FC-241 ∥ FC-242: 경매 상세 ∥ 아이템 상세 글래스 셸 재디자인
- FC-243: route 격리·baseline·성능 통합 검증
- FC-244: 최종 reviewer

## 게이트

- 게이트1·게이트2·디자인 게이트: 2026-08-11 몰입형 글래스 셸과 에픽 확장 사용자 승인 완료.
- 게이트3: FC-244 reviewer 통과 뒤 사용자 Done·push 승인 필요.

## 감사 이력

- FC-233~FC-236은 v1.0 콘텐츠 래퍼 범위 구현·리뷰 이력으로 보존한다.
- v1.1 범위 변경은 FC-237~FC-238에서만 추적한다.
- v2 AppShell theme·네 속성 particle parity·상세 재디자인은 FC-239~FC-244에서 추적한다.

## 상태 전이 제안

신규 하위 티켓이 todo이므로 총괄이 최초 위임할 때 에픽 롤업을 `review → doing`으로 전이한다. FC-244
통과 전에는 gate3를 설정하지 않고, 최종 reviewer 통과 후 총괄이 `gate: gate3`로 갱신한다.
