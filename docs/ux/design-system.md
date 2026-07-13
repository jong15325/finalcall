# FinalCall 디자인 시스템 (design-system.md)

상태: DRAFT v0 — 디자인 초안. 비주얼 방향(1절)·기본 테마는 총괄/사용자 결정 대기(outbox/001).
소유: 디자인(UX/UI)
근거: api-contract v1.1(최상위), erd v0.2(item_template.element/grade), frontend/CLAUDE.md 5절, design-guide 3·4절, U-001~007
기준: 계약이 최상위. 이 문서는 프론트 구현의 참고 지침이며 계약·도메인 규칙과 충돌 시 계약 우선.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0 | 2026-07-14 | 초안 — 비주얼 방향(선택지), 토큰(색·타이포·간격·반경·그림자·모션) + Tailwind 매핑, 우선 컴포넌트 스펙 |

핸드오프 원칙: 토큰명은 프론트 Tailwind 유틸과 1:1(U-001). 이 표의 키를 `tailwind.config.js` `theme.extend`에 그대로 넣으면 `bg-primary`, `text-muted`, `rounded-lg` 등으로 사용된다.

---

## 1. 비주얼 방향 (톤·무드) — 결정 요청

FinalCall은 두 성격이 겹친다: (1) 실시간 경쟁·희소템 거래의 게임 감성, (2) 캐시 충전·게임머니 정산이 오가는 자금 시스템의 신뢰감. 방향은 이 둘의 균형점이다. 아래 3안 중 택1이며, 어느 안이든 토큰 구조는 동일하고 색값·기본 테마만 달라진다.

| 안 | 무드 | 기본 테마 | primary | 강점 | 약점 |
|---|---|---|---|---|---|
| A. Dark Arena (추천) | 경매장·게임 인벤토리. 어두운 표면에 희소 등급색이 도드라짐 | 다크 우선(라이트 병행) | 일렉트릭 인디고 | 게임 몰입·등급 스캔성·장시간 열람 피로 저감. 카운트다운/즉시구매 amber가 강하게 튐 | 다크에서 대비 설계 신중 필요 |
| B. Clean Marketplace | 핀테크·마켓(토스 결제 연동 톤과 조화) | 라이트 우선 | 트러스트 블루 | 자금 신뢰·넓은 접근성·구현 단순 | 게임 개성 약함 |
| C. Neon Night | 고대비 다크 + 네온 시안/마젠타 | 다크 | 네온 시안 | 강한 게임 임팩트 | 자금 신뢰감·WCAG 대비 리스크 큼 |

추천: A(Dark Arena). 근거 — 타깃(게임 아이템 트레이더)의 다크 선호, 등급/속성 색이 어두운 표면에서 가장 잘 읽힘, 마감 임박·즉시구매 같은 긴급 상태를 amber로 강조하기 유리. 자금 신뢰는 라이트 테마 병행(U-005)과 절제된 채도로 확보. 아래 토큰의 기본 색값은 A안 기준으로 제시하되, B/C 채택 시 primary·기본 테마만 교체한다.

레퍼런스: 게임 레어리티 색 관례(공통/희귀/영웅/전설 티어), 거래소·핀테크 UI의 tabular 숫자·절제된 채도, 다크 UI 대비 설계(WCAG 2.1 AA).

---

## 2. 색 토큰 (Color)

의미 기반(semantic) 토큰을 최상위로 둔다. 컴포넌트는 원색(indigo-500 같은 팔레트값)이 아니라 의미 토큰(`primary`, `surface`, `text`)을 참조한다 — 테마 전환·리브랜딩이 토큰 교체만으로 되게 하기 위함이다.

### 2.1 브랜드 · 액션 팔레트 (A안 기준)

| 토큰 | 값(hex) | 용도 |
|---|---|---|
| primary-50 | #EEF0FF | 옅은 배경·선택 상태 |
| primary-100 | #E0E3FF | hover 배경(라이트) |
| primary-300 | #A5AEFF | 보조 강조·비활성 primary |
| primary-500 | #6366F1 | 기본 primary(버튼·링크·포커스) |
| primary-600 | #4F52D6 | primary hover/active |
| primary-700 | #3E40AD | pressed |
| accent-500 | #F59E0B | 긴급·강조: 즉시구매·마감 임박·입찰 CTA |
| accent-600 | #D97706 | accent hover |

