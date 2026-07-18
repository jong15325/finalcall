---
id: EPIC-AUCTION
type: epic
jira_key: KAN-30
title: 경매 백엔드 — 등록·목록·상세·판매자취소 + FSM
state: done
children: [FC-025, FC-026, FC-027, FC-028, FC-029]
gate: null
---
## 목표
- 경매(Auction) 애그리거트 구축 — 등록·목록·상세·판매자취소 + 상태머신(SCHEDULED/ACTIVE/CANCELLED). EPIC-ITEM의 아이템을 출품 에스크로(LISTED)로 이동.
- 계약 §3.1(입찰·즉시구매 제외) + domain-spec §3·§5(경매 FSM) + erd auction 테이블 실구현.
- 범위(게이트1 승인 2026-07-18): auction 엔티티·FSM·등록·목록·상세·취소 + item INVENTORY↔LISTED 에스크로 전이.
- 제외(후속): 입찰(EPIC-BID) · 즉시구매·마감·정산·주문(EPIC-CLOSING) · 관리자 강제취소(백로그) · 고정가(EPIC-SHOP).

## 분해안 (게이트1 승인 2026-07-18)
- FC-025 architect: 계약 §3.1 검증, auction-domain-spec 확정, 슬라이싱. 게이트2 상신(SCHEDULED→ACTIVE 활성화 방식·상세 최고가 처리·소프트클로즈 config 컬럼·FSM 경계).
- FC-026 backend-impl: auction 엔티티 + status enum(FSM) + 등록 API `POST /auctions`(item LISTED CAS, 검증 AUCTION_001/002/003/008). Flyway V10.
- FC-027 backend-impl: 목록·상세 API `GET /auctions`·`/auctions/{id}`(cursor·item 스냅샷·AUCTION_004).
- FC-028 backend-impl: 판매자 취소 `POST /auctions/{id}/cancel`(입찰0&ACTIVE, LISTED→INVENTORY 만실 temp, AUCTION_006/007).
- FC-029 reviewer: 통합 리뷰(도메인 인가·에스크로 정합·QA).

의존/팬아웃: FC-025 → FC-026 → (FC-027 ∥ FC-028?, architect 판정 — auction 엔티티·Flyway 공유 시 순차) → FC-029.
파이프라인: architect → backend-impl → reviewer → Done.
보안 층 첫 실적용: 도메인 인가(자기 아이템만 출품·판매자 본인만 취소·주체=SecurityContext) reviewer 확인소, 에픽 완료 시 /security-review 1회.
로드맵: EPIC-ITEM(done) → **EPIC-AUCTION(done)** → EPIC-BID → EPIC-CLOSING → EPIC-SHOP.

## 완료 기록 (게이트3, 2026-07-18)
- 하위 FC-025~029 전건 done. Jira KAN-30~35 완료 미러.
- reviewer(FC-029) PASSED — critical 0 · major 0 · minor 8(비차단). `docs/board/reviews/FC-029-review.md`.
- **에픽 완료 온디맨드 `/security-review` 1회 실행 — HIGH/MEDIUM 발견 0건**(보안 층 첫 실적용). 검증 범위: 도메인 인가·IDOR / SecurityConfig permitAll 스코프(GET 한정) / 에스크로 CAS 정합 / QueryDSL 인젝션 / 응답 데이터 노출.
- 기준미달 관찰 3건은 HANDOVER 백로그에 등재(특히 **에스크로 CAS owner 조건** — EPIC-CLOSING 소유권 이전 도입 시 TOCTOU화, 선결 검토 대상).
- 사용자 Done 승인 2026-07-18.
