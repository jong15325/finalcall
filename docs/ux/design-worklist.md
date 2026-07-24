# 디자인 작업 리스트 (design-worklist)

작성: 총괄 · 2026-07-23 · 목적: **남은 화면 시각 디자인(정적 HTML 템플릿) 작업을 다른 곳에서 이어서 진행**하기 위한 자체완결 문서.
이 문서만 있으면 대화 맥락 없이도 무엇을·어떤 순서로·어떤 규약으로 디자인할지 알 수 있다.

---

## 0. 이게 무슨 작업인가 (한 문단)

**디자인 = `docs/ux/mockups/template-*.html` 정적 HTML 템플릿을 그리는 일.** 파일 1개 = 페이지 1개.
브라우저로 바로 열어 판단하는 **시각 디자인의 기록**이며, 확정되면 frontend-impl(React)이 이를 집행한다.
React 구현이 아니다. **여러 화면이 이미 React로 기능은 돌지만 시각 디자인 템플릿이 없는 상태**다
("문서 준수 ≠ 디자인 완성", EPIC-DESIGN-TEMPLATE 교훈). 이 작업은 그 빈 시각 디자인을 채운다.

**정본 토큰**: `docs/ux/design-system.md` v0.6.1 — 라이트 커머스(무신사·컬리 감각 참조, 값 미복제) ·
블랙 CTA(`ink #18181B`) · 퍼플은 액센트만(`#6E2A9F`, 링크·포커스·선택) · WCAG 2.1 AA.
**브랜드**: 서비스명 **장터**, 팔레트 네이비 `#16213a`·골드·오렌지 `#ef8a2c`, 로고 `docs/game_ui/common/logo*.png`.

---

## 1. 완료된 템플릿 6면 (참조 정본 — 새 화면은 이 언어를 계승)

| 화면 | 파일 | 티켓 | 이 파일이 확정한 것 |
|---|---|---|---|
| 홈 (로그인 전) | `template-home-logged-out.html` | FC-041 | 공통 셸(헤더 2행·푸터·브랜드)·톤 |
| 홈 (로그인 후) | `template-home-logged-in.html` | FC-041 | 로그인 상태 셸 |
| 경매 목록 | `template-auction-list.html` | FC-042 | 카드 그리드·좌측 필터 레일/모바일 시트·카운트다운 칩·가격 3중 신호 |
| 경매 상세·입찰 | `template-auction-detail.html` | FC-042 | 상세 레이아웃·입찰 시트 |
| 로그인 | `template-auth-login.html` | FC-043 | 인증 셸·OAuth 자리·모바일 키보드 대응 |
| 회원가입 | `template-auth-signup.html` | FC-043 | 가입 폼·클라 검증 |

> EPIC-DESIGN-TEMPLATE(KAN-49)은 이 6면으로 **종료(done, 2026-07-19)**됐다. 당시엔 "나머지 12면은
> 안 만든다"였으나(목업이 낡는 문제), **그 이후 백엔드가 실기능을 다수 출시**해 아래 화면들이 실디자인
> 대상으로 승격됐다(2절 참조). 이 문서는 그 결정을 갱신한다.

---

## 2. 남은 디자인 리스트

배경: EPIC-DESIGN-TEMPLATE 종료(2026-07-19) 이후 백엔드가 **고정가 마켓(EPIC-SHOP)·검색(EPIC-SEARCH)·
내 판매(EPIC-SHOP-MANAGE)·스킬명(EPIC-MARKET-DATA)**을 출시. 예전 "준비 중 자리"가 대부분 **실기능**이 됐다.

### A. 실기능 확보됨 → 실디자인 필요 (우선순위 높음)

| # | 화면 | 라우트 | 백엔드 근거 | React 현황 | 디자인 포인트 |
|---|---|---|---|---|---|
| 1 | **고정가 마켓 목록** | `/market` | EPIC-SHOP·SEARCH done | 구현됨(MarketPage) | 검색바 결과·빈상태·필터. 경매 목록 카드 언어 통일 |
| 2 | **마켓 상세·구매** | `/market/:id` | EPIC-SHOP done | 구현됨(MarketDetailPage) | 즉시구매 확정 UX(경매 입찰과 다름) |
| 3 | **판매 등록** | `/sell` | POST /auctions + 고정가 등록 | 구현됨(SellPage) | 경매/고정가 방식 선택·수수료 안내 |
| 4 | **마이페이지 통합** | `/me` | GET /me·balance + 내 판매 | 구현됨(MePage) | 프로필·설정·**내 판매(내리기)**·요약 |
| 5 | **거래 내역** | `/orders` | OrderController + `/me/orders` done | 구현됨(OrdersPage, 실 API) | 구매/판매 출처 필터·정산 표기 |
| 6 | **인벤토리** | `/me/inventory` | GET /me/inventory + FC-102 폴리시 | 구현됨(InventoryPage) | 슬롯 72px·hover 확대·반응형 6/3/2 (실측 확정값 반영) |
| 7 | **보유 아이템 상세** | `/items/:id` | GET /items/{id} + 스킬명 | 구현됨(ItemDetailPage) | 스킬 이름/효과 노출(EPIC-MARKET-DATA) |
| 8 | **지갑** | `/me/wallet` | GET /me/balance + 교환 | 구현됨(WalletPage) | 잔액·코드 교환 |
| 9 | **아이템 비교** | `/compare` | 클라 sessionStorage | 구현됨(ComparePage) | 경매 아이템 비교표(스킬 행은 코드 중립표기) |
| 10 | **임시 보관함** | `/me/temp-storage` | GET /me/temp-storage | 구현됨(TempStoragePage) | 재배치 액션 |

