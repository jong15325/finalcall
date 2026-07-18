---
id: EPIC-ITEM
type: epic
jira_key: KAN-23
title: 아이템·인벤토리 백엔드 — item_template·item_instance·인벤토리·소유이력
state: done
children: [FC-019, FC-020, FC-021, FC-022, FC-023, FC-024]
gate: null
---
## 목표
- 경매/고정가의 **선행 도메인** 구축 — 아이템 정의(마스터)·개별 인스턴스·인벤토리(96칸+임시보관)·소유이력.
- 계약 §4.1(아이템·시세)·§4.2(인벤토리) + erd §4·§7(item_template/item_instance/item_ownership_history/temp_storage) 실구현.
- 범위(게이트1 승인 2026-07-18): item_template·item_instance·인벤토리·소유이력 + 카탈로그/상세/인벤토리 API. **시드는 최소 스텁만**(원게임 실데이터 대량 시드는 별도 티켓 이연).
- 제외(이연): 시세집계 `market-prices`(§4.1 — 거래 데이터 누적 후) · 원게임 실데이터 대량 시드(D-067) · 주문(§4.3, EPIC-CLOSING) · 화폐(§4.4, EPIC-CURRENCY 완료·EPIC-CHARGE).

## 분해안 (게이트1 승인 2026-07-18 · 게이트2 반영으로 FC-019가 최종 확정)
- FC-019 architect(done): 계약 §4.1/4.2 검증, item-domain-spec 확정, 슬라이싱. 게이트2 4결정 반영(erd v0.9·spec v0.2).
- FC-020 backend-impl: item_template·skill_definition + 카탈로그 API `GET /item-templates` (Flyway V6).
- FC-021 backend-impl: item_instance·ownership_history + 상세 API `GET /items/{id}` (V7).
- FC-022 backend-impl: 인벤토리 3 API + slot_key UK(G2)·temp cursor 인덱스(G3) (V8, ItemInstance.java 편집).
- FC-023 backend-impl: 최소 시드(seed user+balance·template8·skill5·instance10·소유이력) (V9).
- FC-024 reviewer: EPIC-ITEM 통합 리뷰(도메인 인가·동시성·QA).

의존/팬아웃: FC-019 → **FC-020 → FC-021 → FC-022 → FC-023 (전부 순차 단일 체인, 병렬 불가**: FK 선형 의존 + Flyway 단일 채번 공유 충돌 + ItemInstance.java 쓰기 교차) → FC-024.
파이프라인: architect(done) → 단일 backend-impl 순차 단일패스(V6→V9) → reviewer → Done.
게이트2 결정: (a) 진입=시드-only, (b) 시드 template8+skill5+instance10, (c) market-prices 제외 확정, (d) G2·G3 스키마 승인.
비고: 프로그램 로드맵 = EPIC-ITEM → EPIC-AUCTION → EPIC-BID(핵심 동시성·보안 첫 실적용) → EPIC-CLOSING → EPIC-SHOP.
