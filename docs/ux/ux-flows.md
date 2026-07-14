# FinalCall UX 플로우 · 화면 맵 (ux-flows.md)

상태: DRAFT v0.1 — 디자인 초안. 계약 v1.2 기준. 목록/상세 응답 스키마는 계약 §3.3로 확정(공백 해소).
소유: 디자인(UX/UI)
근거: api-contract v1.2(최상위 — 라우트·엔드포인트·§3.3 응답 스키마·등급 제거 D-073), domain-spec §3~§9, frontend/notes/screen-route-map.md(미확정 참고 — 프론트 노트), design-guide 5·11절
기준: 계약이 최상위. 계약에 없는 화면·데이터는 가정하지 않는다(공백은 6절에 결정 요청 대상으로 표기). 상류 조율은 프론트 기획(PF, D-077).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-14 | 화면 맵(라우트↔엔드포인트) + 핵심 플로우(목록→상세→입찰/즉시구매·고정가·충전→교환·판매등록·인증) + 상태·엣지·와이어프레임 기술 |
| v0.1 | 2026-07-14 | 계약 v1.2 정합 — 등급 필터·표시 제거(D-073), 카드/상세를 §3.3 응답 스키마 필드로 정합, §6 공백 해소(응답 스키마 확정) |

프론트 정합: frontend/notes/screen-route-map.md의 라우트·feature와 1:1 대응하도록 설계했다(그 노트는 유형4 초안이라 근거로 인용하지 않고, 계약을 공통 근거로 삼아 동일 결론에 도달). 불일치 발견 시 조인트 리뷰로 조정(design-guide 7절).

---

## 1. 화면 맵 (라우트 ↔ 화면 ↔ 계약 엔드포인트)

공개(인증 불요):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| /login · /signup | 로그인·회원가입 | POST /auth/login · /auth/signup |
| / | 홈(경매·고정가 통합 피드) | GET /auctions, GET /shops |
| /auctions · /auctions/:id | 경매 목록 · 상세(입찰·즉시구매) | GET /auctions, GET /auctions/{id}, GET/POST /auctions/{id}/bids, POST /auctions/{id}/purchase, POST /auctions/{id}/cancel |
| /shops · /shops/:id | 고정가 목록 · 상세(구매) | GET /shops, GET /shops/{id}, POST /shops/{id}/purchase, POST /shops/{id}/cancel |
| /items/:id | 아이템 인스턴스 상세 | GET /items/{id} |
| /market-prices | 시세 조회 | GET /market-prices (+ GET /item-templates 필터 메타) |

인증 필요(me 주체):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| /sell | 판매 등록(경매/고정가) | POST /auctions · POST /shops (+ GET /me/inventory 아이템 선택) |
| /me/inventory | 정규 인벤토리(96칸) | GET /me/inventory, POST /me/temp-storage/{id}/relocate |
| /me/temp-storage | 임시보관(오버플로우) | GET /me/temp-storage |
| /me/orders · /me/orders/:id | 거래 내역 · 주문 상세 | GET /me/orders, GET /orders/{id} |
| /me/wallet | 지갑(잔액·충전·교환·내역) | GET /me/balance, POST /charges, GET /me/charges, POST /exchanges |
| /me/wallet/charge/confirm | 토스 결제 승인 콜백 | POST /charges/confirm |

관리자:

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| /admin/auctions/:id | 관리자 강제 취소 | POST /admin/auctions/{id}/force-cancel |

주: 판매자 취소는 상세 화면 내 액션으로 흡수(별도 라우트 없음). 즉시구매(purchase)는 경매 상세에 소속.

공통 레이아웃: 상단 앱바(로고·검색·지갑 잔액 요약·프로필/로그인) + 콘텐츠 + (모바일)하단 탭. 인증 상태에 따라 앱바 우측(로그인 버튼 ↔ 잔액·프로필) 분기. 잔액 요약(gameMoneyAvailable)은 앱바에 상시 노출 — 입찰·구매 시 즉시 확인.

---

## 2. 핵심 플로우: 경매 목록 → 상세 → 입찰

### 2.1 경매 목록 (/auctions)

