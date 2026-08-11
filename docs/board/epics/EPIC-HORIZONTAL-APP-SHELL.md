---
id: EPIC-HORIZONTAL-APP-SHELL
type: epic
jira_key: null
title: Vuexy 수평 내비게이션과 공통 AppShell 재구성
state: review
children: [FC-245, FC-246, FC-247, FC-248, FC-249, FC-250, FC-251, FC-252, FC-253, FC-254, FC-255, FC-256]
gate: null
---

## 목표

모든 AppShell route를 2단 수평 내비게이션, 공통 배경 layer, 단일 white content plane 구조로 재구성한다.
모바일 내비게이션과 상세 속성 배경은 보존한다.

## 선행

- `EPIC-ELEMENT-DETAIL-BACKGROUND`의 FC-244 reviewer 통과 결과를 기준선으로 삼는다.
- API·백엔드·DB와 AuthLayout은 변경하지 않는다.

## 하위 티켓과 의존

- FC-245: 계약·디자인 정본
- FC-246: horizontal nav model
- FC-247: responsive AppShell migration
- FC-248: common background/content plane
- FC-249 ∥ FC-250 ∥ FC-251: 공개 ∥ 보호 ∥ 상세 route 회귀
- FC-252: 최종 reviewer
- FC-253: 공통 outer gutter·mobile white frame geometry 변경
- FC-254: geometry 변경 최종 재리뷰
- FC-255: 경매 상세 불투명 page-level content region
- FC-256: 경매 region·밝은 surface·stacking 최종 재리뷰

기존 흐름은 감사 이력으로 보존한다. 최신 변경 흐름은 `FC-254 → FC-255 → FC-256`이다.

## 게이트

- 게이트1·게이트2·디자인 게이트: 2026-08-11 사용자 승인 완료.
- 공통 plane geometry 변경: 2026-08-11 사용자 승인 완료.
- 경매 상세 page-level white region 예외: 2026-08-11 사용자 승인 완료.
- 게이트3: FC-256 reviewer 통과 뒤 사용자 Done·push 승인 필요.

## 감사 이력과 상태 전이

- FC-245~FC-252는 v1.0 구현·리뷰 이력으로 수정하지 않는다.
- v1.1 geometry 변경은 FC-253~FC-254에서만 추적한다.
- v1.2 경매 상세 예외는 FC-255~FC-256에서만 추적한다.
- 총괄이 FC-255를 위임할 때 에픽 롤업을 `review → doing`으로 전이한다. FC-256 통과 전에는
  `gate: null`을 유지하고, 통과 후 총괄이 `gate: gate3`로 갱신한다.
