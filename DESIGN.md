---
theme: light
base:
  bg: "#FAFAFA"
  surface: "#FFFFFF"
  surface-sunken: "#F4F4F5"
  slot: "#000000"
text:
  text: "#18181B"
  text-muted: "#52525B"
  text-subtle: "#71717A"
border:
  border: "#E4E4E7"
  border-muted: "#F1F1F3"
  border-strong: "#8A8A8F"
primary:
  primary: "#6E2A9F"
  primary-hover: "#5C2185"
  primary-pressed: "#491A6C"
  primary-soft: "#F1EAF5"
  primary-fg: "#FFFFFF"
  ink: "#18181B"
semantic:
  success: "#14742F"
  warning: "#A0510A"
  danger: "#C81E1E"
  info: "#1D4ED8"
element:
  water: "#19B2FF"
  fire: "#FF5500"
  earth: "#95B259"
  wind: "#66CCCC"
radius:
  sm: "4px"
  md: "6px"
  lg: "8px"
---

# FinalCall Design (웹 클라이언트)

게임 아이템 경매 플랫폼의 프론트엔드 비주얼 시스템. **무신사(미니멀 에디토리얼 커머스)와 마켓컬리(화이트 베이스 + 프리미엄 퍼플)를 참조**하되 값·형태는 FinalCall 고유로 창작한다(자산·hex 복제 금지). 게임 감성은 **아이템 표시(카드·속성 배지)에만** 부분 차용한다. 정본은 `docs/ux/design-system.md`이며 이 파일은 impeccable용 요약이다. (개정 제안 단계 — 4개 열린 질문 확정 시 갱신)

## Overview

**Creative North Star: "신뢰가 먼저 보이는 커머스, 게임은 아이템에서만 드러난다"**

**Key Characteristics:**
- 라이트 커머스 베이스 — 오프화이트 배경, near-black 텍스트, 얇은 그레이 선(무신사식 각진·절제)
- 고유 딥퍼플 브랜드 액센트(컬리 무드 참조, 컬리색 미복제)
- 이원 구조 — 계정·거래 화면엔 게임색 전무, 아이템 카드가 게임이 드러나는 유일한 창
- 강한 타입 위계 + 넉넉한 여백, 낮은 반경(4~8px)
- WCAG 2.1 AA 전건 계산 검증

자금(캐시·게임머니)을 다루는 거래 플랫폼이라 화면의 첫인상은 신뢰감이어야 한다. 무신사식 미니멀 에디토리얼로 크롬을 조용히 두고, 컬리계 퍼플을 브랜드 포인트로 절제해 쓴다. 게임 팔레트(원게임 아트 실측 element 4색·검정 슬롯)는 아이템 카드·속성 배지로 격리해, 커머스 신뢰감과 게임 감성이 한 화면에서 충돌하지 않게 한다.

## Colors