- 와이어프레임(영역): [상단] SearchFilterBar(공통 필터 §3) + 정렬 셀렉트(화이트리스트) · [본문] ItemCard 반응형 그리드(1→2→3→4열) · [하단] cursor 무한스크롤 센티넬 + "더 보기" 폴백.
- 카드 표시(§3.3 AuctionSummary): 아이템명(nameSnapshot)·ElementBadge(element)·레벨(level)/스킬(skill1·2·skillPercent) 요약·골드포스 잔여(있으면)·현재 최고가(highestBidAmount 또는 startPrice, font-num)·입찰수(bidCount)·Countdown(endAt)·판매유형 칩(buyNowPrice 유무)·판매자(sellerNickname). 등급 없음(D-073).
- 상태: 로딩(스켈레톤 카드) · 빈("조건에 맞는 경매가 없습니다" + 필터 초기화 CTA) · 에러(재시도 버튼).
- 엣지: 목록 중 마감된 항목은 상세 진입 시 종료 처리로 흡수(목록 캐시와 실제 상태 불일치 허용 — 상세에서 확정).

### 2.2 경매 상세 (/auctions/:id)

- 와이어프레임(§3.3 AuctionDetail): [좌·상] 아이템 스냅샷(이미지·nameSnapshot·Element·레벨·스킬1/2·skillPercent·골드포스 잔여·specSnapshot) · [우·상] 거래 패널(현재 최고가·최고입찰자 마스킹(highestBidderMasked)·Countdown·연장횟수(extensionCount)·입찰 입력·입찰 버튼·즉시구매 버튼(buyNowPrice 설정 시)) · [하] 입찰 내역(offset 페이지, 마스킹) · 판매자 본인이면 취소 액션. 등급 없음(D-073).
- 실시간(U-006 폴링): 상세 진입 시 refetchInterval로 최고가·endAt·status 폴링. 소프트클로즈로 endAt 연장되면 Countdown 즉시 반영. 종료(status≠ACTIVE) 감지 시 폴링 중지·거래 패널을 결과 표시로 전환.
- 상태: 로딩·에러(AUCTION_004 없음→404 화면)·종료(SOLD/UNSOLD/CANCELLED 배지 + 결과).

### 2.3 입찰 액션 (POST /auctions/{id}/bids)

- 진입: 상세 거래 패널에서 금액 입력(NumberInput, 최소 증분 힌트 표시) → 입찰 버튼(accent) → 확인 모달(금액·홀드 안내) → 제출(loading, 중복 차단).
- 성공(201): 토스트 "입찰 성공" + 최고가·잔액·입찰내역 쿼리 무효화. 낙관적 표시 후 서버 확정 반영.
- 엣지/에러(계약 §3 코드 → 사용자 카피):
  - BID_001 최소 증분 미달 → 필드 에러 "현재가 기준 최소 입찰가는 N입니다".
  - BID_002 buyNowPrice 이상 → "즉시구매가 이상은 입찰할 수 없습니다. 즉시구매를 이용하세요".
  - BID_003 자기 경매 입찰 → "본인 경매에는 입찰할 수 없습니다"(버튼 사전 비활성 + 서버 방어).
  - BID_004 연속 입찰(현재 최고가 보유자) → "이미 최고 입찰자입니다".
  - BID_005 잔액 부족 → "게임머니가 부족합니다" + 지갑/충전 링크.
  - BID_006 마감/종료 → "마감되었습니다" + 상세 결과로 전환.
- 상위 입찰에 밀림(폴링 감지): 토스트 "상위 입찰이 발생했습니다"(holds 즉시 해제는 서버 처리, 잔액 쿼리 무효화로 반영).

---

## 3. 즉시구매 · 고정가 구매 플로우

### 3.1 즉시구매 (POST /auctions/{id}/purchase)

- 진입: 상세의 즉시구매 버튼(accent lg, buyNowPrice 설정 시만 노출) → 확인 모달(최종가·차감 안내) → 제출.
- 성공(201): orderPublicId·finalPrice → "구매 완료" 토스트 + 주문 상세(/me/orders/:id) 이동 안내. 경매 상태 SOLD(BUYNOW) 반영.
- 에러: AUCTION_005 미설정(버튼 미노출로 예방)·AUCTION_006 이미 종료(409, 결과 전환)·AUCTION_009 판매자 자기구매(403, 버튼 비활성)·BID_005 잔액 부족.

### 3.2 고정가 구매 (POST /shops/{id}/purchase)

- 목록/상세는 경매와 동형(입찰·카운트다운 없음, endAt 있으면 만료 표시). 구매 버튼(accent) → 확인 모달 → 제출.
- 성공(201): 주문 생성. 에러: SHOP_004 이미 판매/종료(409)·SHOP_005 잔액 부족·SHOP_006 자기구매.
- 동시성(domain §8): 원자적 선점 단일 승자 — 경합 패배자는 SHOP_004로 "이미 판매되었습니다" 안내(중복 구매 방지 UX).

