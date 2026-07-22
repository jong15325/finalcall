---
id: EPIC-SHOP
type: epic
jira_key: KAN-102
title: 고정가 마켓(shop) — 아이템 즉시 판매·구매
state: done
children: [FC-092, FC-093, FC-094, FC-095]
gate: null
---
## 게이트3 — Done 승인 (2026-07-22, 사용자)
- reviewer PASS(critical/major 0) + 온디맨드 보안 0건 후 사용자 Done 승인. FC-092~095 전건 done. **push는 사용자 직접**(미푸시 커밋 7건).
- 후속: FC-096(취소 UI)·EPIC-MARKET-DATA(스킬 마스터·마켓 대량 시드) 별도 진행.

## 목표
경매(입찰·마감) 옆에 **고정가 마켓**을 연다. 판매자가 아이템을 정가로 즉시 판매 등록 → 구매자가 마켓에서 둘러보고 바로 구매. 프론트 `/market` "준비 중" 자리를 실기능으로 켠다.
- **등록**: 판매자가 인벤토리 아이템을 고정가로 출품(에스크로 INVENTORY→LISTED CAS 재사용).
- **구매**: `POST /shops/{id}/purchase` — 정가 즉시 SOLD·구매자 직접 차감·정산 흐름(sale_order·수익원장·아이템 이전) 재사용.
- **취소**: 판매자가 팔리기 전 내리기(→ 인벤 회수, releaseFromListing 재사용).
- **만료**: 판매 기한 도달 시 자동 회수(→ 임시 보관함/TEMP). 만료 워커.
- **조회/거래내역**: 마켓 목록·상세 + orders는 SHOP 케이스 이미 준비됨.

## 게이트1 승인 (2026-07-22, 사용자)
- 다음 작업으로 "고정가 마켓" 선택(핸드오버 후보 a). 정산 자산(SettlementRecorder·sale_order source_type=SHOP·수익원장) 재사용으로 규모 작음.
- **제품 결정 2건**:
  1. **판매 기한 = 기한 기본 + 무기한 지원**. 기한 값은 **관리자 조정 가능한 설정 옵션**(하드코딩 금지). 기한 만료 시 **자동 회수 → 임시 보관함(TEMP)**. 무기한(`end_at` null)도 지원(향후 캐시아이템용).
  2. **판매 취소 허용**. 판매자가 팔리기 전 내려서 회수.

## 정본 (재사용)
- `docs/spec/closing-domain-spec.md` v1.0(정산·불변식 I-A~I-H, 총량보존)·`fee-policy-spec.md` v1.0(판매자 부담·경매/고정가 공통, 유형별 분기 없음)·`purchase-spec.md` v1.0(SettlementRecorder 재사용 판정)·`erd.md` v1.4(sale_order·platform_revenue_ledger, §4.2 shop 예비 스펙)·`api-contract.md` v1.13(§3.2 shop 엔드포인트·§5 SHOP_001~006)·`domain-spec.md` §2·§5(FixedSale 별도 애그리거트·상태머신).
- 프론트: `docs/ux/rebuild-contract-map.md`(마켓 준비중 자리) · `frontend/src/pages/MarketPage.tsx`(ComingSoonScaffold 자리) · navItems `ready:false` 스위치.

## 재사용 vs 신규 (조사 2026-07-22)
- **그대로 재사용(코드 변경 0)**: SettlementRecorder(sourceType 파라미터 이미 존재)·SaleOrder+Repo·SaleOrderSourceType.SHOP(값 정의됨)·PlatformRevenueLedger·FeeCalculator·FeePolicyProperties·InventoryService.transferListedToBuyer/releaseFromListing·ItemInstance INVENTORY↔LISTED CAS·UserBalance increase/decreaseGameMoney·ItemOwnershipHistory+TransferType.TRADE. sale_order·platform_revenue_ledger 테이블(V14) 스키마 그대로.
- **신규**: shop 엔티티+ShopStatus(ACTIVE/SOLD/EXPIRED/CANCELLED)+ShopRepository(구매 락 프로젝션·종료성 CAS)·신규 Flyway shop 테이블·ShopService(등록·취소)·ShopPurchaseService(구매 머리, PurchaseService 골격 차용·홀드/패자/시간축 제거로 단순화)·만료 워커·ShopController·SHOP ErrorCode enum. 프론트 shop.ts/queries·마켓 목록/상세/판매등록/구매 다이얼로그.

