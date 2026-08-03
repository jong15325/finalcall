# 카드 컴포넌트 통합(디자인 시스템) 제안 v0.1 — 게이트1 상신용

- **작성**: architect
- **일자**: 2026-08-04
- **상태**: 게이트1 상신 대기(계획·분해안 — 구현 아님)
- **발단**: FC-179 스코프 확장. "페이지마다 카드 영역을 재구현해 '똑같이'가 매번 다르게 나온다 —
  재사용·관리 용이하게 조치 필요"(사용자 피드백 2026-08-04). FC-178에서 실제 마찰(크로스 feature
  임포트 member→shop · `hidePrice` 가법 prop · 포크 vs 공유).
- **목표**: **"같은 디자인 = 같은 정본 컴포넌트"** 를 구조로 강제한다.
- **비고**: 이 문서는 진단·설계·분해안·권고만 담는다. 코드·기존 컴포넌트는 수정하지 않는다.
  게이트1(에픽 분해 승인)·consultant(규약 신설)·게이트2(계약 델타) 판정 지점을 명시한다.

---

## 1. 실태 진단 (카드 표면 감사)

### 1.1 카드 표면 인벤토리

| 표면 | 파일 | 형태 | 정본 재사용 | 특이 |
|---|---|---|---|---|
| 마켓 카드 | `features/shop/components/ShopCard.tsx` | 세로 | `ItemCard`(skillFlip) 재사용 | `.shop-card` 래퍼 + `inset-0` 오버레이 버튼(모달 열기) + 비교 오버레이 |
| 인벤토리 카드 | `features/member/components/InventoryItemCard.tsx` | 세로 | `ItemCard`(skillFlip, hidePrice) 재사용 | ShopCard 래퍼/오버레이 **복붙 이식**. 가격·판매자·비교 없음 |
| 내 판매 카드 | `features/shop/components/MyShopCard.tsx` | 세로 | `ItemCard`(비-flip) 재사용 | `footer`(정산액+내리기), 링크 없음 |
| 경매 목록 카드 | `features/auction/components/AuctionCard.tsx` | **가로** | **미재사용** — `ItemFrame`로 직접 재구현 | 112px\|1fr 그리드, 상태배지·카운트다운·판매자 |
| 홈 프리뷰 카드 | `features/auction/components/AuctionPreviewCard.tsx` | 세로 | **미재사용** — `ItemFrame`로 직접 재구현 | 이름·가격·카운트다운을 인라인 재작성 |
| 마켓 카드정보 모달 | `features/shop/components/ShopCardInfoDialog.tsx`(+`.css`) | 모달 | — | 헤더→썸네일+속성표→스킬→판매자→가격+구매CTA+확인 서브뷰. 구매 뮤테이션·잔액·isOwn 결합 |
| 인벤토리 카드정보 모달 | `features/member/components/InventoryCardInfoDialog.tsx` | 모달 | ShopCardInfoDialog **포크**(CSS 임포트 공유) | 읽기전용 + '판매 등록' 단일 CTA. 모달 배선 ~50줄 복붙 |
| 판매 선점 카드 | `pages/SellPage.tsx` `PreemptedItemCard` | 가로(인라인) | **미재사용** — `ItemFrame` 직접 | 잠금 카드, 속성 뱃지 인라인 재작성 |
| 임시보관 행 | `features/member/components/TempStorageList.tsx` | 리스트행 | **미재사용** — `ItemFrame` 직접 | 요약 미제공이라 상세 조회로 아트 파생(성격이 다름) |
| (상세) 히어로 | `AuctionHeroCard`·`ShopHeroCard`·`ItemInstanceDetail`·`OrderCard`·`ComparePage` | 각양 | `ItemFrame`/`ItemSkillSummary` 부분 재사용 | 상세/주문/비교 — 목록 카드 축과 별개(1차 스코프 밖) |

### 1.2 그리드 감사

| 페이지 | 그리드 클래스 | 소유 |
|---|---|---|
| `MarketPage` | `grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6` | 페이지가 직접 문자열 작성 + 자체 스켈레톤 |
| `InventorySlotGrid` | `grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6` | **마켓과 바이트 동일** — 별도 복제. 스켈레톤도 페이지가 별도 |
| `AuctionListPage` | `grid grid-cols-1 gap-4 xs:grid-cols-2 min-[1200px]:grid-cols-3` | 페이지가 직접 + 자체 스켈레톤 |

