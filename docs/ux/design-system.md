# FinalCall 디자인 시스템 (design-system.md)

상태: DRAFT v0.2.1 — 디자인 초안. 비주얼 방향 **확정**(U-016 원게임 UI 스킨 차용) + **[2] 색 토큰 게임 팔레트 실측값으로 전면 재정의 완료**(U-020). [1]·[2]는 확정, [3]~[6]은 초안.
소유: 디자인(UX/UI)
근거: api-contract v1.4(최상위, 등급 제거 D-073·[3.3] 응답 스키마·[2.5] 회원 리소스·[1.6] 엣지 오류), erd v0.7(item_template.element), frontend/CLAUDE.md 5절, ux/rules.md 3·4·11절, U-001~003·005~010·U-016·U-020
기준: 계약이 최상위. 이 문서는 프론트 구현의 참고 지침이며 계약·도메인 규칙과 충돌 시 계약 우선. 상류 조율은 기획(P, D-079).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-14 | 초안 — 비주얼 방향(선택지), 토큰(색·타이포·간격·반경·그림자·모션) + Tailwind 매핑, 우선 컴포넌트 스펙 |
| v0.1 | 2026-07-14 | 계약 v1.2 정합 — 등급(grade) 축 제거(D-073, U-004 SUPERSEDED→U-010). grade 토큰·GradeBadge 폐기, 시각 축을 속성(4색)·레벨·골드포스·스킬로 재조정 |
| v0.2.1 | 2026-07-16 | **U-020 누락 보정**(프론트 009 → 회신 019) — [2.6] 매핑에 `focus-ring` 추가(정의는 [2.2]에 있었으나 매핑 표에서 누락, 드롭인 블록이 승계) · [2.2]에 `outline-offset: 2px`가 AA 조건인 근거 명시(offset 0 시 `primary-selected` 1.82:1) · [2.6]에 동일 hex 3토큰의 처리 차이 명시. **값 변경 0 — 새 결정 아님** |
| v0.2 | 2026-07-15 | **비주얼 방향 확정 + 색 토큰 전면 재정의(U-020)** — [1] A/B/C 3안 폐기 → 게임 UI 스킨 실측 팔레트. [2] 크롬·조작·정보·아이템 4계층 재구성, element 4색을 아트 픽셀 실측으로 교체(earth·wind 종전값 오답 반증), 전 토큰 WCAG AA 계산 검증. 색 사용 3계층 규칙 신설([1.2]). 계약 v1.3·v1.4 델타 반영(D-092 ①): [5.2] Checkbox 신설, [5.6] 429 백오프 |

핸드오프 원칙: 토큰명은 프론트 Tailwind 유틸과 1:1(U-001). 이 표의 키를 `tailwind.config.js` `theme.extend`에 그대로 넣으면 `bg-primary`, `text-muted`, `rounded-lg` 등으로 사용된다.

---

## 1. 비주얼 방향 (톤·무드) — 확정 (U-016)

**원게임(SurvivalProject) UI 스킨 전면 차용.** 사용자 직접 확정(2026-07-15). 종전 A/B/C 3안(Dark Arena·Clean Marketplace·Neon Night)은 **폐기**한다(U-009 SUPERSEDED → U-016).

실행 방식은 **게임 UI 이미지를 부착하는 것이 아니라, 게임의 색·형태 언어를 토큰으로 추출해 CSS로 재현**하는 것이다. 차용 대상은 시각 언어(팔레트·테두리·패널 형태·타이포 위계)이지 비트맵이 아니다. 비트맵 차용은 **아이템 아트 스프라이트 한정**(U-012 이미지 슬롯).

이유(U-016): 게임 버튼은 텍스트가 이미지에 구워져 있어 웹에 필요한 카피(`로그인`·`입찰하기`·`회원 탈퇴`·`충전하기`)를 만들 수 없고, 스크린리더가 읽지 못하며(accessibility 위반), 고정 해상도 전제라 360px 모바일에 늘어나지 않는다. CSS 재현이면 원본 감성을 지키면서 카피·반응형·접근성·다국어를 모두 살린다.

### 1.1 실측 원천 (육안 추정 아님)

색값은 **원본 자산 픽셀 샘플링으로 실측**했다. U-016 발번 시점의 "육안 추정(잠정)" 한계는 해소됐다.

| 원천 | 경로 | 추출 |
|---|---|---|
| UI 크롬 | `interface/global/card_info/` (`wnd_cardinfo.png` 211×307 등) | 창 배경·패널·테두리·텍스트·상태 3색 |
| 아이템 아트 | `card/card_image/gold_black/level{1..9}/{l,s}/{element}/{kind}.png` | element 4색 (속성별 `l` 81파일 전수 히스토그램, PNG 청크 CRC 전건 검증) |

