# EPIC-PURCHASE 검수 — FC-089(backend) + FC-090(frontend)

검수: reviewer(concurrency-review) · 2026-07-22 · 커밋 fda5240(FC-089)·a732f0a(FC-090)
정본: purchase-spec v1.0(P-A~P-H·§7-A4)·closing-domain-spec(I-H)·api-contract v1.13

## 게이트 판정: **NOT PASSED (changes-requested)** — critical 0 · **major 1** · minor 0

## 검증 재현
backend spotless/checkstyle/test 그린(279, Testcontainers 실 MySQL, 동시성 CountDownLatch 실경합) · frontend typecheck/lint/test 490.

## MAJOR-1 — 즉시구매 잔액 락 user_id 오름차순 아님 (A4 위반) → 교차거래 데드락 표면
- `PurchaseService`가 잔액 락을 고정 도메인 순서(loser→buyer→seller)로 획득. 게이트2 승인 §7-A4("user_id 오름차순 규율 재사용") 이탈.
- 교차거래(A가 B경매 ∥ B가 A경매)에서 auction 행이 달라 직렬화 안 됨 → AB-BA 데드락(1213)→409. 입찰 경로의 "락 실패 0" 회귀 기준을 purchase가 낮춤. purchase×bid도 동일.
- **A4 판정: strict 필요**(§3.4 수용 불충분) — 게이트2 승인이 strict·입찰 회귀 기준 정합·동기요청 사용자 실패·저비용 실현가능.
- 수정(option A): 잔액 3연산 user_id 오름차순 정렬 + PurchaseDeadlockRegressionIntegrationTest(락 실패 0). §3.5(release before debit)는 buyer==loser 동일행일 때만이라 무충돌.

## 중점 축 (6/7 PASS)
1. 금전 불변식 P-A~P-H: PASS(총량보존·이중정산 차단 시간축 배타·직접차감·패자 RELEASE·수수료 재사용).
2. SettlementRecorder 추출: PASS(CloseService 무회귀·MANDATORY TX).
3. 즉시구매 동시성: PASS(FOR UPDATE·live CAS·idempotency·시간축 배타·TOCTOU 없음·PC clear 회피).
4. **A4 데드락: FAIL(MAJOR-1)**.
5. 거래내역 IDOR/역할노출: PASS(party 스코프·당사자 검증·fee/settle SELLER만 응답원문 부재·마스킹).
6. 프론트 FC-090: PASS(활성조건·표시제어≠인가·code 에러매핑·myRole 역할노출·무한스크롤·다이얼로그 a11y).
7. 계약 정합: PASS(v1.13 1:1·BUYNOW·스키마 무변경·불필요 변경 없음).

## 후속
- FC-089 doing 복귀·review_status=changes-requested. A4 수정(user_id 정렬 + 회귀 테스트) 지시함.
- FC-090 review_status=passed(전 축 통과). 재검은 FC-089 수정 후 A4 델타만.

## A4 재검 (커밋 b44aea0) — **PASSED** (critical/major 0)
- user_id 오름차순 락(applyBalanceInUserIdOrder·BalanceStep 정렬)·§3.5 buyer==loser 단일스텝 무충돌 확인.
- PurchaseDeadlockRegressionIntegrationTest(교차구매·purchase×bid) 실경합·락 실패 0(BidDeadlock 동등 강도).
- SettlementRecorder 판매자 크레딧 분리(잔액 무접촉)·MANDATORY TX로 P-H 총량보존 원자성 유지. CloseService 크레딧 회수·마감 무회귀(SOLD/UNSOLD·CloseWorker 그린).
- backend 281 --rerun-tasks BUILD SUCCESSFUL. 프론트 델타 무변경(490 유효).
- **비차단 관찰(하드닝 백로그)**: purchase×close 교차 = 기존 bid×close와 동일 클래스(CloseService fixed 순서). money 안전(P-H)·close 워커 재시도 자가치유. EPIC-SHOP 등 동기 정산 추가 시 close user_id 정렬 재검토.
- **FC-089 review_status=passed.**
