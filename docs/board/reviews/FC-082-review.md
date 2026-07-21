# 정산 도메인 concurrency-review — FC-082 (EPIC-CLOSING)

검수: reviewer(concurrency-review 스킬) · 2026-07-21 · 커밋 `7110c9d`
정본: closing-domain-spec v1.0(불변식 I-A~I-H)·fee-policy-spec v1.0·bid-domain-spec(락·PC clear)

## 게이트 판정: **PASSED** (critical 0 · major 0 · minor 3 비차단)

## 검증 재현 (실행)
spotlessCheck·checkstyleMain/Test 통과 · **`:backend:test --rerun-tasks` 255/0/0**(Testcontainers 실 MySQL).
동시성 테스트 4건이 `CountDownLatch`로 16스레드 실경합 유발(순차 아님), DB 상태+총량 보존 단언.

## 중점 축 (전부 PASS)
1. 금전 불변식: **I-H 총량 보존**(winner −final = seller +settle + ledger +fee, final=settle+fee, cap/최소 경계 실측)·이중정산 DB 차단(source UK·ledger UK, 1차 방어=경매 행 락)·에스크로(capture balance·held 동시감소 CAS)·수수료 검산(2,480,000→110,200·경계 전건).
2. 마감 워커 동시성: FOR UPDATE 하 전이·종료성 CAS 2회차 무부작용(16스레드 실증)·PC clear 함정 회피(판정 지역변수 복사+@Modifying CAS)·개별 실패 격리·SCHEDULED 포함.
3. 소프트클로즈 경합: 락 스냅샷 최신 end_at 재검증→skip(I-G 테스트).
4. TX 경계: 경매 1건=독립 TX·SOLD 원자적·아이템 이전 CAS+이력 정합.
5. 계약 정합: result_type BID/NULL·WON·HELD→CAPTURED·프론트/API 무변경.
6. jpa-convention·checkstyle 실통과.

## SaleOrder 베이스클래스: BaseCreatedEntity 채택 **정확**(append-only, updated_at 없음. BaseTimeEntity였으면 validate 부팅 실패). spec §2.2 표기가 드리프트 → 정정 완료(M3).

## Minor (비차단, 후속)
- **M1(하드닝 백로그)**: SOLD 잔액 락 순서가 user_id 오름차순 아님(winner→seller 고정) — 크로스 트레이드 이론적 데드락 표면. spec §3.4가 데드락→다음 tick 재시도 수용·워커 격리로 정확성 결함 아님. capture/credit user_id 정렬로 표면 폐쇄 권고.
- **M2(하드닝 백로그)**: settle<0(P<fee<100) 미클램프 — 초소액 매물 stuck 가능. spec 이연(리스팅 최소 시작가가 <100 배제 전제). 리스팅 하한 실확인 권고.
- **M3(정정 완료)**: spec §2.2 SaleOrder "BaseTimeEntity"→"BaseCreatedEntity" 문서 드리프트.

## 후속
FC-082·083 review_status=passed. M1·M2는 EPIC-CLOSING 하드닝 백로그. 게이트3(에픽 완료 승인·push) 대기.
