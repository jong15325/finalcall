# FinalCall 화면 명세·정보구조 (screen-spec.md)

상태: DRAFT v0 — 프론트 기획 IA 기준선. 계약 v1.2 기준. (053 총괄 회신) PF-001로 IA 기준선은 선채택됐으나, 이 문서는 라우트·엔드포인트·데이터 매핑의 정보구조 기준선이지 비주얼 확정본이 아니다. 화면 비주얼·핵심 UX 최종은 총괄+사용자(D-072).
소유: 프론트 기획 (PF)
근거: api-contract v1.2(최상위 — 라우트·엔드포인트·응답 스키마), domain-spec v0.4(도메인 규칙), D-073(등급 축 제거), D-077(PF 신설), 053(총괄 회신 — 안건 1·2 (a) 채택)
기준: 계약이 최상위. 계약에 없는 화면·데이터는 가정하지 않고 5절 공백으로 표기한다.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-14 | 계약 v1.2 기준 IA 베이스라인 — 라우트↔화면↔엔드포인트, 도메인 feature 클라이언트 관점, v1.1→v1.2 델타 영향, 잔여 공백 |

정합 관계: 디자인 ux-flows.md·프론트 screen-route-map.md와 라우트·feature가 1:1 대응하도록 설계했다. 단 두 문서는 v1.1 기준이라 grade 잔존·응답 스키마 공백이 남아 있어(6절), 본 명세가 v1.2 정합 기준선이다.

---

## 1. 정보구조(IA) 개요

세 접근 영역으로 나눈다.

- 공개(인증 불요): 홈·경매/고정가 목록·상세·아이템·시세. 탐색·조회는 로그인 없이 가능(계약 §3 GET·§4.1).
- 인증(`me` 주체): 판매 등록·인벤토리·거래 내역·지갑(충전·교환). SecurityContext 기준(계약 §1.2·§4).
- 관리자: 강제 취소(계약 §4.5).

클라이언트 도메인(feature)은 계약 리소스 축과 domain-spec 애그리거트에 맞춰 9개로 둔다: auth · auction · bid · shop · item · inventory · order · wallet · admin. (프론트 CLAUDE.md 3절 feature 기반 구조와 정합)

---

## 2. 라우트 ↔ 화면 ↔ 엔드포인트 (v1.2)

공개(인증 불요):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/login` · `/signup` | 로그인·회원가입 | POST /auth/login · /auth/signup |
| `/` | 홈(경매·고정가 통합 피드, 탭 잠정) | GET /auctions, GET /shops |
| `/auctions` | 경매 목록(공통 필터·정렬·cursor) | GET /auctions |
| `/auctions/:auctionPublicId` | 경매 상세(입찰·즉시구매·판매자취소) | GET /auctions/{id}, GET/POST /auctions/{id}/bids, POST /auctions/{id}/purchase, POST /auctions/{id}/cancel |
| `/shops` | 고정가 목록 | GET /shops |
| `/shops/:shopPublicId` | 고정가 상세(구매·판매자취소) | GET /shops/{id}, POST /shops/{id}/purchase, POST /shops/{id}/cancel |
| `/items/:itemInstancePublicId` | 아이템 인스턴스 상세 | GET /items/{id} |
| `/market-prices` | 시세 조회 | GET /market-prices (+ GET /item-templates 필터 메타) |

인증 필요(`me` 주체):

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/sell` | 판매 등록(경매/고정가 선택) | POST /auctions · POST /shops (+ GET /me/inventory 아이템 선택) |
| `/me/inventory` | 정규 인벤토리(96칸) | GET /me/inventory, POST /me/temp-storage/{id}/relocate |
| `/me/temp-storage` | 임시보관(오버플로우) | GET /me/temp-storage |
| `/me/orders` · `/me/orders/:orderPublicId` | 거래 내역 · 주문 상세 | GET /me/orders, GET /orders/{id} |
| `/me/wallet` | 지갑(잔액·충전·교환·충전내역) | GET /me/balance, POST /charges, GET /me/charges, POST /exchanges |
| `/me/wallet/charge/confirm` | 토스 결제 승인 콜백 | POST /charges/confirm |

관리자:

| 라우트 | 화면 | 계약 엔드포인트 |
|---|---|---|
| `/admin/auctions/:auctionPublicId` | 관리자 강제 취소 | POST /admin/auctions/{id}/force-cancel |