### B. 준비 중 자리 — "빈상태/비활성" 디자인만 (404 방지)

| # | 화면 | 라우트 | 상태 | 처리 |
|---|---|---|---|---|
| 11 | 코드 충전 | `/wallet/charge` | Toss 미구현 | "준비 중" 안내·충전 버튼 `disabled` |
| 12 | 커뮤니티 | `/community` | CRUD 미구현(Notice=읽기전용 참조) | 목록 자리만·글쓰기 비활성 |
| 13 | 본인 인증·알림·OAuth 자리 | `/me`·상단 벨·로그인/가입 | 백엔드 없음 | 표시/비활성만(발송·확인 `disabled`, 알림 빈 드롭다운) |

### C. 보조 화면

| # | 화면 | 비고 |
|---|---|---|
| 14 | 404 / 에러 | 셸 확정됨 → 소규모 |

---

## 3. 권장 진행 순서

1. **1·2 마켓** (목록→상세) — 경매 목록 템플릿(FC-042)의 카드·검색·필터 언어를 최대 재사용하면서 신기능이라 임팩트 큼.
2. **3 판매 등록** — 마켓/경매 등록 진입점.
3. **4~8 마이 영역** (마이페이지→거래내역→인벤토리→아이템 상세→지갑) — 로그인 후 핵심 동선.
4. **9·10** (비교·보관함).
5. **B그룹** (자리 화면) — 마지막. 실화면 톤 확정 후 빈상태만.

---

## 4. 모든 템플릿이 지켜야 할 규약 (필수)

1. **자체완결 정적 HTML.** 외부 CDN·웹폰트 없음. 게임 아트만 상대경로 `../../game_ui/**` 참조.
2. **토큰 창작 금지.** design-system.md v0.6.1 실값을 그대로 쓴다(완료 6면 상단 `:root` 블록 복사).
3. **Game-Color Containment.** element 4색(`--el-water/fire/earth/wind`)·검정 아트 슬롯은 **아이템 카드·속성 배지·아이템 필터 칩에만**. 버튼·탭·인풋·크롬·배경·내비에 게임색 금지.
4. **블랙 CTA · 퍼플 액센트.** 주 액션은 `ink` 블랙, 퍼플은 링크·포커스·선택 상태에만.
5. **반응형은 웹/모바일 별도 설계.** 배치만 리플로우하지 말고 각각 IA를 설계한다(모바일은 핵심 액션 동시 노출). → 화면당 실작업량 2배로 산정.
6. **아이템 아트 규격.** 카드 캔버스 72×134px·정수배 확대·`image-rendering: pixelated`·크로마키(모서리 파랑 방지). 레벨 1~9만 존재, 범위 밖 플레이스홀더.
7. **404 나는 화면 금지.** 미구현 기능은 비활성 `disabled`/`aria-disabled`(클래스만 X — 보조기술 노출 위험).
8. **금액 표기.** 탐색=축약(`248만`)·거래확정=정수 원본(`10,001`)·aria-label=항상 전체값. 텍스트 단위(G/C/골드) 금지, 아이콘 `code.png`.

---

## 5. 착수 전 확정 필요 (열린 결정)

1. **디자인 방식** — ✅ **2026-07-24 사용자 확정: HTML 목업 먼저(본 문서 계획 유지).**
   코덱스가 선언한 "정본 = 실 `frontend/` 구현, `template-*.html` 폐기, 목업 없이 바로 실화면 수정"은 **거부됨**.
   남은 화면은 **목업 선제작 → 승인 → 실구현** 순서를 따른다. (예외: 마켓 카드·인벤토리 2면은 코덱스가 이미
   실구현·커밋 = EPIC-FE-CARDFLIP, reviewer changes-requested 재작업 중.)
   - **목업 SOURCE**(하위 미결) — (a) 우리 `template-*.html` 이어서 / (b) 가져온 장터/Vuexy 목업 기준.
     [[mockup-fidelity-only-fix]](2026-07-21: 가져온 목업이 정본, 우리 판단 배제)와 정합. 화면 착수 시 판단.
2. **범위** — A그룹 10면 전부인지, 마켓 계열(1~3)부터 좁게인지.
3. **마스킹 미결**(승계) — `sellerNickname` 원문 노출 vs 마스킹. `isSeller` 판정이 여기 의존. 판매/상세 화면 착수 시 영향(`rebuild-contract-map §8`).

---

## 참조 문서

- `docs/ux/design-system.md` (v0.6.1) — 토큰·컴포넌트 정본
- `docs/ux/mockups/template-*.html` — 완료 6면(계승 대상)
- `docs/ux/rebuild-contract-map.md` — 목업↔계약 정합표(폴백/드롭 규칙)
- `docs/ux/decision-log.md` (U-001~U-021) — 디자인 결정 이력
- `docs/board/epics/EPIC-DESIGN-TEMPLATE.md` — 템플릿 에픽 종료 기록·교훈
- `docs/spec/api-contract.md` · `erd.md` — 계약 정본(필드 의심 시 원문)
</content>
</invoke>
