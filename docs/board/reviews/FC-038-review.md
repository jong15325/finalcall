# FC-038 — EPIC-FE-AUCTION 통합 리뷰 (reviewer)

- 대상: `5d02ee9`·`e6f2476`(FC-036 목록) · `d18ff0c`·`1b6a1ad`(FC-037 상세). 변경 20파일 전부 `frontend/`
- 기준: `design-system.md` §1.2·§2.7·§5.1·§5.3·§5.4·§5.7~§5.10 · `accessibility.md` · `api-contract.md` **v1.9** §3.1·§3.3 · EPIC-FE-AUCTION 디자인 게이트
- 방식: 정적 리뷰 + `tsc --noEmit`(통과) + `eslint`(통과) + `prettier --check`(실패 → m9). 백엔드 :8080 미기동 — 실데이터 미검증은 티켓 "알려진 제약"대로 감점 대상 아님
- 판정일: 2026-07-18

## 최종 판정: **FAILED (changes-requested)** — critical 0 · **major 2** · minor 11

major 2건 해소 후 재리뷰 필요. 게이트3 진행 불가.

---

## ★ 중점 4 (정직한 빈 값 표현) — 설계 의도는 지켜졌다

에픽의 핵심 의도는 **관철됐다**고 판정한다.

- `AuctionCard.tsx:72-91` — `highestBidAmount != null` 분기로 라벨 자체를 바꾼다(`입찰 없음 · 시작가` vs `현재가 · 입찰 N회`). **`startPrice`를 현재가로 위장하는 지점 없음.**
- `AuctionTradePanel.tsx:89-99` — `priceLabel` 3분기(입찰 없음·시작가 / 현재가 / 낙찰가). MoneyAmount 라벨로 구분하므로 색·크기만으로 오인될 여지 없음.
- **자리 유지**: `입찰`(`0회`)·`최고 입찰자`(`없음`) 행은 값이 없어도 무조건 렌더(`:102-103`), `다음 최소 입찰가`는 `—`로 자리 유지(`:112-122`). EPIC-BID 완료 시 숫자만 대체된다.
- `null`/`undefined` 양쪽을 `!= null`·`??`로 받는다 — 단 1건 예외(**M-1**).

단, 완전하지는 않다 → `시작가` 행만 `hasBid` 조건부라 첫 입찰 시 행이 1줄 늘어난다(m6, minor).

---

## major

### M-1. `skill1`/`skill2`가 null일 때 상세에 **"코드 null"**이 그대로 표시된다 (계약 v1.9 §3.3 nullable 불일치)

- 위치: `frontend/src/features/item/components/ItemSpecList.tsx:49-51`, 근인 `frontend/src/types/schema.ts:20-21`

```ts
function skillText(skillCode?: number): string {
  return skillCode === undefined ? '없음' : `코드 ${skillCode}`;
}
```