주: 판매자 취소는 상세 화면 내 액션으로 흡수(별도 라우트 없음). 즉시구매(purchase)는 경매 상세 소속. 외부 식별자는 public_id(ULID), item_template은 typeCode(계약 §1.1).

---

## 3. 도메인 feature 클라이언트 관점

각 feature = 주요 화면 · 표시 데이터(계약 응답) · 주요 액션 · 에러 분기.

### 3.1 auth
- 화면: 로그인·회원가입. 세션(accessToken·accessExpiresAt·refreshToken)은 전역(Zustand).
- 액션: signup(201 userPublicId·nickname) / login(200 토큰 3종) / refresh(회전된 refreshToken 포함, 만료 시 자동) / logout(204, refresh 무효화).
- 에러: AUTH_001·002 중복(409), AUTH_003 자격 불일치(401), AUTH_004 refresh 만료·무효·재사용(401→재로그인 유도).

### 3.2 auction
- 목록: AuctionSummary 카드 그리드 + 공통 필터 + 정렬 화이트리스트(`price·endAt·createdAt·highestBidAmount`), cursor 무한스크롤.
- 상세: AuctionDetail — 아이템 스냅샷 + 현재 최고가·최고입찰자(마스킹)·남은 시간(endAt)·extensionCount·maxEndAt. 실시간은 폴링(F-001).
- 액션: 등록(POST /auctions) / 판매자취소(입찰 0건 & ACTIVE, AUCTION_007) / 즉시구매(BUYNOW). 상태 SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED.
- 에러: AUCTION_001~009(등록·시간 파라미터·자기구매 등).

### 3.3 bid (경매 상세에 중첩)
- 화면: 입찰 입력(최소 증분 힌트)·입찰 버튼·입찰 내역(offset, 마스킹).
- 액션: POST /auctions/{id}/bids → 201 currentHighestAmount·endAt. 상위 입찰 밀림은 폴링 감지 + 잔액 쿼리 무효화(홀드 즉시 해제는 서버).
- 에러: BID_001 증분 미달 / BID_002 buyNow 이상 / BID_003 자기 경매 / BID_004 연속 입찰 / BID_005 잔액 부족 / BID_006 마감.

### 3.4 shop (고정가)
- 목록/상세: ShopSummary/Detail. 경매와 동형이나 입찰·카운트다운 없음, endAt 있으면 만료(EXPIRED) 표시.
- 액션: 등록(POST /shops) / 구매(원자적 선점 단일 승자) / 판매자취소(ACTIVE만).
- 에러: SHOP_001~006(자기구매 006, 이미 판매 004, 잔액 005).

### 3.5 item
- 아이템 인스턴스 상세(GET /items/{id}): 템플릿·레벨·스킬1/2·발동확률·골드포스 만료·현재 위치·소유자(마스킹).
- 시세(GET /market-prices): 집계 키 (typeCode, level, skill1, skill2). 골드포스는 집계 제외·필터로만(D-066).
- 카탈로그(GET /item-templates): 검색 필터 UI 메타(offset).

### 3.6 inventory
- 정규 인벤토리(96칸): capacity·used·slot 그리드. 출품 중은 LISTED(에스크로) 표시.
- 임시보관(오버플로우, cursor) → relocate(TEMP→INVENTORY). 에러 INV_001 만실 / INV_002 슬롯 점유 / ITEM_002 소유자 아님.

### 3.7 order
- 거래 내역(GET /me/orders): role=BUYER|SELLER, sourceType=AUCTION|SHOP 필터, cursor.
- 주문 상세(GET /orders/{id}): 당사자만(ORDER_002). 출처·아이템·최종가·수수료·정산액·상태.

### 3.8 wallet
- 잔액(GET /me/balance): cashBalance·gameMoneyBalance·gameMoneyHeld·gameMoneyAvailable(held=홀드/available=가용 구분 표시).
- 충전: POST /charges(READY) → 토스 결제창(클라이언트) → 콜백 라우트 → POST /charges/confirm(서버 재검증·pg_tx_id 멱등, SEC-001·002). 중복 승인은 멱등 no-op. 에러 CHARGE_001~003.
- 교환: POST /exchanges + `Idempotency-Key` 필수(SEC-004). direction=CASH_TO_GAME. 비율 ON-HOLD(스텁 표기). 역방향 미지원(EXC_002), 잔액 부족(EXC_001).

