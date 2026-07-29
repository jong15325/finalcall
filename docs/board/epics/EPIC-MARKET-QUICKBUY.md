---
id: EPIC-MARKET-QUICKBUY
type: epic
jira_key: KAN-169
title: 마켓 즉시구매 — 카드정보 UI 차용한 인라인 구매
state: done
owner: main
children: [FC-145, FC-146, FC-147, FC-148, FC-149, FC-150]
gate: null
---

> **에픽 완료(2026-07-29)**: 전 자식 FC-145~150 done, reviewer 전건 통과, 사용자 승인(게이트3). C1~C4 4개 커밋(`d088645`·`f74c20f`·`25d3652`·`f1aa276`). push는 사용자 직접.

## 목표
아이템 마켓(`MarketPage`)에서 아이템 클릭 시 **상세 페이지(`MarketDetailPage`)로 이동하지 않고**, 목록에서 아이템 영역·구매 버튼 클릭 시 게임 **"카드정보(CARD INFO)" UI**(`docs/game_ui/card_info/카드정보-특수스킬.png`)를 차용한 패널로 **바로 구매**하게 한다.

## 배경·제약
- **계약 변경 없음**: 구매 API `POST /shops/{id}/purchase`(FC-094) 이미 존재. 실패코드 SHOP_004(이미판매)·SHOP_005(잔액부족)·SHOP_006(자기구매). → architect 계약 단계 스킵.
- **데이터 충분**: 리스팅에 게임 속성(명칭·레벨·속성·스킬1/2·specSnapshot·판매자·가격) 존재 → 카드정보 속성/스킬 렌더 가능.
- **디자인 게이트 필수**(새 UI): 목업 선제작→사용자 승인 후 구현([[design-mockup-first]]·[[options-need-html-mockup]]). 게임 카드 aesthetic을 커머스에 차용하는 결정이라 팔레트·충실도는 게이트에서 확정.
- 반응형 별도 설계([[responsive-separate-design]]) — 웹/모바일 각각.

## 분해 (게이트1 — 사용자 조정 대상)
- **FC-145 (디자인 목업)**: 카드정보 UI 차용한 마켓 즉시구매 패널 HTML 목업. 상호작용(모달 vs 인라인)·충실도(게임 다크패널 vs 앱 커머스 적응)·상세페이지 대체 여부를 목업으로 제시.
- **FC-146 (구현, 목업 승인 후 발번)**: 목업 확정본대로 실 React 구현 — 목록 클릭 인터랙션·카드정보 구매 패널·purchaseShop 연동·성공/실패 처리. (승인 전까지 미발번)

## 결정 대기 (디자인 게이트)
1. 상호작용: **모달 팝업**(게임 카드정보 팝업과 정합) vs 목록 인라인 확장
2. 충실도: 게임 다크블루 패널 **충실 차용** vs 앱 커머스 톤으로 적응(구조만 차용)
3. `MarketDetailPage` 네비게이션 **완전 대체** vs 병존
