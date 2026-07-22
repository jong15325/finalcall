---
id: EPIC-SHOP-MANAGE
type: epic
jira_key: KAN-115
title: 판매 관리 — 내 고정가 리스팅 조회·취소(내리기)
state: doing
children: [FC-103, FC-104, FC-096, FC-105]
gate: null
---
## 목표
판매자가 자신의 진행 중 고정가 리스팅을 **조회**하고 **내릴(취소)** 수 있게 한다. 취소 백엔드(`POST /shops/{id}/cancel`)는 FC-093에서 구현됨. 신규 = **내 판매목록 조회 엔드포인트** + **마이페이지 '내 판매' 화면**.

## 게이트1 승인 (2026-07-22, 사용자)
- FC-096(취소 UI 후속)을 다음 작업으로 선택. 스코프 확인 결과 조회 API 부재 → 백엔드 소량 추가 + 새 화면 필요한 작은 에픽으로 승격.
- **디자인 결정**: (위치) **마이페이지 '내 판매' 섹션** · (디자인 정본) **기존 마켓 카드 그리드 재사용 + '내리기' 버튼**(game-market 목업에 없는 화면 → 승인 디자인 재사용, 디자인 게이트 충족).

## 정본 (재사용)
- `docs/spec/shop-spec.md` v1.0(취소 flow·상태머신)·`api-contract §3.2`(shop)·erd 인덱스 `(seller_id, status)`(판매자 목록, **이미 정의**).
- 재사용: `ShopRepository`·`ShopService.cancel`·`releaseFromListing`(FC-093) · 프론트 `features/shop`(ShopCard·shop.ts·queries) · 마이페이지 통합 홈.

## 분해안 (게이트1 승인, architect 델타로 조정 가능)
```
FC-103 architect  내 판매목록 조회 계약(GET /me/shops 또는 /shops?mine — 판매자 주체·상태 필터·커서) + api-contract 델타 → 게이트2(소량 read 엔드포인트)
FC-104 backend    조회 쿼리(seller_id 인덱스 재사용)·컨트롤러·역할별 노출(본인 fee/settle 가능)
FC-096 frontend   마이페이지 '내 판매' 섹션(마켓 카드 그리드 재사용 + 내리기 → cancel 연동·무효화 반경)
FC-105 reviewer   인가(내 것만 조회·취소 IDOR)·취소 동시성·정합
```

## 게이트2 — 승인됨 (2026-07-22, 사용자) — FC-103
- **M1 엔드포인트 = `GET /me/shops`**(판매자=SecurityContext·IDOR 안전, /me/orders·/me/inventory 동형).
- **M2 상태 필터 = 기본 ACTIVE**(판매 중), `ALL`/각 상태로 팔림·만료·취소 이력.
- **M3(사용자 정정) = 등록가 + 예상 정산액**: `MyShopSummary`(신규, /me/shops 전용) = ShopSummary + `estimatedFee`·`estimatedSettle`(FeeCalculator 파생, 판매자 전용·추정치). **공개 ShopSummary 무오염**. 실현값은 판매 후 /me/orders.
- **스키마 무변경**(서버 파생·인덱스 `ix_shop_seller_status` 재사용). 취소·FeeCalculator·커서 재사용. 파급 없음(additive read).

## 온디맨드 보안 리뷰 (2026-07-22, 에픽 완료 직전) — 취약점 0건
- shop-manage 델타(3e3eac3·35c4dd8) 스코프. **HIGH/MEDIUM 0건**. IDOR 안전(seller=SecurityContext·Repo seller.id.eq 강제)·인증 강제(401)·DTO 격리(estimatedFee/settle 공개 미유입)·SQLi 없음(QueryDSL·ShopSort 화이트리스트·커서 파싱)·XSS 없음.

## 총괄 브라우저 실측 (2026-07-22)
- 마이페이지 '내 판매' 섹션: demo1(파랑기사) 리스팅 표시·**등록가+예상 정산액**(28.5만→27만 등 수수료 반영)·스킬명·내리기 버튼·마켓 카드 재사용 확인.

## 범위 밖
- 리스팅 수정(가격 변경)·재출품 · 대량 취소 · 판매 통계.
