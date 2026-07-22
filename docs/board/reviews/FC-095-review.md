# FC-095 리뷰 — EPIC-SHOP 통합 검수

- **에픽**: EPIC-SHOP (KAN-102)
- **대상**: FC-093 backend(커밋 5855626) + FC-094 frontend(9ab2b27+abcaa1f)
- **판정**: **PASS (통과)** — critical 0 · major 0 · minor 2(비차단)
- **일자**: 2026-07-22 (reviewer)
- **정본 대조**: shop-spec v0.2 · api-contract §3.2/§5 · concurrency-review 스킬

## 축별 결과 (전부 이상 없음)
1. **동시성/금전**: 이중판매 3중 방어(shop 행 FOR UPDATE + status CAS 단일승자 + sale_order UK 백스톱)·구매/만료 시간축 배타(live `end_at>now` ↔ expired `end_at<=now`)·취소 CAS 상호배제·잔액 user_id 오름차순(buyer≠seller SHOP_006 선차단, 교차 데드락 차단)·총량보존 S-H(available-gated)·만료 워커 멱등/self-invocation 무관. 동시성 통합테스트가 실 MySQL 커밋으로 고정.
2. **정산 정합**: SettlementRecorder(SHOP) 재사용·수수료 1회·수익원장 1회·아이템 이전. 취소=releaseFromListing(sale_order 0)·만료=TEMP 직행(sale_order 0). fee=settle+final(S-B).
3. **도메인 인가**: 주체=SecurityContext·취소 IDOR SHOP_001 403·자기구매 SHOP_006·SecurityConfig(GET만 permitAll, POST 인증강제)·역할별 노출(fee/settle 누출 없음).
4. **프론트**: `/shops` 계약 준수(목업 /market/listings 폐기)·구매 본문 없음·SHOP_001~006 code 분기·코드화폐 정수 원본+aria·비활성 DOM·무효화 반경 완비.
5. **계약 이탈**: 게이트2 C1~C6 전건 이행. "하드닝 후속"으로 미룬 정확성 항목 없음(FC-089 A4 교훈 반영).

## Minor (통과 차단 아님)
1. `frontend/src/types/errorCodes.ts:53` 주석 `SHOP_001 (403/409)` — 실제 403 단일. 코드 분기라 동작 무관, 주석 갱신 권고.
2. 구매×만료 워커 동시 경합(스펙 §5 시나리오 6) 실 레이스 테스트 부재 — 시간축 배타+멱등+행락 테스트로 논리 커버. 경합 테스트 1건 추가면 완결.

## 하드닝 백로그 검증 (정확성/보안 무관 — 확인)
- **encodeNext null-endAt latent NPE**(`ShopService.java:158-166`): 현재 어떤 경로도 null endAt shop을 생성 안 함(등록 항상 유한값). 도달 불가한 잠재 버그. **무기한 캐시아이템 에픽 착수 시 반드시 게이트로 다룰 latent risk**.
- shop 목록 필터 축소집합(skill/goldforce 제외): UX 스코프 결정, 보안/정확성 무관.

## concurrency-review 체크리스트 커버리지
부록 C #1 self-invocation·#3 락-TX 순서·#5 Retry 멱등·#10 OIV·#11 @Setter·#12 @Builder 통과. 원자적 조건부 UPDATE·인가(주체=SecurityContext·X-User-Id 미신뢰·소유권) 통과.

주: 통합테스트 직접 미실행(Testcontainers MySQL·Docker 필요). 코드·테스트 정합성은 정독 판정. backend-impl이 build SUCCESSFUL(309 green)로 이미 실행.