주의 — **`#0000FF`(순수 파랑, 자산의 3~6%)는 구형 투명 키 컬러다.** 디자인 색으로 오인 금지. 샘플링에서 제외했다.

### 1.2 색 사용 3계층 규칙 (이 시스템의 핵심 제약)

게임 팔레트는 **좁다**(남색·파랑·주황·황금·크림). 웹이 필요로 하는 색 축(브랜드·상태·의미·속성)을 여기에 다 넣으면 hue가 겹친다. 실측이 드러낸 충돌:

- element-water(200°) ↔ 크롬 패널 파랑(208°) — **8° 차이, 사실상 같은 색**
- element-fire(20°) ↔ 눌림 주황(22°) — **2° 차이**
- element-water(200°) ↔ element-wind(180°) — 20° 차이(게임에선 아트 형태가 구분하지만 웹 칩은 색만 남는다)

색을 재배치해 피할 수도 있으나, 그러면 **칩 색과 카드 아트 색이 어긋난다**(아트가 정본이고 크롬은 CSS라 양보 가능한 쪽은 크롬이 아니라 웹의 배치 규칙이다). 따라서 색이 아니라 **계층으로 분리**한다:

| 계층 | 쓰는 색 | 적용 대상 | 금지 |
|---|---|---|---|
| ① 조작 | 게임 상태 언어 — 기본 파랑 / 눌림 주황 / 활성 황금 | 버튼·탭·인풋·페이지네이션 등 **누를 수 있는 것** | 의미색·element색을 조작 상태로 쓰지 않는다 |
| ② 정보 | 의미색 — success·warning·danger·info | 상태 칩·토스트·필드 에러·잔액 경고 | 조작 가능성을 암시하지 않는다 |
| ③ 아이템 | element 4색(아트 실측) | element 칩·필터 칩·카드 테두리 | **색 단독 사용 금지 — 아이콘+라벨 필수** |

- **세 계층은 같은 컴포넌트 안에서 색으로 섞이지 않는다.** 예: 버튼 안에 element 색을 넣지 않는다. element 칩에 hover 주황을 넣지 않는다.
- **element 칩은 창 배경(`bg`) 위에만 놓는다.** 패널 파랑(`primary`) 위에 놓으면 water 2.4:1 · fire 1.78:1로 무너진다(계산은 [2.4]).
- 한계 명시: **황금(`#E2B206`)은 ①의 "활성"과 ②의 `warning`에 모두 쓰인다.** hue 재고가 없어 계층 분리로만 구분한다 — 탭에서 황금은 "선택됨", 칩에서 황금은 "주의"다. 이 중의성은 형태(탭 언더라인 vs 둥근 칩)와 위치로 해소하며, 실사용에서 혼동이 관측되면 ②의 `warning`을 재배치한다(되돌리기 비용은 토큰 1개 값 교체).

레퍼런스: 원게임 카드창 UI(정본), 거래소·핀테크 UI의 tabular 숫자, 다크 UI 대비 설계(WCAG 2.1 AA).

---

## 2. 색 토큰 (Color)

의미 기반(semantic) 토큰을 최상위로 둔다. 컴포넌트는 원색(`#0667BD` 같은 팔레트값)이 아니라 의미 토큰(`primary`, `surface`, `text`)을 참조한다 — 테마 전환·리브랜딩이 토큰 교체만으로 되게 하기 위함이다.

표기 규칙: **[실측]** = 원본 자산 픽셀 샘플링값(변경 금지, 게임 정본). **[파생]** = 실측값에서 웹 요구(대비·상태 단계)를 위해 계산한 값(조정 가능). 대비비는 전부 창 배경 `#001C33` 기준이며 WCAG 2.1 상대휘도 공식으로 계산했다(본문 AA 4.5:1 / 대형·UI 3:1).

### 2.1 크롬 팔레트 (게임 실측 — 이 시스템의 기준점)

| 토큰 | 값 | 원천 | 용도 |
|---|---|---|---|
| bg | #001C33 | [실측] 창 배경(자산의 52%) | 페이지 배경 — 이 색 위에서 모든 대비가 계산된다 |
| primary | #0667BD | [실측] 패널·헤더 파랑(19%) | 기본 액션·헤더·패널 강조 |
| border | #3394DE | [실측] 밝은 파랑 테두리 | 구분선·인풋/패널 테두리 (5.3:1 — UI 3:1 통과) |
| text | #FAF7D5 | [실측] 크림 | 본문 (**15.92:1** — 최상위 대비) |
| slot | #000000 | [실측] 이미지 슬롯 | 아이템 아트 슬롯 배경(아트가 검정 전제로 그려짐 — 다른 색 금지) |