### 3.9 admin
- 강제 취소(POST /admin/auctions/{id}/force-cancel): 상태 무관 CANCELLED, 홀드·에스크로 전량 해제. 권한 AUTH_005(403).

공통(전 화면): 로딩(스켈레톤)·빈 상태(안내+CTA)·에러(계약 §5 ErrorCode 1:1 매핑) 3종 필수. 시간은 서버 Instant(UTC) 수신 그대로 보관·표시 시점 로컬 변환(프론트 CLAUDE.md 5절).

---

## 4. v1.1 → v1.2 델타가 화면에 미치는 영향 (핵심)

디자인·프론트 산출물이 아직 v1.1 기준이라, 아래 두 변경이 화면에 미반영이다. 본 명세는 v1.2로 반영했다.

### 4.1 등급(grade) 축 제거 (D-073, 계약 §3·§3.3)
- 공통 필터에서 grade 제거: 유효 축은 `mainCategory, subGroup, element, kind, minLevel/maxLevel, skill1/skill2, goldforceActive, minPrice/maxPrice, status`. (계약 §3 "등급 필터 없음")
- 응답 item 블록에 grade 없음: `{ typeCode, mainCategory, subGroup, element, kind, level, skill1?, skill2?, skillPercent, goldforceExpireAt?, nameSnapshot, specSnapshot }` (계약 §3.3).
- 화면 영향: ItemCard·상세·SearchFilterBar에서 GradeBadge·grade 색·grade 필터 삭제. 아이템 정체성 시각 축 = 종류(kind)×속성(element)+레벨. ElementBadge는 유지(element 4종).

### 4.2 목록/상세 응답 스키마 구체화 (계약 §3.3)
- 기존 v1.1에서 "요약/스냅샷 수준"으로만 기술돼 디자인 ux-flows §6-1·프론트 note §6이 열어둔 "응답 필드 스키마 공백"은 v1.2 §3.3에서 AuctionSummary/AuctionDetail·ShopSummary/ShopDetail·item 블록으로 구체화되어 해소됐다.
- 화면 영향: 카드·상세에 표시할 필드가 계약으로 확정 → 표시 매핑을 확정값으로 고정(추정 불필요). 소유자·최고입찰자 마스킹, 골드포스는 만료시각만 제공(활성/잔여는 클라 파생).

---

## 5. 계약 정합 상태 · 잔여 공백

해소됨(v1.2로 확정):
- 목록/상세 응답 필드 스키마(§3.3) — 확정.
- 등급 축(D-073) — 제거 확정.

남은 공백(임의 가정 금지 — 결정 요청/확인 대상):
1. 홈 통합 피드 표시 규칙(경매·고정가 혼합 정렬·구분) — 계약에 통합 피드 스펙 없음. 탭 분리로 잠정, 통합 노출 필요 시 결정 요청.
2. 실시간 채널(SSE/WS) 부재 — 폴링(F-001) 전제. 도입 여부는 총괄 결정(프론트 outbox/001 안건과 정합).
3. 교환 비율 — ON-HOLD(스텁). 확정 전 UI는 "적용 비율" 응답값 표시로 대응(계약 §4.4 appliedRate).

---

## 6. 디자인·프론트 정합 액션 (라우팅)

본 명세로 발견한 정합 이슈. 타 역할 소유 문서라 직접 수정하지 않고 총괄 격상·정보 공유로 처리(PF-002).

- 디자인(U): design-system §2.3 grade 토큰·GradeBadge·U-004(grade 색) — grade 제거 정합 필요. U-004는 SUPERSEDE 후보(U 소유 판단). 디자인 inbox-log가 "등급 확정 대기"로 멈춰 있으나, 등급은 확정이 아니라 제거됨(D-073) — 이 점 전달 필요.
- 프론트(F): screen-route-map §4 공통 필터의 grade 잔존, 헤더 근거 v1.1 → v1.2 정합 필요. §6의 "응답 스키마 공백"·"templates §18 부재"는 각각 §3.3·현행 templates §18로 해소됨.
- 처리: 총괄에 완료 보고 + grade 정합 전파 방식 결정 요청(outbox/001). 전파는 총괄 시퀀싱(D-074) 하에.