주: A안 primary=indigo. B안 채택 시 primary=트러스트 블루(#2563EB 계열), C안 채택 시 primary=네온 시안. accent(amber)는 세 안 공통 — 긴급 신호는 브랜드색과 분리해야 상태 인지가 명확.

### 2.2 의미색 (Semantic state)

| 토큰 | 값 | 용도 |
|---|---|---|
| success | #16A34A | 낙찰·구매 완료·잔액 충분 |
| warning | #F59E0B | 마감 임박·주의(잔액 근접) |
| danger | #DC2626 | 실패·마감/종료·잔액 부족·취소 |
| info | #2563EB | 안내·중립 알림 |

각 색은 배경용 옅은 톤(`-soft`)과 전경 텍스트용 진한 톤(`-strong`)을 함께 둔다(예: `success-soft` #DCFCE7 / `success-strong` #15803D). 색만으로 정보 전달 금지 — 반드시 아이콘/텍스트 병기(accessibility 2절).

### 2.3 등급(grade) · 속성(element) — 아이템 도메인 (U-004)

element(4종 확정, erd)와 grade(레어리티 티어)는 아이템 카드·필터의 핵심 시각 축이다.

| element 토큰 | 값 | 매핑 |
|---|---|---|
| element-water | #3B82F6 | 물 |
| element-fire | #EF4444 | 불 |
| element-earth | #D97706 | 흙 |
| element-wind | #10B981 | 바람 |

| grade 토큰 | 값 | 잠정 티어 |
|---|---|---|
| grade-1 | #9CA3AF | 일반(gray) |
| grade-2 | #22C55E | 고급(green) |
| grade-3 | #3B82F6 | 희귀(blue) |
| grade-4 | #A855F7 | 영웅(purple) |
| grade-5 | #F59E0B | 전설(gold) |

미확정 참고: erd `grade`는 INT 축으로 값 목록 미명시. 실제 등급 단계 수 확정 시 티어를 1:1 고정한다(기획 확인 대상, U-004). 티어 수가 5와 다르면 스케일을 확장/축소한다.

### 2.4 중립 · 표면 · 텍스트 (테마별)

의미 토큰은 라이트/다크 두 값을 가진다(U-005). 프론트는 `data-theme`/클래스 토글로 값만 바꾼다.

| 토큰 | 라이트 | 다크(A안 기본) | 용도 |
|---|---|---|---|
| bg | #F8FAFC | #0B0F1A | 페이지 배경 |
| surface | #FFFFFF | #141A29 | 카드·패널 |
| surface-raised | #FFFFFF | #1C2436 | 모달·팝오버(상단 레이어) |
| border | #E2E8F0 | #2A3448 | 구분선·인풋 테두리 |
| text | #0F172A | #E8EDF7 | 본문 |
| text-muted | #475569 | #9AA7BD | 보조 텍스트 |
| text-subtle | #94A3B8 | #6B7890 | 캡션·placeholder |
| primary-fg | #FFFFFF | #FFFFFF | primary 위 텍스트 |
| focus-ring | #6366F1 | #8B8FF5 | 포커스 링(대비 확보) |

중립 팔레트 원천은 slate 계열(gray-50…gray-950)로 두고, 위 의미 토큰이 이를 참조한다. 대비 검증은 accessibility.md 참조.

### 2.5 Tailwind 매핑 (theme.extend.colors)

```
colors: {
  primary: { 50:'#EEF0FF',100:'#E0E3FF',300:'#A5AEFF',500:'#6366F1',600:'#4F52D6',700:'#3E40AD', DEFAULT:'#6366F1' },
  accent:  { 500:'#F59E0B',600:'#D97706', DEFAULT:'#F59E0B' },
  success:'#16A34A', warning:'#F59E0B', danger:'#DC2626', info:'#2563EB',
  element: { water:'#3B82F6', fire:'#EF4444', earth:'#D97706', wind:'#10B981' },
  grade:   { 1:'#9CA3AF',2:'#22C55E',3:'#3B82F6',4:'#A855F7',5:'#F59E0B' },
  // 표면/텍스트는 CSS 변수로: bg-[var(--bg)] 또는 theme 확장 + [data-theme] 오버라이드
  bg:'var(--color-bg)', surface:'var(--color-surface)', 'surface-raised':'var(--color-surface-raised)',
  border:'var(--color-border)', text:'var(--color-text)', 'text-muted':'var(--color-text-muted)',
}
```

권장: 테마 의존 토큰(표면/텍스트)은 CSS 변수로 정의하고 `[data-theme="dark"]`에서 값을 오버라이드, Tailwind는 `var()` 참조. 테마 무관 토큰(primary·grade·element)은 정적값. 이로써 다크/라이트 전환이 클래스 토글 1회로 끝난다(U-005).

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

각 컴포넌트는 상태(default/hover/focus/active/disabled/error/loading)·변형·사용 토큰·반응형·접근성을 명세한다(design-guide 4절). 모바일 우선. 아래는 v0 우선 세트(U-007).

### 5.1 Button

- variant: `primary`(bg-primary/primary-fg) · `accent`(bg-accent — 즉시구매·입찰 CTA) · `outline`(border+text) · `ghost`(투명+text) · `danger`(bg-danger).
- size: sm(h32, px3, text-sm) · md(h40, px4, text-base) · lg(h48, px5, text-lg). 반경 rounded-md.
- 상태: hover(600 톤) / focus(focus-ring 2px 오프셋) / active(700, 살짝 축소 없음) / disabled(투명도 40%·pointer-none) / loading(스피너 + 라벨 유지 또는 "처리 중", 중복 클릭 차단).
- 접근성: 최소 타깃 44x44(sm은 터치 맥락에서 md 사용). 아이콘 전용 버튼은 aria-label 필수. loading 시 aria-busy.
- 예: 입찰=accent md, 즉시구매=accent lg(강조), 취소=ghost/danger, 로그인=primary.

### 5.2 Field (Input · Select · NumberInput)

- 구성: 라벨(label for=id) + 인풋 + 힌트/에러 텍스트. 라벨은 항상 가시(placeholder를 라벨 대용 금지).
- 상태: default(border) / focus(border-primary + focus-ring) / error(border-danger + 에러 메시지 aria-describedby) / disabled.
- NumberInput(금액·입찰가): font-num, 우측 단위(게임머니) suffix, 최소 증분/상한 힌트 표시(계약 BID_001·BID_002 대응). 서버 검증 실패 시 계약 에러코드→필드 에러 매핑.
- 반응형: 폼은 모바일 1열, ≥md 2열 그리드 가능. 터치 타깃 h44 이상.

### 5.3 ItemCard (매물 카드)

- 용도: 경매·고정가 목록의 매물 표시(계약 GET /auctions·/shops 요약 + item 스냅샷).
- 해부: 썸네일/아이콘 · 아이템명(text-lg semibold) · GradeBadge · ElementBadge · 레벨·스킬 요약 · 가격(현재가 또는 정가, font-num) · 상태/카운트다운(경매) · 판매유형 칩(경매/즉시구매/고정가).
- 등급 색은 카드 좌측 보더/뱃지로 표기(grade 토큰). 등급을 색만으로 전달 금지 — 등급명 텍스트 병기.
- 상태: default/hover(surface-raised + shadow-md·다크는 밝기차) / loading(스켈레톤) / 종료(딤 처리 + "마감/판매완료" 오버레이).
- 반응형: 목록 그리드 1열(모바일)→2(sm)→3(lg)→4(xl). 카드 내부는 세로 스택.

### 5.4 ListGrid + SearchFilterBar

- ListGrid: ItemCard 반응형 그리드 + 빈 상태 + 로딩 스켈레톤 + 무한스크롤 센티넬(cursor) 또는 페이지네이션(offset).
- SearchFilterBar(계약 §3 공통 필터): mainCategory·subGroup·element·kind·grade·minLevel/maxLevel·skill1/skill2·goldforceActive·minPrice/maxPrice·status. 정렬은 화이트리스트만(경매 price·endAt·createdAt·highestBidAmount / 고정가 price·endAt·createdAt). 모바일은 필터를 시트/드로어로, 데스크톱은 좌측 레일 또는 상단 바.
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

### 5.7 Pagination

- cursor(무한스크롤): 경매·고정가·임시보관·주문·충전내역 — 센티넬 관찰 + "더 보기" 폴백 버튼(키보드·스크린리더 접근). hasNext=false 시 종료 표시.
- offset(페이지 번호): item-templates·입찰내역 — 이전/다음 + 현재 페이지. 총페이지 표시.

### 5.8 Badge / StatusChip (+ GradeBadge / ElementBadge)

- StatusChip: 경매 status(SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED)·고정가(ACTIVE/SOLD/EXPIRED/CANCELLED)·주문 상태. 의미색 soft 배경 + strong 텍스트 + 상태명. 색+텍스트(+아이콘) 병기.
- GradeBadge: grade 토큰 색 + 등급명. ElementBadge: element 색 + 속성명/아이콘.
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