→ 마켓·인벤토리 그리드는 **바이트 동일한데 세 곳(마켓·인벤그리드·각 스켈레톤)에 복제**돼 있다.
FC-179가 요구한 "인벤토리만 간격 축소"를 하면 **아무 강제 없이 조용히 드리프트**한다.

### 1.3 크로스 feature 임포트 현황 (엉킴)

```
shop/ShopCard          → item/ItemCard           (shop → item)
shop/ShopCard          → auction/CardCompareOverlay (shop → auction  ← 역방향 냄새)
shop/MyShopCard        → item/ItemCard           (shop → item)
member/InventoryItemCard → item/ItemCard         (member → item)
member/InventoryCardInfoDialog → shop/lib/channelLimit
member/InventoryCardInfoDialog → shop/components/ShopCardInfoDialog.css  (member → shop  ← FC-178 M1)
auction/AuctionCard·PreviewCard → item/ItemFrame·libs (auction → item)
```

`item`은 사실상 **카드 커널**로 기능하는데(모두가 `ItemFrame`/`ItemCard`를 향함), 정작
`CardCompareOverlay`는 `auction`에, `channelLimit`·카드정보 CSS는 `shop`에 있어 **소비자가 feature
경계를 가로질러 손을 뻗는다**. 그 결과 그래프가 얽힌다(member→shop, shop→auction).

### 1.4 "똑같이"가 깨지는 구조적 원인 (근본)

1. **정본 그리드/셸 부재.** 페이지마다 그리드 문자열·스켈레톤을 손으로 쓴다. 동일해야 할 것이
   복제돼 있어 한쪽만 바뀌면 드리프트한다. "같은 그리드"를 강제하는 것이 없다.
2. **`ItemCard`는 공유되나 *카드 표면 조립*(카드+래퍼+오버레이 버튼+비교+모달 열기)은 페이지마다
   재조립.** ShopCard와 InventoryItemCard가 동일한 `.shop-card ... hover:-translate-y-[3px]` 래퍼 +
   `absolute inset-0 z-10` 오버레이 버튼을 **복붙**한다(member가 shop을 베낌). "눌러서 카드정보 모달
   여는 카드"라는 조립에 정본 컴포넌트가 없다.
3. **카드정보 모달은 공유가 아니라 포크.** InventoryCardInfoDialog는 ShopCardInfoDialog의 손복사
   포크다(동일 DOM·초점트랩/스크롤락/Esc 배선 ~50줄 중복, CSS는 임포트 공유). 속성표를 한 번 바꾸려면
   두 파일 또는 shop 소유 CSS를 건드려야 한다.
4. **feature 소유 위치가 어긋남.** 카드 커널은 `item`인데 비교 오버레이는 `auction`, 채널제한·모달
   CSS는 `shop`에 있다. 공유 카드 홈이 없어 소비자가 교차 임포트한다.
5. **카드 *형태* 자체가 두 번 재구현.** AuctionCard(가로)·AuctionPreviewCard(세로)는 `ItemCard`를
   우회해 아트·스킬·가격을 인라인 재작성한다 — 같은 카피(이름 클램프·가격 줄·스킬 요약)가 3곳 이상에서
   미묘하게 다른 토큰(이름 13px vs 15px 등)으로 쓰인다.
6. **prop 분기 누적(FC-178).** `hidePrice`가 가법 boolean으로 `ItemCard`에 붙었다. 맥락이 늘 때마다
   boolean이 하나씩 붙는(`hidePrice`·`skillFlip`·…) prop 폭발의 시작이다. variant 모델이 없으면
   `ItemCard` prop 표면이 무한 증식하고, 페이지마다 서로 다른 부분집합을 넘겨 "같은 디자인"이
   **어느 boolean을 넘겼는지에 따라** 갈린다. (reviewer FC-178이 지적한 패턴.)

---

## 2. 정본 카드 시스템 설계

### 2.1 위치 — `item`을 유일 카드 커널로

- **정본 카드 프리미티브는 전부 `features/item/components`(+ `card/` 하위 폴더 권장)에 둔다.**
  근거: FE rules §3("애매하면 도메인 쪽 · 공용 승격은 두 번째 사용처") + 카드는 본질적으로 "아이템을
  그리는 것"이라 `item`이 자연스러운 커널이고, `ItemCard`/`ItemFrame`이 이미 여기 산다.
