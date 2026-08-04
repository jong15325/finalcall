---
id: EPIC-CARD-SYSTEM
type: epic
jira_key: KAN-202
title: 카드 컴포넌트 통합 (디자인 시스템)
state: done
children: [FC-179, FC-180, FC-181, FC-182, FC-183, FC-184]
gate: null
---

> **게이트1 승인(2026-08-04)**: 전체(T1~T6), T7(경매 카드 프리미티브 추출) 보류. 순서 = T1·T2·T3 먼저(독립·저위험) → T4→T5→T6.

## 목표
"같은 디자인 = 같은 정본 컴포넌트"를 구조로 강제한다. 페이지마다 카드 영역을 재구현해 "똑같이"가 매번 다르게 나오는 재발 문제(사용자 피드백 2026-08-04)를 해소. 계획 정본 = `docs/common/proposals/card-system-consolidation-proposal-v0.1.md`.

## 설계 요지
- **`item`을 유일 카드 커널**로(feature→item 단방향). CardCompareOverlay(auction)·channelLimit·카드정보 CSS(shop)를 item으로 승격(FC-178 M1 이행).
- **정본 4종**: `ItemCard`(본체·variant 정비)·**신설** `ItemCardTile`(클릭 표면)·**신설** `CardInfoDialog`(모달 셸, 구매 뮤테이션은 footer 슬롯)·**신설** `ItemCardGrid`(variant market/auction/inventory).
- **variant 모델**로 boolean 폭발 차단(hidePrice→nullable price, skillFlip→variant).
- **과설계 경계**: 가로 경매카드 병합 금지·만능 카드 금지·뮤테이션 공유모달 승격 금지.

## 분해 (T1~T6, T7 보류)
| 티켓 | T | owner | 내용 | 병렬 |
|---|---|---|---|---|
| FC-179 | T1 | backend-impl | 스킬명 API(ItemSummaryResponse += skill1/2Name) + api-contract §3.3 델타 | ∥ |
| FC-180 | T2 | consultant | docs/frontend/rules.md 카드 정본 규약 성문화(구조 규약 → consultant) | ∥ |
| FC-181 | T3 | frontend-impl | ItemCardGrid + 3그리드 이관 + 인벤 간격 축소 | ∥ |
| FC-182 | T4 | frontend-impl | CardInfoDialog 셸 + Shop/Inventory 리팩터(위험↑ a11y) + CSS·channelLimit 승격 | 직렬 |
| FC-183 | T5 | frontend-impl | ItemCardTile + ShopCard/InventoryItemCard 어댑터화 + CardCompareOverlay 승격 | 직렬(T4 후) |
| FC-184 | T6 | frontend-impl | ItemCard variant 정비 + 스킬명 FE 배선 | 직렬(T1·T4·T5 후) |

- **게이트2**: 신규 없음(스킬명 게이트2 A 기승인, 통합 순수 FE). **consultant**: T2만.
- **불변식**: 직렬화 JSON 형상 불변·시각 픽셀 보존. 위험 큰 T4/T6은 시각 diff·a11y 테스트로 게이트.
- **T7 보류**: 경매 카드(가로/세로) 공유 프리미티브 추출은 후속.
