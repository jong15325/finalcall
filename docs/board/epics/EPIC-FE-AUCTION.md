---
id: EPIC-FE-AUCTION
type: epic
jira_key: KAN-43
title: 경매 프론트 — 목록·상세 화면 (FE-1·FE-2)
state: doing
children: [FC-036, FC-037, FC-038]
gate: null
---
## 목표
- 백엔드 EPIC-AUCTION(done·push)이 낸 경매 API를 소비하는 **첫 경매 화면**을 만든다.
- 현 상태 문제: 프론트 페이지가 5개(Login·Signup·Profile·NotFound·Placeholder)뿐이라 **경매·아이템 화면이 0개**다. 백엔드가 두 에픽(ITEM·AUCTION) 앞서 있다.
- 범위(게이트1 승인 2026-07-18): **FE-1 경매 목록 · FE-2 경매 상세**만. 등록·취소·인벤토리(FE-3~5)는 후속.

## 병렬 판정 (섹션 9)
- **EPIC-BID(backend-impl)와 병렬 실행한다.** 근거: 쓰기 파일 집합 무교차(`frontend/**` vs `backend/**`), 의존 없음(계약 v1.7 확정 + 백엔드 구현 push 완료).
- 부수 효과: EPIC-BID 완료 시 입찰을 붙일 화면이 **이미 존재**하게 된다.

## 디자인 게이트 (승인 2026-07-18)
- **새 디자인 없음.** `docs/ux/design-system.md`(U-021 확정본)가 필요한 컴포넌트를 이미 규정 — §5.3 ItemCard · §5.4 ListGrid+SearchFilterBar · §5.7 Pagination(cursor) · §5.8 StatusChip · §5.9 Countdown · §5.10 MoneyAmount. **집행이지 창작이 아니다.**
- **경매 전용 별도 톤을 만들지 않는다**(총괄 초안 철회). §5.9 Countdown의 임박 단계 색 전이(여유→T-5분 warning→T-30초 danger)가 이미 긴장감을 설계했고, 톤을 더 얹으면 §1.2 3계층 규칙이 깨진다.
- **승인된 결정 2건**:
  1. **게임 아트 = 플레이스홀더로 진행.** `docs/game_ui/item_info/card_image/`에 7개 카테고리 자산이 있으나 백엔드 시드 typeCode가 `SEEDITEM` 하나뿐이라 매핑할 짝이 없다. §5.3이 "자산 부재 시 플레이스홀더"를 이미 허용. EPIC-ITEM 시드 확장 시 자연 교체(화면 구조 무변경).
  2. **필터 = 정렬 + 핵심 4종만**(정렬 마감임박·최고가·최신 / status / minPrice·maxPrice / element). §5.4 전체 필터는 구조만 잡아두고 후속에 붙인다 — 시드가 빈약해 대부분의 필터가 빈 결과를 낸다.
- 계승 원칙: CTA 블랙·퍼플은 액센트만 / **Game-Color Containment**(element 색은 아이템 카드·속성 배지·필터 칩 밖 사용 금지) / 등급 배지 폐기(D-073).

## 계약 주의
- **최고가는 현재 전건 null/0**이다(입찰=EPIC-BID 미구현). `auction-domain-spec §9-b` 확정대로 **"입찰 없음 · 시작가 N"**으로 정직하게 표시한다. `startPrice`를 현재가인 양 보여주지 않는다.
- EPIC-BID 완료 시 `highestBidAmount`·`bidCount`·`highestBidderMasked`가 **계약·스키마 무변경으로 실값 대체**된다 → 프론트는 null 분기만 유지하면 자동 전환된다.

로드맵: EPIC-FE-MEMBER(done) → **EPIC-FE-AUCTION** → FE-3~5(인벤토리·등록·취소) → 입찰 UI(EPIC-BID 후속).