## 분해안 (게이트1 승인, architect 델타로 조정 가능)
```
FC-092 architect  shop 도메인 spec 확정(등록·구매·취소·기한/만료 flow) + shop 테이블 Flyway 델타 + api-contract 정밀화 → 게이트2 상신
FC-093 backend    shop 엔티티/Repo/Flyway + 등록·구매(정산 재사용)·취소 서비스 + 만료 워커 + ShopController + SHOP ErrorCode
FC-094 frontend   마켓 목록/상세 실기능화 + 고정가 판매등록 + 구매 다이얼로그 + ready:true 스위치 (shop.ts/queries/shopErrors)
FC-095 reviewer   concurrency(구매 동시성·이중판매 차단·정산 정합·만료×구매 교차) + 도메인 인가(shop IDOR·자기구매·소유검증)
```

## 게이트2 — 승인됨 (2026-07-22, 사용자) — FC-092
- **제품 결정(사용자 확정)**: 판매 기한 = **관리자 단일 설정값 자동적용**(`shop.listing.default-duration-days` 기본 7일, 판매자 선택·최대값 개념 없음). 등록 요청에 기한 입력 없음, 서버가 `end_at = now + 설정일수` 자동 계산. `end_at` nullable 유지 → **향후 무기한 캐시아이템**·**기한 연장 캐시아이템**(extendUntil seam, 별도 에픽). 판매 취소 허용.
- **기술 결정(architect 추천 채택)**: C1 구매 shop 행 FOR UPDATE+종료성 CAS(`status=ACTIVE AND (end_at IS NULL OR end_at>now)`)·C2 잔액 user_id 오름차순(buyer/seller 2행)·C3 sale_order (source_type,source_id) UK 이중판매 차단(신규 0)·C4 만료 워커 60초·배치 200·TEMP 직행·C6 cancel POST(경매 대칭).
- **스키마 영향 = 신규 테이블 1개(shop, V15)뿐, 컬럼/인덱스/UK 변경 0**. 정산·수수료·거래내역·수익원장·인벤토리 CAS 전부 코드 변경 0 재사용. 기존 티켓 파급 없음.

## 온디맨드 보안 리뷰 (2026-07-22, 에픽 완료 직전) — 취약점 0건
- `/security-review` 1회(섹션 9 보안층 ③). **HIGH/MEDIUM 0건**. 확인 통제: SecurityContext 주체(X-User-Id 미신뢰)·cancel 소유권 IDOR 검증·자기구매 SHOP_006·서버 권위 가격(구매 본문 없음)·QueryDSL enum 화이트리스트(주입면 폐쇄)·fee/settle 노출 없음(shop DTO는 공개 데이터만)·XSS 없음(dangerouslySetInnerHTML 부재)·V15 FK/CHECK 안전. reviewer 확인소 판정과 정합.

## 범위 밖 (별도 티켓/에픽)
- **고정가 판매 관리·취소(내리기) UI = FC-096**(후속, 게이트 결정 2026-07-22). 백엔드 cancel API는 FC-093에서 구현됨, UI 소비처만 후속. EPIC-SHOP done을 막지 않음.
- 마켓 상세 페이지(/market/:id) = FC-094에 편입(사용자 게이트 결정 "신설").
- 가격 흥정·제안(번개장터식) · 관리자 콘솔(기한 옵션 UI) · 커뮤니티·알림·충전 · EPIC-GRADE·EPIC-SEARCH.