`bg` 위 `text`가 15.92:1인 것이 이 팔레트의 최대 자산이다. 게임이 남색·크림 조합을 고른 이유가 여기 있다 — 장시간 열람에 유리하고 AA를 여유 있게 넘는다.

### 2.2 조작 계층 — 게임 상태 언어 ([1.2] ①)

게임 UI는 버튼·탭의 상태를 **명도가 아니라 hue 전환**으로 표현한다(normal/click 쌍 비교로 도출). 웹 관례(파랑을 어둡게)를 따르지 않고 게임을 따른다 — 이게 "전면 차용"의 실체다.

| 토큰 | 값 | 원천 | 상태 | 전경색 | 대비 |
|---|---|---|---|---|---|
| primary | #0667BD | [실측] | 기본 | `primary-fg` #FAF7D5 | 5.25:1 ✅ |
| primary-hover | #0560AD | [파생] 실측 파랑 −명도 | hover | #FAF7D5 | 5.89:1 ✅ |
| primary-pressed | #E25706 | [실측] 눌림 주황 | active/pressed | **#001C33** | 4.61:1 ✅ |
| primary-selected | #E2B206 | [실측] 활성 탭 황금 | 선택된 탭·현재 페이지 | **#001C33** | 8.74:1 ✅ |
| primary-disabled | #0A3A63 | [파생] 실측 파랑 −채도·명도 | 비활성 | `text-subtle` | — |