- **의존 규약: `shop`·`auction`·`member` → `item` 단방향.** 역방향·측면(shop→auction, member→shop)
  임포트를 없앤다. 이를 위해 아래 세 자산을 `item`으로 승격한다(reviewer FC-178 M1 권고 이행):
  - `auction/CardCompareOverlay` → `item`(카드 오버레이는 카드 커널 소속). `store/compareStore`
    의존은 전역 store라 유지(공용 cross-cutting).
  - `shop/lib/channelLimit` → `item/lib`(표시 파생, item 도메인 지식).
  - `shop/components/ShopCardInfoDialog.css` → `item`(카드정보 정본 CSS).
- **왜 `src/components/`(도메인 무관 공용)가 아닌가**: 카드는 스킬·골드포스·프레임·typeCode 등
  item 도메인 개념을 안다. 도메인 무관이 아니라 *소비자 무관*일 뿐이다. `src/components/`는
  `CodeAmount`처럼 도메인 지식 0인 것만 둔다.

### 2.2 정본 컴포넌트 후보

| 신설/유지 | 컴포넌트 | 위치 | 역할 |
|---|---|---|---|
| 유지·정비 | `ItemCard` | `item/components` | 세로 카드 *본체*(아트+카피+스킬+가격). variant/slot로 정비 |
| **신설** | `ItemCardTile` | `item/components` | *상호작용 표면* — `ItemCard`를 `.shop-card` 래퍼 + 전면 오버레이 버튼(onOpen) + 비교 오버레이 + footer로 감싼 정본. ShopCard/InventoryItemCard의 복붙 조립을 흡수 |
| **신설** | `CardInfoDialog` | `item/components` | 카드정보 모달 *셸* — 헤더+썸네일+속성표+스킬 섹션 + `footer`/`extraRows` 슬롯. 모달 배선(초점트랩·스크롤락·Esc·backdrop) **한 곳**. 구매 뮤테이션은 소비자가 footer로 주입(결합 차단) |
| **신설** | `ItemCardGrid` | `item/components`(또는 `src/components`) | 반응형 그리드 + 스켈레톤 정본. variant: `market`(2/3/6, gap-3)·`auction`(1/2/3, gap-4)·`inventory`(2/3/6, gap 축소) |

### 2.3 변형(variant) 모델 — boolean 폭발을 없앤다

세 목록 맥락은 *카드 스켈레톤*이 아니라 *가격/footer/overlay*가 다르다. `ItemCard`를 boolean 더미가
아니라 **variant enum + nullable price + slot**으로 정비한다:

```
variant: 'browse' | 'market' | 'compact'   // 레이아웃·skillFlip·타이포 프리셋
price?: { amount: number | null; label?: string } | null  // null = 가격 줄 없음
footer?: ReactNode
overlay?: ReactNode                         // 비교 등(기존 유지)
detailLink?: ReactNode                      // 기존 유지
```

- `hidePrice` boolean → **`price`를 nullable로**(부재 = 줄 없음). boolean 제거.
- `skillFlip` boolean → **`variant: 'market'`으로 흡수.**
- 이미 좋은 확장점인 slot(`footer`/`overlay`/`detailLink`)은 유지하고, **boolean 추가만 중단**한다.
- 소비자(ShopCard·InventoryItemCard·MyShopCard)는 도메인 요약 → `ItemCardData` 매핑 + variant 선택만
  하는 **얇은 어댑터**로 축소되거나 `ItemCardTile` 호출로 사라진다.

### 2.4 과일반화 경계 (coding-discipline)

- **가로 `AuctionCard`를 세로 카드에 합치지 않는다.** 112px\|1fr 그리드 vs 세로 스택은 진짜 다른
  레이아웃이다. `layout: 'horizontal'|'vertical'` prop으로 한 컴포넌트에 두 개의 분리된 렌더트리를
  욱여넣으면 전형적 god-component 과일반화다. → **가로 카드는 별도 유지**, 대신 공유 *하위
  프리미티브*(스킬 요약·가격 줄·상태배지·프레임 아트)를 추출해 카피 토큰을 공유한다.
- **구매 뮤테이션을 공유 `CardInfoDialog`에 올리지 않는다.** footer 슬롯으로 소비자가 주입 —
  FC-178이 포크를 택한 이유(구매·잔액·확인 서브뷰 결합)를 **슬롯 seam으로 해소**한다.
- **"만능 카드" 단일 컴포넌트를 만들지 않는다.** 규칙은 "같은 *형태* 표면은 정본을 쓴다"이지 "모든
  것을 한 컴포넌트로"가 아니다. 진짜 새 형태가 필요하면 새 컴포넌트를 만든다.

