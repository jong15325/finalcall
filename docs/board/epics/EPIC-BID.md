---
id: EPIC-BID
type: epic
jira_key: KAN-36
title: 입찰 — 동시성 직렬화·게임머니 홀드 에스크로·소프트클로즈 연장
state: doing
children: [FC-030, FC-031, FC-032, FC-033, FC-034, FC-035]
gate: null
---
## 목표
- 입찰(bid) 애그리거트 구축 — `POST /auctions/{id}/bids`·`GET /auctions/{id}/bids` + `money_hold` 게임머니 에스크로 + 소프트클로즈 연장 + 최고가 갱신.
- 계약 §3.1(입찰 2개) + domain-spec §4(입찰 규칙)·§6(홀드)·§8(동시성 D-008) + erd `bid`·`money_hold` 실구현.
- **프로젝트 핵심 기술 도전**: 마감 직전 입찰 폭주 동시성 제어. 동시에 **보안 최고위험 구간**(금전 이동).
- 범위(게이트1 승인 2026-07-18): bid·money_hold 엔티티 + 입찰 API(직렬화·홀드·직전홀드 즉시해제·최고가 갱신·소프트클로즈 연장) + 입찰 내역 조회 + auction 목록/상세의 최고가 실값 대체 + 동시성 테스트.
- 제외(후속): 마감·낙찰·정산·`sale_order`·소유이전(EPIC-CLOSING) · 즉시구매 `/purchase`(EPIC-CLOSING) · 고정가(EPIC-SHOP) · 관리자 강제취소(백로그).

## 분해안 (게이트1 승인 2026-07-18)
- FC-030 architect: 계약 §3.1 `/bids` 검증, bid-domain-spec 확정, 슬라이싱. **게이트2 5건 상신**(직렬화 메커니즘·홀드 원자성 경계·소프트클로즈 연장 규칙·SCHEDULED→ACTIVE 영속 전이·BID_004 판정 근거).
- FC-031 backend-impl: Flyway **V11**(`bid` + `money_hold`) + 엔티티 2종 + 홀드 도메인 로직(생성·해제).
- FC-032 backend-impl: ★ `POST /auctions/{id}/bids` — 경매 단위 직렬화(D-008)·홀드·직전 최고입찰자 홀드 즉시해제(P-008)·최고가 갱신·소프트클로즈 연장. `BID_001~006`.
- FC-033 backend-impl: `GET /auctions/{id}/bids`(offset·마스킹) + auction 목록/상세 최고가 실값 대체(`highestBidAmount`·`bidCount`·`highestBidderMasked` — 현재 null/0 하드코딩).
- FC-034 backend-impl: 동시성 테스트 강화 — 마감 직전 폭주, 홀드 합계 불변식, 연장 경합.
- FC-035 reviewer: 통합 리뷰(동시성·홀드 정합·도메인 인가·QA).

의존/팬아웃: FC-030 → 031 → 032 → 033 → 034 → 035. **전 구간 순차 예상** — V11 단일 채번 + `bid`/`money_hold`/`auction` 엔티티·`AuctionService` 공유로 쓰기 파일 교차(아이템·경매 에픽과 동일 패턴). 최종 판정은 FC-030 architect.
파이프라인: architect → backend-impl → reviewer → Done.

## 보안 층 (최고위험 구간)
- **end-of-turn 보안 리뷰 한시 on**(`ENABLE_STOP_REVIEW=1`, 섹션 13). 훅 `.claude/hooks/stop-security-review.js` 신규 배선(2026-07-18) — 민감경로 변경 시 재프롬프트, warn-only. **에픽 종료 시 `0` 복귀 필수.**
- reviewer(FC-035) 확인소 + 에픽 완료 직전 온디맨드 `/security-review` 1회(상시 규정).
- 중점: 금전 이동(홀드 생성·해제) 원자성, 자기 경매 입찰(BID_003)·연속 입찰(BID_004) 우회, 홀드 이중 해제·미해제, 잔액 음수화, 직렬화 우회.

## 선결 검토(EPIC-AUCTION 보안 리뷰 관찰)
- **에스크로 CAS owner 조건** — `ItemInstanceRepository.markListedIfInInventory`가 location만 조건. 소유권 이전 도입 전까진 미착취이나, FC-030 architect가 EPIC-BID/CLOSING 반영 시점을 판정한다.

로드맵: EPIC-ITEM(done) → EPIC-AUCTION(done) → **EPIC-BID** → EPIC-CLOSING → EPIC-SHOP.
