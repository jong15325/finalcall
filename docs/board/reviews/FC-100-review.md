# FC-100 리뷰 — EPIC-MARKET-DATA 통합 검수

- **에픽**: EPIC-MARKET-DATA (KAN-108)
- **대상**: FC-098 backend(커밋 5db6184) + FC-099 frontend(d9b380e)
- **판정**: **PASS (통과)** — critical 0 · major 0 · minor 3(비차단)
- **일자**: 2026-07-22 (reviewer)
- **정본 대조**: skill-exposure-spec v1.0 · api-contract §3.3 · game-item-skill-format §5 · concurrency-review 스킬

## 축별 결과 (이상 없음)
1. **스킬 시드 §5 정합**: V16 244행을 §5와 **행 단위 대조 일치**(스킬1 100~197·스킬2 200~209·300~435). name=효과 서술 verbatim(정규화·창작 0). 미사용(198·199·210~299) 전부 부재. 중복/누락/초과 0.
   - **★ code 140 판정 확정**: §5.1 위치매핑(101·138·139·140·141=크리 30·35·40·45·50) → **140=45·141=50**. spec §1.4 요약(140=50)은 off-by-one 오류. §1.3(§5=해독 정본) 규정상 backend의 §5 채택이 **정확**. 다른 순차 코드군(공격데미지·가속도·최대속도·뎀반사·독뎀 등)·그룹공유값 행까지 재검 — 추가 오정렬 0.
2. **스킬명 노출**: N+1 없음(ShopRepositoryImpl·AuctionRepositoryImpl 이미 skill fetch join → `.getName()`만 추가). additive nullable·마법 스킬1 null 폴백·계약 §3.3 준수. **경매 대칭 무손상**(뷰 record 필드 2개 추가만·상태머신/CAS/쿼리 무접촉·EPIC-AUCTION 되돌림 없음).
3. **5천 시드 격리·동시성**: @Profile(local)+demo1 마커 멱등(마이그레이션 아님·운영 오염 없음)·LISTED-direct 정합(slot_key 생성컬럼 INVENTORY만 값→LISTED NULL·UK 다중 NULL 무충돌·소유이력 SEED)·동시성 경로 무오염(CAS/락 우회하되 auction/bid/version 무접촉·FK 위반 불가·러너 1회). SkillDefinitionSeedIntegrityTest 독립 방어선.
4. **계약 이탈**: 게이트2 G1~G4 정확 준수.

## Minor (통과 차단 아님)
1. **프론트 마켓 성능** — `MarketPage`+`useNow`(1초) → 누적 `ShopCard` 매초 리렌더(memo 없음). **minor 근거**: 기존 구조(이 에픽 additive 무관)·무한스크롤로 DOM 스크롤 범위 제한·@Profile(local) 데모·정확성/보안 0. **게이트3 비차단, 후속 티켓 권장**(ShopCard memo + goldforce 활성 카드만 now 전달, or windowing).
2. **다양가**(정보성): 게이트2 확인 항목이던 단일가 vs 다양가 — 시더는 다양가(사용자 확정). 결함 아님.
3. **데모 리얼리즘**(정보성): 종류 무관 스킬 배정으로 부정합 매물 가능하나 spec §3.3이 데모 허용. 결함 아님.

## 후속
- **FC-101**(예정): 마켓 목록 성능(ShopCard memo·per-second now 격리 or 가상화). minor-1 후속.