**hover는 게임에 없는 상태다** — 게임 자산은 normal/click 2종뿐이다(마우스 hover 전제 UI가 아니다). 그래서 [파생]인데, 이 팔레트에서 **채우기 색만으로는 hover가 안 보인다**: 밝히면 크림 전경이 AA를 깨고(#1E7FD4 = 3.83:1 미달), 어둡게 하면 대비는 벌지만 기본색과의 인접 대비가 1.12로 사실상 구분되지 않는다. → **hover = 채우기 미세 변화(#0560AD) + `border`를 #3394DE로 밝힘**의 조합으로 정의한다. 지각 신호는 테두리가 만들고 채우기는 거들기만 한다.

**전경색 판정 — 게임을 그대로 베끼면 깨지는 지점이다.** 주황·황금 위에 크림을 얹으면 3.45:1 · **1.82:1**로 AA를 크게 미달한다. 게임은 버튼 텍스트가 이미지에 구워져 있어(U-016) 이 문제를 겪지 않지만 **웹은 겪는다.** 따라서 주황·황금 버튼의 전경은 **창 배경 남색(#001C33)** 으로 반전한다(4.61 / 8.74). 색은 게임 그대로, 전경만 웹 요구로 보정한 것이다.

| focus-ring | #FAF7D5 | [실측 크림] | 포커스 링 — 크롬이 파랑 일색이라 파랑 링은 묻힌다. **`outline: 2px solid` + `outline-offset: 2px`** (테마 의존 → CSS 변수) |

**★ `outline-offset: 2px`는 장식이 아니라 AA 조건이다** (U-020 보정, 019 계산). offset이 있으면 링의 인접색은 **부모 표면뿐**이고 전건 통과한다(`bg` 15.92 · `surface` 13.50 · `surface-raised` 10.82 · `primary` **5.25** — 최악값). **offset을 0으로 줄이면 링이 요소 자체 채우기에 닿고 `primary-selected`(황금)에서 1.82:1, `success`에서 1.60:1로 무너진다** — 황금 위 크림이 AA를 깨는 것과 같은 수치다(전경 반전을 요구한 그 지점). 활성 탭·현재 페이지는 정확히 "포커스 가능한 것"이라 이게 급소다.

- **`:focus`가 아니라 `:focus-visible`을 쓴다** — 마우스 클릭마다 링이 뜨면 조작 계층([1.2] ①)이 지저분해진다. 키보드 도달성은 그대로다(`accessibility.md`).
- `overflow:hidden` 컨테이너가 offset을 자르는 자리에서는 **offset을 지우지 말고** `box-shadow` 2중 링으로 대체한다.

### 2.3 정보 계층 — 의미색 ([1.2] ②)

게임에 없는 축이다(게임은 *보여주는* UI, 웹은 *거래시키는* UI). 크롬 hue(파랑 206~208°)와 겹치지 않는 hue를 골랐다.

| 토큰 | 값 | hue | 대비 | 용도 |
|---|---|---|---|---|
| success | #4ADE80 | 142° | 9.93:1 ✅ | 낙찰·구매 완료·잔액 충분 |
| warning | #E2B206 | 47° | 8.74:1 ✅ | 마감 임박·주의(잔액 근접) — **게임 황금 재사용**([1.2] 한계 참조) |
| danger | #FF4D4D | 0° | 5.29:1 ✅ | 실패·유찰/종료·잔액 부족·취소 |
| info | #3394DE | 206° | 5.3:1 ✅ | 안내·중립 알림 — **크롬 테두리색 재사용**(중립 정보는 크롬과 같은 계열이 자연스럽다) |

- `-soft`(배경 톤)는 **해당 색 12% 알파를 `bg` 위에 합성**해 만든다. 다크 단일 스킨이라 라이트 테마용 파스텔 톤(`#DCFCE7` 등)은 불필요하며, 알파 합성이 토큰 수를 4개 줄인다.
- `-strong`은 두지 않는다 — 위 4색이 이미 `bg` 위에서 본문 AA를 통과해 별도 진한 톤이 필요 없다(다크 스킨의 이점).
- **색만으로 정보 전달 금지** — 아이콘/텍스트 병기(accessibility 2절). `warning`과 활성 탭 황금이 같은 값이라 이 규칙이 여기선 접근성 요구를 넘어 **의미 구분의 필수 조건**이다.

### 2.4 아이템 계층 — element ([1.2] ③, U-010)

등급(grade)/희귀도 축은 D-073으로 제거됐다(원게임 무등급). 시각 축은 속성(element)·레벨·골드포스·스킬이며 레어리티 티어 색은 없다.

**값은 아트에서 추출했다** — 속성별 `l` 81파일(9레벨 × 9종류) 전 픽셀을 HSV 히스토그램으로 집계해 최빈 색상군을 취했다(투명 키 컬러 `#0000FF`·검정 슬롯·무채색 제외).

| element 토큰 | 값 | hue | 대비 | 아트 실측 소견 |
|---|---|---|---|---|
| element-water | #19B2FF | 200° | 7.29:1 ✅ | 최빈군 그대로 |
| element-fire | #FF5500 | 20° | 5.4:1 ✅ | **최빈군 `#E62600`은 3.82:1로 AA 미달** → 2순위 군(#FF5500) 채택 |
| element-earth | #95B259 | 80° | 7.24:1 ✅ | **올리브/연두다. 종전 토큰의 amber(#D97706)는 오답이었다** |
| element-wind | #66CCCC | 180° | 9.12:1 ✅ | **청록(teal)이다. 종전 토큰의 green(#10B981)은 오답이었다** |

종전 4색은 "물=파랑, 불=빨강, 흙=amber, 바람=green"이라는 **관례 추정**이었고, 아트 실측은 흙·바람 2건에서 이를 반증했다. 칩 색이 카드 아트와 어긋나면 사용자는 같은 속성을 두 색으로 배운다 — 실측이 정본인 이유다.

배치 제약(계산 근거):

| 배치 | water | fire | 판정 |
|---|---|---|---|
| `bg`(#001C33) 위 | 7.29 | 5.4 | ✅ 허용 |
| `primary`(#0667BD) 위 | **2.4** | **1.78** | ❌ **금지** |

→ **element 칩은 창 배경 위에만 놓는다.** 패널·헤더 파랑 영역에 element 칩을 얹지 않는다.

주: 레벨은 강조 숫자(font-num, tabular-nums) — 단 아트에 레벨 배지가 구워져 있어 중복 표기 주의(P-013: 상세는 아트 위임, **목록 `s` 26×28은 판독성 판정 후 결정**). 골드포스는 잔여시간 칩(만료 임박 시 `warning`), 스킬1/2는 태그(`skillPercent` 병기). 색 위계로 "희귀함"을 나타내지 않는다(등급 폐기 정합).

### 2.5 표면 · 텍스트

`bg`·`primary`·`border`·`text`는 [2.1] 실측값이며, 아래는 그 사이를 메우는 [파생] 층이다.

| 토큰 | 값 | 대비(on bg) | 용도 |
|---|---|---|---|
| bg | #001C33 | — | 페이지 배경 [실측] |
| surface | #012A4A | 1.18:1 | 카드·패널 본체 — 경계는 명도가 아니라 `border`가 만든다(게임 방식) |
| surface-raised | #013A63 | 1.47:1 | 모달·팝오버·드로어 |
| surface-slot | #000000 | — | 아이템 아트 슬롯 [실측] |
| border | #3394DE | 5.3:1 | 테두리·구분선 [실측] |
| border-muted | #14496E | 1.82:1 | 약한 구분선(표 행 등) |
| text | #FAF7D5 | 15.92:1 | 본문 [실측] |
| text-muted | #B8C4D9 | 9.8:1 | 보조 텍스트 |
| text-subtle | #6B8CA6 | 4.88:1 | 캡션·placeholder (AA 통과 — placeholder도 읽혀야 한다) |
| primary-fg | #FAF7D5 | — | `primary` 위 텍스트 |
| on-accent-fg | #001C33 | — | `primary-pressed`·`primary-selected`·`warning` 위 텍스트 |

**테마 구조는 유지하되 라이트 값은 정의하지 않는다.** 게임 스킨은 단일 다크 계열이고(U-016), U-005(라이트/다크 양립)는 총괄이 ON-HOLD·후순위로 등재했다(095 [6절]). CSS 변수 구조는 그대로 두므로 라이트를 나중에 넣어도 구조 변경이 없다 — **지금 라이트 값을 지어내면 근거 없는 색이 정본에 박힌다.**

### 2.6 Tailwind 매핑 (theme.extend.colors)

```
colors: {
  // 조작 계층 — 게임 상태 언어(테마 무관 정적값)
  primary: { DEFAULT:'#0667BD', hover:'#0560AD', pressed:'#E25706', selected:'#E2B206', disabled:'#0A3A63', fg:'#FAF7D5' },
  'on-accent-fg': '#001C33',

  // 정보 계층 — 의미색(-soft 는 12% 알파 합성, 별도 토큰 없음)
  success:'#4ADE80', warning:'#E2B206', danger:'#FF4D4D', info:'#3394DE',

  // 아이템 계층 — 아트 실측(변경 금지)
  element: { water:'#19B2FF', fire:'#FF5500', earth:'#95B259', wind:'#66CCCC' },

  // 표면·텍스트 — CSS 변수 + [data-theme] 오버라이드(라이트 값은 U-005 확정 시 추가)
  bg:'var(--color-bg)', surface:'var(--color-surface)', 'surface-raised':'var(--color-surface-raised)',
  'surface-slot':'#000000',
  border:'var(--color-border)', 'border-muted':'var(--color-border-muted)',
  text:'var(--color-text)', 'text-muted':'var(--color-text-muted)', 'text-subtle':'var(--color-text-subtle)',
  'focus-ring':'var(--color-focus-ring)',
}
```

```css
:root, [data-theme="dark"] {
  --color-bg: #001C33;            --color-surface: #012A4A;
  --color-surface-raised: #013A63; --color-border: #3394DE;
  --color-border-muted: #14496E;   --color-text: #FAF7D5;
  --color-text-muted: #B8C4D9;     --color-text-subtle: #6B8CA6;
  --color-focus-ring: #FAF7D5;
}
```

**이 블록은 [2.1]~[2.5] 정의 절과 대조해 만든다(24토큰 전건).** v0.2 발행 시 `focus-ring`이 여기서 빠졌고, 드롭인 교체 블록(`outbox/017` [4])이 이 표를 베껴 같은 구멍을 물려받았다 — 프론트가 잡았다(`frontend/outbox/009`, 회신 `outbox/019`). **[2.6]이 핸드오프의 유일한 소비 표면인데 정의 절과 이중 관리라 벌어진다.**

**같은 hex `#FAF7D5`가 세 자리에 있고 처리가 셋 다 다르다 — 우연이 아니라 구조다.** `text`(변수, 표면 계열) · `focus-ring`(변수, 표면 위에 그려짐) · `primary.fg`(**정적**, 조작 계층은 테마 무관). 다크에서 우연히 일치할 뿐이고 라이트가 오면 앞의 둘만 바뀐다. **`text`로 통합하면 라이트에서 파랑 버튼 위 글자가 검정이 된다.**

**프론트 스켈레톤 영향(skeleton-plan [4] 정합)**: 구조는 그대로다 — 테마 무관 정적값 / 테마 의존 CSS 변수 2분할 유지, 값만 교체된다. 단 **토큰 3개가 신설**됐다: `primary.pressed`·`primary.selected`·`on-accent-fg`. 게임의 상태 언어가 명도가 아니라 hue 전환이라 종전 `primary-600/700`(어둡게) 스케일로는 표현되지 않기 때문이다. 종전 `primary-50/100/300/500/600/700` 6단 스케일은 **폐기**한다(게임 UI에 옅은 파랑 층이 없다 — 쓰지 않을 토큰이다). `accent-500/600`도 폐기하고 `warning`·`primary.selected`로 흡수했다. 프론트에 정보 공유로 통지한다(D-024, U-001 명칭 1:1 규약).

---

## 3. 타이포그래피 (Typography)

| 토큰 | 값 | 비고 |
|---|---|---|
| font-sans | Pretendard, -apple-system, "Segoe UI", Roboto, sans-serif | UI 기본(U-003) |
| font-num | font-sans + `font-variant-numeric: tabular-nums` | 금액·카운트다운·수량. 폭 고정으로 갱신 시 레이아웃 점프 방지 |

타입 스케일(rem, 16px base):

| 토큰 | size/line | 용도 |
|---|---|---|
| text-xs | 0.75/1.0 | 캡션·뱃지 |
| text-sm | 0.875/1.25 | 보조 본문·메타 |
| text-base | 1.0/1.5 | 본문 기본 |
| text-lg | 1.125/1.75 | 강조 본문·카드 제목 |
| text-xl | 1.25/1.75 | 섹션 제목 |
| text-2xl | 1.5/2.0 | 페이지 제목 |
| text-3xl | 1.875/2.375 | 상세 히어로(현재가 등) |

굵기: regular 400 / medium 500 / semibold 600 / bold 700. 제목은 600~700, 본문 400~500. 금액 강조는 semibold + font-num.

Tailwind: `fontFamily.sans`/`fontFamily.num`에 매핑. 숫자 강조는 유틸 `tabular-nums`도 사용 가능하나, 금액·시간 컴포넌트는 `font-num` 토큰으로 통일 권장.

---

## 4. 간격 · 반경 · 그림자 · 모션

간격(spacing): 4px 기준 배수 — Tailwind 기본 스케일 준용(1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64). 컴포넌트 내부 패딩은 2~4, 섹션 간격은 6~12를 기본으로 한다.

반경(radius):

| 토큰 | 값 | 용도 |
|---|---|---|
| rounded-sm | 4px | 뱃지·칩 |
| rounded-md | 8px | 버튼·인풋 |
| rounded-lg | 12px | 카드 |
| rounded-xl | 16px | 모달·큰 패널 |
| rounded-full | 9999px | 아바타·상태 점 |

그림자(shadow) — 다크에선 그림자보다 표면 밝기 차로 레이어 표현:

| 토큰 | 라이트 | 다크 |
|---|---|---|
| shadow-sm | 0 1px 2px rgba(15,23,42,.06) | 없음(surface-raised 밝기 차로 대체) |
| shadow-md | 0 4px 12px rgba(15,23,42,.10) | 0 4px 12px rgba(0,0,0,.4) |
| shadow-lg | 0 12px 32px rgba(15,23,42,.14) | 0 12px 32px rgba(0,0,0,.5) |

모션(motion):

| 토큰 | 값 | 용도 |
|---|---|---|
| duration-fast | 120ms | hover·포커스·토글 |
| duration-base | 200ms | 모달·드롭다운 열림 |
| duration-slow | 320ms | 페이지 전환·토스트 |
| ease-standard | cubic-bezier(0.4, 0, 0.2, 1) | 기본 |

접근성: `prefers-reduced-motion` 존중 — 감소 모드에선 트랜지션/애니메이션 최소화(카운트다운 값 갱신은 유지하되 트윈 제거).

---

## 5. 컴포넌트 스펙 (핸드오프 핵심)

각 컴포넌트는 상태(default/hover/focus/active/disabled/error/loading)·변형·사용 토큰·반응형·접근성을 명세한다(ux/rules.md 4절). 모바일 우선. 아래는 v0 우선 세트(U-007).

### 5.1 Button

- variant: `primary`(bg-primary / text-primary-fg) · `outline`(border + text) · `ghost`(투명 + text) · `danger`(bg-danger / text-on-accent-fg).
  **`accent` variant는 폐기**(U-020) — 종전 accent(amber)는 조작 계층에서 게임 활성 황금과 충돌한다([1.2]). 즉시구매·입찰 CTA의 강조는 **색이 아니라 크기·배치**(lg + 주 액션 위치)로 만든다.
- size: sm(h32, px3, text-sm) · md(h40, px4, text-base) · lg(h48, px5, text-lg). 반경 rounded-md.
- 상태(게임 상태 언어, [2.2]): hover(`primary-hover` + `border`를 #3394DE로 밝힘 — 채우기만으론 지각 안 됨) / focus(`focus-ring` 크림 2px + offset 2px — 크롬이 파랑 일색이라 파랑 링은 묻힌다) / **active·pressed(`primary-pressed` 주황 + 전경 `on-accent-fg` 남색 — 명도가 아니라 hue가 바뀐다)** / disabled(`primary-disabled` + `text-subtle`, pointer-none) / loading(스피너 + 라벨 유지 또는 "처리 중", 중복 클릭 차단).
- 접근성: 최소 타깃 44x44(sm은 터치 맥락에서 md 사용). 아이콘 전용 버튼은 aria-label 필수. loading 시 aria-busy.
- 예: 입찰=primary md, 즉시구매=primary lg(크기로 강조), 취소=ghost/danger, 로그인=primary lg.

### 5.2 Field (Input · Select · NumberInput)

- 구성: 라벨(label for=id) + 인풋 + 힌트/에러 텍스트. 라벨은 항상 가시(placeholder를 라벨 대용 금지).
- 상태: default(border) / focus(border-primary + focus-ring) / error(border-danger + 에러 메시지 aria-describedby) / disabled.
- NumberInput(금액·입찰가): font-num, 우측 단위(게임머니) suffix, 최소 증분/상한 힌트 표시(계약 BID_001·BID_002 대응). 서버 검증 실패 시 계약 에러코드→필드 에러 매핑.
- **Checkbox** (U-020 신설 — 계약 v1.4 [2.5] 델타): 게임 자산에 체크박스가 없어 전량 CSS 재현이다.
  - 상태: default(`border` 1px, 투명 채우기) / checked(`primary` 채우기 + `primary-fg` 체크 표시) / focus(`focus-ring`) / disabled / **error**(`border-danger` — 미동의 상태로 제출 시도).
  - 타깃 44×44(시각 박스는 20×20, 히트 영역을 라벨까지 확장). 라벨 클릭으로 토글(`label for`), `aria-describedby`로 경고문 연결.
  - 용도: **탈퇴 명시 동의**(미체크 시 제출 버튼 `disabled` + 비활성 사유 문장 병기 — 사유 없는 비활성은 금지), 약관 동의.
  - **신설 사유**: v0 우선 세트(U-007)에 Checkbox가 없었다. v1.4 `DELETE /me`가 "동의 누락 시 400"을 규정해(계약 [2.5]) 동의 체크가 계약상 필수 입력이 됐는데, 세트에 대응 컴포넌트가 없었다 — wireframe-member.html에 구조로만 존재했다.
- 반응형: 폼은 모바일 1열, ≥md 2열 그리드 가능. 터치 타깃 h44 이상.

### 5.3 ItemCard (매물 카드)

- 용도: 경매·고정가 목록의 매물 표시(계약 §3.3 AuctionSummary·ShopSummary + item 블록).
- 구조(U-012 — 게임 이미지 + 웹 상거래 정보 결합): 세로형 카드. [상단] 게임 카드 이미지 슬롯(사용자 제공 게임 아트, 원본 카드 형태·비율 유지) + 오버레이(레벨·속성은 게임 아트에 이미 포함될 수 있음). [하단 웹 상거래 영역] 아이템명(nameSnapshot)·가격(경매 highestBidAmount 또는 startPrice / 고정가 price, font-num)·카운트다운(경매 endAt)·입찰수(bidCount)·판매유형 칩·판매자(sellerNickname). 게임 카드에 없는 상거래 정보는 이 하단 영역이 담당.
- 게임 아트 밖에서 웹이 별도 표기할 때만 ElementBadge(속성) 사용. 등급/희귀도 표현 없음(D-073). 속성은 색+속성명 텍스트 병기(색만 전달 금지).
- 이미지 파이프라인: 게임 카드 아트는 typeCode(item_template) 기준 자산으로 매핑(사용자 제공). 자산 부재 시 플레이스홀더.
- 상태: default/hover(surface-raised + shadow-md·다크는 밝기차) / loading(스켈레톤) / 종료(딤 처리 + "마감/판매완료" 오버레이).
- 반응형: 목록 그리드 1열(모바일)→2(sm)→3(lg)→4(xl). 카드 내부는 세로 스택.

### 5.4 ListGrid + SearchFilterBar

- ListGrid: ItemCard 반응형 그리드 + 빈 상태 + 로딩 스켈레톤 + 무한스크롤 센티넬(cursor) 또는 페이지네이션(offset).
- SearchFilterBar(계약 §3 공통 필터, 등급 없음 D-073): mainCategory·subGroup·element·kind·minLevel/maxLevel·skill1/skill2·goldforceActive·minPrice/maxPrice·status. 정렬은 화이트리스트만(경매 price·endAt·createdAt·highestBidAmount / 고정가 price·endAt·createdAt). 모바일은 필터를 시트/드로어로, 데스크톱은 좌측 레일 또는 상단 바.
- 접근성: 필터 컨트롤 키보드 조작, 적용된 필터는 제거 가능한 칩으로 표시(현재 상태 가시화).

### 5.5 Modal / Dialog

- 용도: 입찰 확인, 즉시구매 확인, 판매자 취소 확인, 교환 실행 등.
- 구조: 오버레이(scrim) + surface-raised 패널 + 제목 + 본문 + 액션(우측 하단, 주 액션 우측).
- 접근성: role=dialog, aria-modal, 열릴 때 포커스 트랩·첫 포커스 이동, 닫을 때 트리거로 복귀, Esc 닫기, 스크린리더 제목 연결(aria-labelledby).
- 상태: 확인 액션 loading(중복 제출 차단). 파괴적 액션(취소·강제취소)은 danger 버튼.

### 5.6 Toast / Notification

- 용도: 입찰 성공·상위 입찰 발생·낙찰·구매 완료·에러 알림.
- 배치: 화면 상단 또는 하단 고정, 자동 소멸(성공 3~4s) + 수동 닫기. 에러는 자동 소멸 지양(사용자 확인).
- variant: success/warning/danger/info(의미색 + 아이콘 + 텍스트). 접근성: aria-live(polite=정보, assertive=에러). 색만으로 구분 금지.
- **rate limit(`GATEWAY_429`) 표현** (U-020 신설 — 계약 v1.3 [1.6] 델타): `warning` 토스트 + **`Retry-After` 초를 카운트다운으로 노출**하고, 그동안 트리거 버튼을 `disabled`로 잠근다. 카피는 사용자 잘못이 아니라 대기임을 말한다 — "요청이 많습니다. N초 후 다시 시도할 수 있습니다"(Countdown 컴포넌트 [5.9] 재사용, 신규 파서·신규 컴포넌트 없음).
  - 특히 로그인·가입 연속 시도에서 발생한다(SEC-005 인증 계열 rate limit). 가입 성공 → 자동 로그인을 하지 않기로 한 P-010의 근거도 이 429다 — **같은 위험을 플로우와 토스트 양쪽에서 막는다.**
  - `GATEWAY_403`(게이트웨이 미경유 직접접근)은 **디자인 무영향** — 계약 [1.6]이 "정상 경유 클라이언트는 만나지 않으며 QA·보안의 음성 테스트 기준으로만 명세한다(프론트 별도 처리 불요)"고 명시했다. 화면 표현을 만들지 않는다.

### 5.7 Pagination

- cursor(무한스크롤): 경매·고정가·임시보관·주문·충전내역 — 센티넬 관찰 + "더 보기" 폴백 버튼(키보드·스크린리더 접근). hasNext=false 시 종료 표시.
- offset(페이지 번호): item-templates·입찰내역 — 이전/다음 + 현재 페이지. 총페이지 표시.

### 5.8 Badge / StatusChip (+ ElementBadge)

- StatusChip: 경매 status(SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED)·고정가(ACTIVE/SOLD/EXPIRED/CANCELLED)·주문 상태. **의미색 12% 알파 배경 + 의미색 텍스트 + 상태명**([2.3] — `-soft`/`-strong` 토큰은 폐기, 알파 합성으로 대체). 색+텍스트(+아이콘) 병기.
- ElementBadge: element 색([2.4] 아트 실측값) + **속성명/아이콘 필수 병기**. **`bg` 위에만 배치**([2.4] 배치 제약 — 패널 파랑 위에서 water 2.4:1 · fire 1.78:1로 무너진다). 등급(GradeBadge)은 D-073으로 폐기 — 사용 금지.
- resultType(BID/BUYNOW)은 보조 라벨로 표기(낙찰 사유).

### 5.9 Countdown (마감 카운트다운)

- 용도: 경매 남은 시간. font-num, `HH:MM:SS` 또는 `Nd HH:MM`. 폴링 기준(U-006) 서버 endAt과 동기.
- 임박 단계 색 전이: 여유(text-muted)→임박 T-5분(warning)→T-30초 소프트클로즈 윈도우(danger·강조). 소프트클로즈로 endAt 연장 시 즉시 반영(값 점프 허용, 트윈 최소).
- 접근성: aria-live=off(초당 갱신 스팸 방지), 대신 임박/마감 전환 시점에만 폴라이트 안내. 종료 시 "마감" 정적 표시.

### 5.10 MoneyAmount (금액 표시)

- 용도: 게임머니·캐시·수수료·정산액. font-num + 단위 라벨. 잔액 4종(cashBalance·gameMoneyBalance·gameMoneyHeld·gameMoneyAvailable)은 라벨로 구분(특히 held=홀드/available=가용).
- 부족 상태(BID_005·SHOP_005·EXC_001) 강조 시 danger. 큰 금액은 천단위 구분. 통화 혼동 방지 — 캐시/게임머니 아이콘·색 구분.

---

## 6. 프론트 매핑 요약

- 토큰 → `tailwind.config.js theme.extend`(2.5·3·4절 표) + 테마 변수는 전역 CSS(:root / [data-theme=dark]).
- 컴포넌트 → 프론트 `components/`(공용: Button·Field·Modal·Toast·Pagination·MoneyAmount·Countdown·SearchFilterBar) / feature별(ItemCard는 item, StatusChip은 도메인 상태).
- 상태·에러 → 계약 §5 ErrorCode 상수와 1:1 매핑(frontend/CLAUDE.md 5절). 필드 에러·토스트 카피는 ux-flows.md 참조.