### 2.5 재사용 규약 — 문서화·강제

- **문서**: `docs/frontend/rules.md`에 신설 절(append-only, 다음 번호=§9). 요지:
  "새 카드/카드정보/그리드 표면은 `item`의 `ItemCard`/`ItemCardTile`/`CardInfoDialog`/`ItemCardGrid`를
  쓴다. 래퍼·오버레이 버튼·그리드 문자열을 재작성하지 않는다. 카드 크로스 feature 의존은 → `item`
  단방향만 허용."
- **강제**: (a) reviewer 체크리스트 항목("카드 표면 재구현 여부·크로스 임포트 방향"); (b) 가능하면
  ESLint `no-restricted-imports`(feature→feature 카드 임포트를 →item 외 금지) + 그리드 클래스
  재선언 탐지. 풀 lint 강제는 nice-to-have(비차단).
- **⚠ consultant 소환 판정**: `docs/frontend/rules.md`에 규범 절을 신설하는 것은 **구조 축(규약)
  변경**이다(CLAUDE §8·§10 — 규약·프로세스 변경은 consultant, rules.md는 "프론트 제안 + 컨설턴트
  승인"). → **규약 성문화(T2)는 consultant 소환 필요.** 단, *컴포넌트 통합 구현 자체*는 게이트1
  에픽 아래 통상 작업이다. 권고: 통합은 게이트1로 진행, 규약 성문화는 consultant로 병행/후행.

---

## 3. 마이그레이션 계획 (무-회귀)

- **불변식**: 직렬화 JSON 형상 불변(순수 FE 리팩터 — API/DTO 변경 없음. FC-179 스킬명 델타는 독립
  가법). **시각 픽셀 보존** — 통합 후 렌더 결과가 바이트 동일해야 한다. 기존 스위트로 검증(ShopCard 6·
  ShopCardInfoDialog 8·ItemCard 11·Inventory 스위트·a11y 테스트).
- **단계**(각 단계 독립 배포·되돌리기 가능):

| 순서 | 내용 | 위험 | 되돌리기 |
|---|---|---|---|
| 0 | (선행 가능·독립) FC-179 백엔드 스킬명 델타 `ItemSummaryResponse += skill1Name/skill2Name` | 낮음 | 필드 가법이라 제거만 |
| 1 | `ItemCardGrid` variant 신설 → Market/AuctionList/InventorySlotGrid 이관(+FC-179 인벤 간격 축소 = `inventory` variant) | 낮음(순수 래퍼) | 그리드 문자열 복원 |
| 2 | `CardInfoDialog` 셸 신설 → Shop/Inventory 다이얼로그를 footer 슬롯 소비로 리팩터. 카드정보 CSS·channelLimit → item 승격 | **높음**(모달·초점트랩·a11y) | 다이얼로그 복원 |
| 3 | `ItemCardTile` 신설 → ShopCard/InventoryItemCard를 얇은 어댑터로. CardCompareOverlay → item 승격 | 중(비교·플립 hover) | 어댑터 복원 |
| 4 | `ItemCard` variant 모델 정비(hidePrice→nullable price, skillFlip→variant) + FC-179 스킬명 FE 배선을 **정본 경로 한 곳**에 | **높음**(마켓 시각) | prop 복원 |
| 5 | (선택·폴리시) AuctionCard/PreviewCard 공유 하위 프리미티브 추출 | 낮음 | 인라인 복원 |

- **핵심 위험**: 2단(모달 a11y)·4단(마켓 시각). 완화 = 시각 diff + 기존 a11y/스냅샷 테스트. FC-178이
  포크 사유로 든 구매 뮤테이션 결합은 **footer 슬롯 seam**으로 처리(공유 코드로 뮤테이션 승격 안 함).
- **각 단계 = 독립 PR**. 되돌리기 = 직전 컴포넌트 복원.

---

## 4. FC-179 접붙임

- **스킬명 백엔드 API 델타 = 구조와 독립, 선행 가능**(단계 0). `ItemSummaryResponse`에
  `skill1Name`/`skill2Name`(String, nullable) 추가 — `AuctionItemResponse` 패턴. DB 마이그레이션
  없음(`SkillDefinition` 기존, N+1 아님). api-contract §3.3에 가법 델타 명시. **게이트2 A로 이미 승인
  (2026-08-04)** — 새 게이트2 아님.
- **스킬명 FE 배선 = 정본 경로 한 곳**(단계 4). `ItemCard` variant + `CardInfoDialog` 스킬 섹션에서
  이름을 받으면 인벤토리·마켓·경매가 **같은 배선**으로 이름을 얻는다 — 곧 이동할 컴포넌트에 중복 배선을
  피한다.
- **인벤토리 카드 간격 축소 = `ItemCardGrid`의 `inventory` variant**(단계 1). 마켓 그리드 무변경
  (별도 variant). FC-179가 "인벤토리만 좁게"를 요구했으므로 variant 분리가 정확히 이를 강제한다.
- **결론**: FC-179는 이 에픽의 자식으로 흡수하되, **백엔드 스킬명 델타(단계 0)만 선행**시키고 FE
  배선·간격은 정본 컴포넌트에서 처리한다(중복 배선 회피).

---

## 5. 에픽 분해안 (게이트1)

**에픽 후보: EPIC-CARD-SYSTEM** — 카드 컴포넌트 통합(디자인 시스템).

| 티켓 | owner | 내용 | 의존 | 병렬 |
|---|---|---|---|---|
| T1 (FC-179 백엔드) | backend-impl | `ItemSummaryResponse += skill1Name/skill2Name` + api-contract §3.3 델타 | 없음 | ∥ 가능 |
| T2 (규약 성문화) | architect+**consultant** | `docs/frontend/rules.md` §9 카드 정본 규약 + 강제 방식 | 없음 | ∥ 가능 |
| T3 (그리드) | frontend-impl | `ItemCardGrid` + 3그리드 이관 + FC-179 인벤 간격 | 없음 | ∥ 가능(파일 무교차) |
| T4 (모달) | frontend-impl | `CardInfoDialog` 셸 + Shop/Inventory 리팩터 + CSS·channelLimit 승격 | — | T5/T6과 직렬(같은 파일) |
| T5 (타일) | frontend-impl | `ItemCardTile` + ShopCard/InventoryItemCard 어댑터화 + CardCompareOverlay 승격 | T4 후 권장 | 직렬 |
| T6 (variant+스킬명) | frontend-impl | `ItemCard` variant 정비 + FC-179 스킬명 FE 배선 | T1·T4·T5 | 직렬 |
| T7 (선택) | frontend-impl | AuctionCard/PreviewCard 공유 프리미티브 추출 | T6 후 | 직렬 |

- **병렬성**: T1(백엔드) ∥ T3(그리드) ∥ T2(consultant 문서) — 쓰기 파일 무교차. T4→T5→T6은 ShopCard/
  ItemCard/다이얼로그 파일을 공유하므로 직렬.
- **게이트 지점**:
  - **게이트1**: 이 분해안(에픽 shape·티켓·의존) 승인.
  - **게이트2**: 신규 없음. 스킬명 가법 델타는 게이트2 A로 기승인. 통합은 순수 FE(스키마·성능·계약
    영향 없음)라 게이트2 대상 아님.
  - **consultant**: T2(FE 규약 신설)만.
- **순서 권고**: T1·T2·T3 먼저(독립·저위험, FC-179 사용자 피드백 즉효) → T4 → T5 → T6 → (T7).

---

## 6. 과설계 경계 — 이득 vs 통합 비용

- **이득**: "같은 디자인 = 같은 정본." 그리드 문자열 중복·모달 chrome 중복·래퍼/오버레이 복붙·prop
  boolean 누적·크로스 feature 엉킴을 제거. FC-179와 향후 카드 조정이 **한 곳 변경**이 된다.
- **비용**: 고가시성·고테스트 표면(마켓·인벤토리)에 5~6개 FE 리팩터 티켓 churn. 모달·마켓 카드 시각/
  a11y 회귀 위험. variant enum·slot prop의 추상 오버헤드.
- **경계(하지 않을 것)**: 가로 AuctionCard를 세로에 병합 금지 · 구매 뮤테이션을 공유 모달에 승격 금지
  · "만능 카드" 단일 컴포넌트 금지. **공유**: 세로 카드 본체·모달 셸·그리드·하위 프리미티브.
  **분리 유지**: 가로 경매 카드·feature별 뮤테이션/CTA(슬롯 경유). 새 *형태*는 새 컴포넌트.
- **권고**: 통합은 이득이 비용을 넘는다(재발성 마찰 + FC-179가 이미 통합을 요구). 단, T7(경매 카드
  프리미티브 추출)은 선택으로 두고, 위험 큰 T4/T6은 시각 diff·a11y 테스트로 게이트한다.