- **기대 vs 실제**: 슬롯이 비면 "없음" / 실제로는 **"코드 null"**.
- **재현**(백엔드 기동 없이 코드로 확정):
  1. `AuctionItemView.java:42-43` — 필드 타입 `Integer`, null 그대로 전달
  2. 프로젝트에 `NON_NULL` 전역 설정 없음(`@JsonInclude`는 `ApiResponse`(ALWAYS)·`ErrorResponse`뿐, yml에 `default-property-inclusion` 없음) → wire에 **`"skill1": null`이 실린다**
  3. `null === undefined` → false → `` `코드 ${null}` `` → **"코드 null"**
  4. `V9__item_seed.sql` 인스턴스 10건 중 **6건**(#1,3,5,7,9,10)이 skill NULL, 그중 3건은 양쪽 다 NULL → **첫 화면 진입에서 즉시 재현**
- **계약 정합**: DoD 3번 "nullable 3종" 검증 실패. `schema.ts`가 `?:`(= `T | undefined`)로 선언했으나 계약 v1.9 §3.3 표는 null **Y**다. **`?:`는 nullable이 아니다.** 다른 nullable 필드(`goldforceExpireAt`·`highestBidAmount`·`buyNowPrice`·`highestBidderMasked`·`minNextBidAmount`·`resultType`·`startAt`)는 전부 `!= null`/`??`/falsy 체크라 **우연히** 안전하고, `skill1`/`skill2`만 `=== undefined`를 써서 깨진다. **타입이 거짓이라 tsc가 못 잡았다.**
- **major 사유**: DoD 명시 항목이고, "코드 null"은 이 에픽이 표방한 정직한 빈 값 표현과 정면 배치되는 화면 거짓말이다. 시드 6/10에서 즉시 노출.
- **권고**: `schema.ts` nullable 3종을 `skill1?: number | null` 형태로 계약과 정렬 + `skillText`를 `skillCode == null` 느슨 비교로 교정 → `?:`/`null` 양쪽이 한 번에 닫힌다.

### M-2. `element` 코드 3·4를 흙·바람으로 하드코딩 — 계약 v1.9 §3.3이 **명시적으로 금지**한 패턴

- 위치: `frontend/src/features/item/lib/element.ts:16-28`(`CODE_TO_KEY`/`KEY_TO_CODE`에 `3:'earth'`·`4:'wind'`), `:39`(`ELEMENT_KEYS` 4종 고정). 소비처 `AuctionFilterBar.tsx:140-162`
- 계약 v1.9 §3.3 주(`api-contract.md:251`):
  > `3`·`4`는 erd 서술의 나열 순서로 흙·바람이 **추정**될 뿐 실데이터·정본 어디에도 근거가 없다 → 계약에 못 박지 않는다. … 클라이언트는 **미등록 코드를 중립 표기로 폴백**해야 하며, **코드 집합을 4개로 가정한 하드코딩(배열 인덱싱·exhaustive switch)을 두지 않는다.**
- **기대 vs 실제**: 확정된 1(물)·2(불)만 매핑하고 3·4는 미등록 폴백(`속성 3`)으로 흘려야 한다 / 실제로는 4종 고정 표 + `ELEMENT_KEYS` 4개 배열로 필터 칩 생성. 폴백 경로는 **코드 5 이상에만** 살아 있다.
- **사용자 영향(오늘 발생)**: 필터 바에 "흙"·"바람" 칩이 **지금 클릭 가능하게 노출**된다. 누르면 `?element=3`으로 항상 빈 목록이 뜨고, 화면이 근거 없는 분류 체계를 확정된 것처럼 제시한다. EPIC-ITEM 시드 확장에서 3=바람으로 밝혀지면 **모든 배지·아트 슬롯 윤곽색·상세 속성명이 조용히 오표기**된다(무음 실패). `element.ts:6` 주석이 근거 부재를 스스로 인정하고 있다.
- **범위 확인**: 재지적 불요 7건에 해당하지 않는다. 디자인 게이트가 승인한 것은 "element 필터 존재"이지 **"미확정 코드의 표시명 창작"이 아니다.**
- **커밋 순서 주**: 계약 v1.9(`c5353b3`)는 프론트 구현(`5d02ee9`~`1b6a1ad`) **이후** 확정됐다. **구현자를 탓할 사안은 아니나**, 티켓 `contract_ref`가 v1.9인 이상 현행 정본 기준 드리프트로 닫는다.
- **권고(≈5줄)**: `CODE_TO_KEY`/`KEY_TO_CODE`에서 3·4 제거, `ELEMENT_KEYS`를 확정 코드(1·2)로 축소. `ELEMENT_*_CLASS` 토큰 표는 4색 그대로 두어도 무해(§2.7 토큰은 확정값). EPIC-ITEM 실측 시 표에 2줄 추가로 복구.

---

## minor (비차단, 11건)

| # | 위치 | 내용 |
|---|---|---|
| m1 | `Countdown.tsx:51-61` | `formatVerbose`가 초를 버려 T-30초 구간에서 SR이 **"마감까지 0분 남음"**으로 읽는다. 소프트클로즈 윈도우가 가장 정보 빈약해지는 역전. `remaining < 60s`일 때 초 표기 권고 |
| m2 | `Countdown.tsx:94-102` | accessibility §6·design-system §5.9가 명시한 **"연장(소프트클로즈)" 전환 안내가 없다.** `urgent → normal` 역전이 침묵하고, `announcement`가 직전과 동일하면 live region이 재발화하지 않는다. **EPIC-BID 후속 필수** |
| m3 | `CursorLoadMore.tsx:40-46` | 마지막 페이지에서 `hasNext=false` → "더 보기" 언마운트 → **포커스가 body로 소실**(WCAG 2.4.3). 추가 카드 개수 안내도 없음 |
| m4 | `AuctionListPage.tsx:62-64` + `CursorLoadMore.tsx:27-38` | `useCallback(..., [query])`로 `loadMore` 아이덴티티가 매 렌더 변경 → **IntersectionObserver 매 렌더 재생성**. `isLoading` 가드로 폭주는 없으나 불필요한 재구독 |
| m5 | `AuctionCard.tsx:24` | `ended`가 렌더 시점 `Date.now()` 스냅샷 → **시간 반응성 없음.** 목록은 폴링 안 하므로 보는 중 마감된 카드는 Countdown만 "마감"으로 바뀌고 **딤 오버레이는 그대로**(§5.3 불일치). 상세는 10s 폴링으로 자가 치유 |
| m6 | `AuctionTradePanel.tsx:104-106` | `시작가` 행만 `hasBid` 조건부 → **첫 입찰 시 행 1줄 증가.** DoD ★ "자리 유지" 부분 위반(다른 3행은 준수). 항상 렌더 권고 |
| m7 | `AuctionCard.tsx:72-91` ↔ `AuctionTradePanel.tsx:80-99` 외 | **중복 구현(DoD 5)**: 컴포넌트 재사용은 양호(포크 없음)하나 ① "입찰 없음·시작가" **판정 규칙**이 두 곳에 독립 구현 ② 종료 오버레이 마크업 복붙. 에픽 핵심 불변식이 두 벌이면 드리프트 위험 |
| m8 | `AuctionDetailPage.tsx:71` | 프로그램 포커스 대상 `h1`에 `outline-none`(Tailwind utilities가 전역 `:focus-visible`을 이김) → **포커스 시각 표시 없음.** 포커스 이동 자체는 올바름 |
| m9 | 신규 4파일 | `prettier --check` 실패. 커밋 전 `npm run format` 누락 |
| m10 | `auctionApi.ts:39` | 경로 보간에 `encodeURIComponent` 없음. 영향 낮음(공개 GET·토큰 미첨부·동일 오리진)이나 **코드베이스 최초 경로 보간 호출이라 여기서 관례를 세울 것** |
| m11 | `frontend/package.json` | **프론트에 테스트 러너 없음**(vitest·testing-library 미도입). 에픽 핵심 불변식에 회귀 테스트 0건. **M-1이 리뷰까지 살아남은 직접 원인.** 기존 부채이며 이 에픽의 신규 결함 아님 |

---

## 이상 없음으로 판정한 축

**디자인 시스템 §1.2 — 위반 없음**
- **퍼플 CTA 채움 0건.** 유일한 `variant="primary"`는 `bg-ink` 블랙. 퍼플은 `text-primary underline`·`focus:border-primary`로만 등장 — §1.2 ① 허용 범위
- **Game-Color Containment 준수.** `element-*` 클래스는 `features/item/lib/element.ts` 한 곳에만 존재, 소비처는 ElementBadge·ItemArtSlot·속성 필터 칩 3곳뿐. 버튼·탭·인풋·크롬·링크·내비로 샌 곳 없음(전역 grep)
- **ElementBadge 라이트 패턴 준수** — `element-soft-*` 틴트 + near-black 라벨 + solid 도트. **흰 배경 위 element 텍스트 직접 사용 없음**(water 2.37 함정 회피)
- **등급 배지 없음**(D-073)

**접근성 — 골격은 정확하다**
- `Countdown`: 시각 값 `aria-hidden`, live region은 `announcement` 전용 별도 span이며 **초당 갱신은 live region 밖** → `aria-live=off` 요건 충족. 최초 렌더 침묵, 종료 후 타이머 정지. 임박 1차 신호는 색이 아니라 텍스트
- **"더 보기" 폴백은 장식이 아니다** — 센티넬(`aria-hidden`) **바깥**에 실제 `<Button>`으로 상시 렌더, 동일 핸들러. 키보드·SR 도달 확인
- **44px 타깃 전부 충족**(필터 제거 칩·속성 칩·전체 초기화·select/input·Button md 전부 `h-11`)
- 상세 진입 포커스 관리 구현(deps=publicId라 폴링 재렌더에 재발화 안 함)
- 색 단독 전달 없음. 네이티브 시맨틱, `fieldset/legend`, `aria-pressed`, `aria-busy`, disabled CTA에 `aria-describedby` 사유 연결

**계약 정합 v1.9 — M-2 외 정합**
- 정렬 3종 전부 화이트리스트 내부. `isAuctionSort`로 URL 유입값까지 검증
- 요청 파라미터 7종만 송신, 임의 파라미터 없음
- 필드 사용 §3.3과 1:1. **정수 7종 `number` 정정 완료**. nullable 3종만 M-1
- 필터·정렬이 queryKey에 포함 → **커서 자동 초기화** 성립(keyset 종속성 인지)
- `minNextBidAmount` 미구현 대응 올바름 — 증분표 복제하지 않고 `—`로 자리 유지

**보안 — 이상 없음**
공개 GET 2건 `auth:false`로 토큰 미첨부. 시크릿·`dangerouslySetInnerHTML` 없음. 노출 PII는 `sellerNickname`(계약 승인)뿐, `highestBidderMasked`는 마스킹값 그대로. IDOR 표면 없음. m10만 위생 지적

**불필요 변경 — 통과.** 20파일 전부 요청에 직접 추적. 무관한 리팩터·포맷 churn 없음

---

## 메인세션 조치

1. FC-036·FC-037 `review_status: changes-requested`, `review → doing` 되돌림
2. major 2건 frontend-impl 회부(합계 ~15줄, 3파일). **게이트2 상신 불요** — 계약 변경이 아니라 계약을 **따르는** 방향의 수정
3. m9(prettier)는 major 수정 커밋에 동반. **m6은 EPIC-BID 착수 전에 처리하는 게 싸다**
4. m2·m5는 EPIC-BID 후속 티켓 예약, 나머지 백로그
5. m11(프론트 테스트 인프라 부재) 별도 티켓 검토 — M-1이 리뷰까지 도달한 구조적 원인

## EPIC-BID 완료 후 프론트가 손봐야 할 지점

**자동 전환(무작업)**: `highestBidAmount`·`bidCount`·`highestBidderMasked`·`minNextBidAmount` 실값이 오면 null 분기가 그대로 뒤집힌다. 상세 10s 폴링이 최고가·연장 `endAt`을 자동 반영.

**손봐야 하는 것**:
1. **m6** — `시작가` 행 상시 렌더. EPIC-BID 착수 **전에** 고치는 게 싸다
2. **m2** — 소프트클로즈 연장 안내. 지금은 `extensionCount`가 항상 0이라 무해하나, 입찰이 붙는 순간 accessibility §6 실효 요건이 된다. 동일 문자열 재발화 문제 동시 해결 필요
3. **상위 입찰 밀림 안내** — 폴링으로 `highestBidderMasked` 변경 감지 → 폴라이트 안내 + 토스트 동기
4. **`BidCallToAction` 실동작 교체** — 자리·`aria-describedby` 배선은 이미 정확. 단 **`BID_003`(자기 경매)·`BID_007`(미개시) 화면 분기가 없다**(상세가 판매자 본인 여부를 알 수 없고 `SCHEDULED` CTA도 뭉뚱그려짐). 계약 v1.8 주가 "안내 문구·재시도 가능성이 정반대"라 못 박았으므로 **EPIC-BID 프론트 티켓 DoD에 명시할 것**
5. **m5** — 목록 카드 시간 반응성
6. **★ `highestBidAmount,desc` 정렬 커서(백엔드 이슈)** — `AuctionRepositoryImpl.java:155`가 "본 에픽 전건 NULL" 전제로 `HIGHEST_BID_AMOUNT` keyset을 **id만으로** 잡고 있다(`case HIGHEST_BID_AMOUNT -> idAfter(lastId, asc)`). **실값이 들어오면 페이지 경계가 깨진다.** 최고가순 칩을 노출하는 것은 프론트이므로 EPIC-BID 종료 전 통합 확인 필요