---

## 4. 충전 → 교환 → 거래 (지갑, /me/wallet)

거래는 게임머니로만 이뤄지므로 첫 거래 전 캐시 충전 + 게임머니 교환이 선행된다. 이 여정을 지갑에서 단계로 안내한다.

- 잔액(GET /me/balance): 캐시·게임머니(가용/홀드) 카드로 표시. 홀드=입찰 잠금 안내 툴팁.
- 충전(POST /charges → 토스 결제창 → /me/wallet/charge/confirm → POST /charges/confirm):
  - 금액 입력 → 충전 시작(READY) → 토스 결제 위젯(클라이언트) → 콜백 라우트에서 confirm 호출.
  - 서버 검증·멱등(SEC-001·002): 성공 200 "충전 완료"·잔액 갱신. 중복 승인은 멱등 no-op(사용자엔 완료로 동일 표시). 에러 CHARGE_001·002·003 각 카피.
- 교환(POST /exchanges, Idempotency-Key 필수): 방향 CASH_TO_GAME + cashAmount → 적용 비율·게임머니 표시. 비율 ON-HOLD(스텁) 안내. 에러 EXC_001 캐시 부족·EXC_002 역방향 미지원(역방향 UI 미제공).
- 안내 배너: 게임머니 0이고 거래 시도 시 "게임머니가 필요합니다 → 충전·교환" 딥링크(BID_005·SHOP_005 진입점과 연결).

---

## 5. 판매 등록 · 인벤토리 · 인증 (요약)

- 판매 등록(/sell): 인벤토리에서 아이템 선택(GET /me/inventory) → 판매 방식 선택(경매/고정가) → 방식별 폼(경매: startPrice·buyNowPrice?·startAt?·endAt·softClose·maxEndAt / 고정가: price·endAt?) → 등록. 서버 검증(AUCTION_003 buyNow≤start, AUCTION_008 시간 위반, 002 이미 출품중)→ 필드 에러. 등록 성공 시 해당 상세로 이동.
- 인벤토리(/me/inventory 96칸 + /me/temp-storage 오버플로우): 슬롯 그리드, 임시보관→정규 relocate(INV_001 만실·INV_002 슬롯 점유 에러). 출품 중 아이템은 LISTED 상태 표시(에스크로).
- 거래 내역(/me/orders): BUYER/SELLER·AUCTION/SHOP 필터, cursor. 주문 상세는 당사자만(ORDER_002).
- 인증(/login·/signup): 로그인 성공 시 accessToken·refreshToken 저장(Zustand 세션), 만료 시 자동 refresh(회전, AUTH_004 시 재로그인 유도). 로그아웃은 refresh 무효화.

각 화면 공통: 로딩(스켈레톤)·빈 상태(안내 + 주요 CTA)·에러(계약 코드 매핑 + 재시도) 3종을 반드시 설계한다. 빈/에러 카피는 사용자 언어(원인+다음 행동)로 작성.

---

## 6. 계약 공백 · 확인 대상 (임의 가정 금지)

디자인이 화면을 그리며 발견한, 계약이 명시하지 않아 확정이 필요한 항목. 임의 확정하지 않고 확인 대상으로 남긴다(design-guide 1·11절 — 상류 조율은 프론트 기획 PF).

1. (해소) 목록/상세 응답 필드 스키마 — 계약 §3.3(v1.2)로 확정. 카드·상세를 §3.3 필드에 정합함(2.1·2.2·3절).
2. (해소) 아이템 등급(grade) — D-073으로 축 제거. grade 색 매핑 폐기(U-004 SUPERSEDED→U-010). 시각 축은 속성/레벨/골드포스/스킬.
3. 실시간 채널 — 푸시(SSE/WS) 부재로 폴링 전제(U-006, F-001 정합). 채널 도입 여부는 총괄 결정 사항(프론트와 중복 발제 회피, 정보 공유로 정합만 확인).
4. 홈 통합 피드의 경매·고정가 혼합 표시 규칙(정렬·구분) — 계약에 통합 피드 스펙 없음. 탭 분리로 잠정 설계, 통합 노출 규칙 필요 시 프론트 기획(PF) 정합 후 필요 시 결정 요청.
