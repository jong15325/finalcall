---
id: EPIC-PURCHASE
type: epic
jira_key: KAN-97
title: 즉시구매(buyNow) + 거래내역(orders)
state: doing
children: [FC-088]
gate: null
---
## 목표
EPIC-CLOSING 후속. 프론트 "준비 중" 자리 2개를 실기능으로 켠다.
1. **즉시구매**: `buyNowPrice`로 경매를 즉시 낙찰(POST /auctions/{id}/purchase, result_type=BUYNOW). 정산 흐름(sale_order·수익원장·아이템 이전) 재사용.
2. **거래내역**: `GET /me/orders`·`/orders/{id}` — sale_order 조회(구매/판매). 프론트 거래내역 화면.

## 게이트1 승인 (2026-07-22, 사용자)
- 다음 작업으로 "즉시구매 + 거래내역" 선택. EPIC-CLOSING 정산 자산 재사용으로 규모 작음.

## 정본
- `docs/spec/closing-domain-spec.md` v1.0(정산·마감·불변식 I-A~I-H)·`fee-policy-spec` v1.0 · `erd` v1.3(sale_order·platform_revenue_ledger) · `api-contract` v1.12.
- 프론트: `docs/ux/rebuild-contract-map.md`(즉시구매·거래내역 준비중 자리 목록) · 목업 즉시구매 버튼·거래내역.

## 분해안 (게이트1 승인, architect 델타로 조정 가능)
```
FC-088 architect  즉시구매 flow spec + orders API 계약 + erd/contract 델타 → 게이트2 상신
FC-089 backend    즉시구매(POST purchase, buyNowPrice 즉시 SOLD·기존 홀드 해제·정산 재사용) + 거래내역 API(GET /me/orders·/orders/{id})
FC-090 frontend   즉시구매 버튼 실연동(경매상세) + 거래내역 화면(준비중 자리 → 실기능)
FC-091 reviewer   concurrency-review(즉시구매 동시성·정산 정합) + 도메인 인가(orders IDOR·마스킹)
```

## 게이트2 상신 예정 (architect FC-088)
- 즉시구매 동시성 모델(auction 행 락·진행 입찰 홀드 해제·정산 재사용 vs 신규)·buyNow 금전 흐름(직접 차감 vs 홀드+capture)·orders API 계약(필드·마스킹·IDOR 범위).

## 범위 밖
- 마켓(고정가)·커뮤니티·알림·충전 = 별도.