라이트 베이스(#FAFAFA/#FFFFFF) 위 전 토큰 대비를 sRGB 상대휘도로 계산 검증했다. 조작색(primary)·의미색·아이템색(element)은 계층으로 분리하며 한 컴포넌트 안에서 섞지 않는다.

### Base
- **bg** (#FAFAFA): 페이지 배경(오프화이트).
- **surface** (#FFFFFF): 카드·패널·인풋 표면.
- **surface-sunken** (#F4F4F5): 함몰 존·비활성 인풋.
- **slot** (#000000): 아이템 아트 슬롯 배경 — 아이템 표시 전용.

### Neutral
- **text** (#18181B): 본문 near-black · 17.7:1.
- **text-muted** (#52525B): 보조 텍스트 · 7.7:1.
- **text-subtle** (#71717A): 캡션·placeholder · 4.8:1.
- **border** (#E4E4E7): 카드·구분선(장식선).
- **border-strong** (#8A8A8F): 인풋·컨트롤 경계 · 3.4:1(WCAG 1.4.11 충족).

### Primary
- **Primary** (#6E2A9F): 기본 액션·브랜드 포인트(고유 딥퍼플) · 흰 글자 8.4:1.
- **Primary hover** (#5C2185): hover(명도 낮춤).
- **Primary pressed** (#491A6C): pressed.
- **Primary soft** (#F1EAF5): 선택·ghost hover 배경.
- **Ink** (#18181B): 무신사식 블랙 CTA 대안(열린 질문 — CTA를 퍼플 vs 블랙).

### Semantic
- **Success** (#14742F): 완료·충분 · 5.9:1.
- **Warning** (#A0510A): 임박·주의 · 5.7:1.
- **Danger** (#C81E1E): 실패·부족·파괴적 액션 · 5.7:1.
- **Info** (#1D4ED8): 안내·중립 · 6.7:1.

### Element (아이템 표시 전용 · 아트 실측 불변)
- **Water** (#19B2FF): 물 속성 — 흰 위 텍스트 2.4:1로 무너지므로 소프트 틴트 배경 + near-black 라벨 + solid 도트로 사용.
- **Fire** (#FF5500): 불 속성 — 동일 패턴.
- **Earth** (#95B259): 흙 속성(올리브/연두, 아트 실측) — 동일 패턴.
- **Wind** (#66CCCC): 바람 속성(청록, 아트 실측) — 동일 패턴.

**The Game-Color Containment Rule.** element 4색과 검정 슬롯은 아이템 카드·속성 배지·아이템 필터 칩에만 쓴다. 버튼·탭·인풋·크롬·페이지 배경·본문·링크·내비에는 절대 쓰지 않는다 — 게임색이 조작/크롬으로 새면 이원 구조가 무너지고 커머스 신뢰감이 흐려진다.

**The Element-On-Light Rule.** element색은 라이트 배경에서 텍스트/선으로 쓰면 대비가 무너진다(water 2.37:1). 반드시 소프트 틴트 배경 + near-black 라벨 + solid 도트로 역할을 반전해 쓴다. 아트 hex는 불변, 전경만 뒤집는다.

## Typography

**Display Font:** system-ui (with -apple-system, "Pretendard", "Segoe UI", Roboto, sans-serif)
**Body Font:** system-ui (with -apple-system, "Pretendard", "Segoe UI", Roboto, sans-serif)

**Character:** 무신사식 강한 위계 — 굵기·크기 대비를 크게 두고 자간을 절제한다. 금액·수량·카운트다운은 tabular-nums로 폭을 고정해 갱신 시 레이아웃 점프를 막는다. 외부 웹폰트 CDN 의존 없이 시스템 폰트 스택으로 한글·라틴을 함께 처리한다.

### Hierarchy
- **Display** (system-ui, weight 800, letter-spacing -0.03em): 로고·페이지 히어로.
- **Heading** (system-ui, weight 700, letter-spacing -0.01em): 섹션·카드 제목.
- **Body** (system-ui, weight 400-500, line-height 1.5): 본문 기본.
- **Label** (system-ui, weight 700, uppercase, letter-spacing 0.14em): eyebrow·구분 라벨.
- **Numeric** (system-ui, tabular-nums, weight 700-800): 금액·잔액·카운트다운.

## Elevation

다크가 아니라 라이트 베이스라 그림자가 실제 부양(elevation)에 쓰인다. 게임스킨식 "표면 밝기차"가 아니라 은은한 드롭섀도로 카드를 띄운다.

- **Card** (`box-shadow: 0 4px 12px rgba(15,23,42,.08), 0 1px 3px rgba(15,23,42,.06)`): 인증 카드 등 부양 표면.
- **Item hover** (`box-shadow: 0 8px 24px rgba(15,23,42,.10)`): 아이템 카드 hover 부양.

## Components

### Button
- **Primary:** primary(#6E2A9F) 채움 + 흰 글자. hover 명도 낮춤, pressed 더 낮춤. 높이 44px, 반경 6px.
- **Ink:** near-black(#18181B) 채움 — 무신사식 블랙 CTA 대안(열린 질문).
- **Outline:** surface 배경 + border-strong 경계 + text. 보조 액션.
- **Ghost:** 투명 + primary 텍스트, hover는 primary-soft 배경. 최소 강조.
- **Danger:** danger(#C81E1E) 채움 — 탈퇴 등 파괴적 액션.

### Field
- **Default:** border-strong 경계(1.4.11 대비), 높이 44px, 반경 6px, 라벨 항상 가시.
- **Focus:** primary 경계 + primary-soft 링(box-shadow 3px).
- **Error:** danger 경계 + danger-soft 링 + aria-describedby 에러 메시지. 서버 에러코드(AUTH/MEMBER_001)→필드 에러 매핑.
- **Checkbox:** 미체크 시 제출 disabled + 비활성 사유 병기(탈퇴 동의 D-080). 게임 자산에 없어 CSS 재현.

### ItemCard
- **Art slot:** 검정(#000000) 배경 아이템 아트 슬롯 — 게임이 드러나는 유일한 창.
- **Element badge:** element 소프트 틴트 배경 + near-black 라벨 + solid 도트(색만 전달 금지).
- **Commerce info:** 이름·가격(tabular-nums)·카운트다운·판매자·상태 칩은 전부 커머스 토큰(near-black·의미색).

## Do's and Don'ts

### Do
- Do 계정·거래 화면은 순수 커머스 크롬으로(near-black 텍스트, 얇은 그레이 선, 퍼플 포인트).
- Do element색·검정 슬롯은 아이템 카드·속성 배지·아이템 필터 칩에만.
- Do 금액·잔액·카운트다운에 tabular-nums로 폭 고정.
- Do 색만으로 정보 전달 금지 — 의미색/element색은 아이콘·라벨 병기.
- Do 무신사·컬리는 감각/무드만 참조하고 값·형태는 FinalCall 고유로 창작.

### Don't
- Don't element색이나 검정 슬롯을 버튼·탭·인풋·내비·페이지 배경·본문·링크에 사용.
- Don't 퍼플→블루 그라디언트 히어로(전형적 AI 티) — 브랜드 퍼플은 단색 액센트로만.
- Don't 무신사·마켓컬리의 로고·자산·실제 hex를 복제(상표·저작권).
- Don't 제네릭 SaaS/부트스트랩 룩, 근거 없는 중첩 카드·과도한 둥근 모서리.
- Don't 라이트 값이 확정되기 전 다크 값을 지어내기(U-005 대기 — 단일 라이트 스킨 유지).
