---
id: EPIC-CLOSING
type: epic
jira_key: KAN-89
title: 경매 마감·낙찰 정산 (수수료 에스크로)
state: doing
children: [FC-081]
gate: null
---
## 목표
경매 생애주기를 완성한다 — **마감 워커(ACTIVE→SOLD/UNSOLD) + 낙찰 정산(수수료·에스크로) + 유찰 처리**.
지금은 입찰은 되나 endAt 지나도 ACTIVE 유지·아무것도 정산되지 않는다(마감 강등 워커 부재).

## 게이트1 승인 (2026-07-21) — 백엔드 동결 해제 첫 에픽
- **범위 = 코어만**: 마감 워커 + 낙찰 정산(SOLD) + 유찰(UNSOLD). **즉구매(purchase)·거래내역(/me/orders)은 후속 에픽.**
- 가장 위험한 money·concurrency를 먼저 안정화한다.

## 설계 자산 (백엔드가 미리 심어둠 — 전이만 미구현)
- enum: `AuctionStatus.SOLD/UNSOLD` · `AuctionResultType.BID/BUYNOW` · `BidStatus.WON` · `MoneyHoldStatus.CAPTURED`(전부 정의됨, 전이=EPIC-CLOSING 소유).
- `auction.result_type`(nullable)·`highest_bidder_id`·softclose config 컬럼 존재(NULL 유지 중).
- 인덱스 `ix_auction_status_end (status, end_at)` — 마감 워커 스캔용(D-058).
- `MoneyHold`(HELD→RELEASED 구현됨, CAPTURED 미구현) 에스크로 인프라 존재.
- **신설 필요**: 정산 도메인·settlement 스키마(V14~)·`@Scheduled` 마감 워커.

## 정본
- 수수료: `docs/spec/fee-policy-spec.md` v1.0(판매자 단독·누진 6/5/4/3%·최소 100/cap 300,000·settle=final−fee·원단위 사사오입).
- 금전/락: `docs/spec/bid-domain-spec.md`(MoneyHold·auction 행 비관락+CAS, watchdog 없는 분산락 배제).
- `docs/spec/erd.md` v1.2 · `docs/spec/api-contract.md` v1.11.

## 분해안 (게이트1 승인)
```
FC-081 architect  정산 도메인 spec + ERD(V14 settlement) + api-contract 델타 → 게이트2 상신
FC-082 backend    경매 마감 워커(@Scheduled·idempotent·SOLD/UNSOLD 분기) [동시성 핵심]
FC-083 backend    낙찰 정산(SOLD: WON·CAPTURED·아이템 이전·수수료 누진·seller settle·business fee) [money 핵심]
FC-084 backend    유찰(UNSOLD: 아이템 반환·hold 없음)
FC-087 reviewer   concurrency-review(마감·정산 동시성·money 불변식·에스크로 정합)
```

## 게이트2 상신 예정 (architect FC-081)
- settlement 스키마 형태(신규 테이블 vs auction 컬럼)·마감 워커 동시성 모델(스케줄러 idempotency + auction 행 비관락)·
  seller 게임머니 지급 원장·수수료 계산 배치(SOLD TX 1회, 누진→반올림→cap→최소).

## 범위 밖 (후속 에픽)
- 즉구매(purchase, buyNowPrice·result_type=BUYNOW) · 거래내역(/me/orders) · 프론트 즉구매 버튼/거래내역 화면 활성화.
