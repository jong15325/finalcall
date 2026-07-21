---
id: EPIC-CLOSING
type: epic
jira_key: KAN-89
title: 경매 마감·낙찰 정산 (수수료 에스크로)
state: doing
children: [FC-081, FC-082, FC-083]
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

## 분해안 (게이트2 후 통합 — architect 팬아웃 판정 반영)
architect 판정: FC-083·084가 `CloseService` 동일 파일 편집 → **병렬 불가·순차 단일 패스**. 정산 도메인을 1개 구현 티켓으로 통합.
```
FC-081 architect  정산 spec v1.0 + erd v1.3 + api-contract v1.12  ✅ done (게이트2 승인)
FC-082 backend    정산 도메인 구현 — V14(sale_order+platform_revenue_ledger)·엔티티/리포·마감 워커
                  (CloseWorker·CloseService, @Scheduled·비관락·CAS·SCHEDULED 포함)·SOLD(WON·CAPTURED·
                  아이템 이전·수수료·seller 크레딧·수익원장)·UNSOLD(반환)·FeeCalculator. [money·concurrency 핵심]
FC-083 reviewer   concurrency-review(마감·정산 동시성·불변식 I-A~I-H·에스크로 정합·총량 보존)
```

## 게이트2 — 승인됨 (2026-07-21, 사용자)
- **스키마**: 기존 `sale_order` 사용 + `V14__sale_order.sql` 생성(fee_amount NOT NULL·fee_policy_version·source UK). 신규 테이블/컬럼확장 기각.
- **마감 워커**: `@Scheduled` 폴링 + 경매 1건 독립 TX + 행 비관락 + 종료성 CAS + **SCHEDULED 포함 스캔**. 분산락·신규 인덱스 불요.
- **seller 지급**: 게임머니 크레딧 + sale_order 지급 기록.
- **수수료 계산**: SOLD TX 1회(누진→반올림→cap→최소), fee_policy_version 스탬프.
- **★ business fee 귀속 = ④-C 전용 수익 원장**(사용자 결정) — 게임머니 총량 보존 + 회계/감사 추적. architect 추천(④-A 소멸) 대신 채택.
- architect가 FC-081에서 ④-C 반영해 spec v1.0 + erd/api-contract 확정 버전 상향 중.

## 하드닝 백로그 (FC-083 검수 minor, 비차단)
- **M1**: SOLD 잔액 락 순서 user_id 오름차순화(현 winner→seller 고정, 크로스 트레이드 이론적 데드락 표면 폐쇄). spec §3.4가 재시도 수용이라 정확성 결함 아님.
- **M2**: `settle<0`(P<fee<100) 클램프 또는 리스팅 최소 시작가 하한 실확인(초소액 매물 stuck 방지).

## 범위 밖 (후속 에픽)
- 즉구매(purchase, buyNowPrice·result_type=BUYNOW) · 거래내역(/me/orders) · 프론트 즉구매 버튼/거래내역 화면 활성화.
