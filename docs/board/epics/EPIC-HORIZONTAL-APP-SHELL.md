---
id: EPIC-HORIZONTAL-APP-SHELL
type: epic
jira_key: null
title: Vuexy 수평 내비게이션과 공통 AppShell 재구성
state: todo
children: [FC-245, FC-246, FC-247, FC-248, FC-249, FC-250, FC-251, FC-252]
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

흐름: `FC-245 → FC-246 → FC-247 → FC-248 → (FC-249 ∥ FC-250 ∥ FC-251) → FC-252`.

## 게이트

- 게이트1·게이트2·디자인 게이트: 2026-08-11 사용자 승인 완료.
- 게이트3: FC-252 reviewer 통과 뒤 사용자 Done·push 승인 필요.

