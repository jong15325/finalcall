# 세계지도 공통 배경·권역 효과 계약 v1.0

- 상태: **DECIDED — 게이트2·디자인 게이트 사용자 승인 2026-08-12**
- 배경 정본: `docs/ux/mockups/assets/common-background-variants/world-map-game-sources-a-v2.png`
- 효과 정본: `docs/ux/mockups/auction-detail-immersive-background.html` (`wind=b`, `fire=c`, `earth=c`, `water=c`)
- 적용 범위: `AppShell` 아래 모든 공개·보호·404 route
- 제외: `AuthLayout`의 로그인·회원가입·OAuth callback, API·백엔드·DB
- 선행: `horizontal-app-shell-contract.md` v1.4, `element-detail-background-contract.md` v2.2

## 1. 승인 결정

`world-map-game-sources-a-v2.png`를 모든 AppShell 페이지의 공통 웹 메인 배경으로 사용한다. 신규 A/B/C 또는 A~D
효과를 만들지 않고 이미 승인된 상세 효과 네 조합을 지도 속 고정 권역에 동시에 합성한다.

- 좌상단 earth: 승인 `earth=c` mineral·crystal·완만한 drift
- 좌하단 wind: 승인 `wind=b` curved ribbon·회전 궤적
- 우상단 fire: 승인 `fire=c` glow·flame·흔들리는 상승
- 우하단 water: 승인 `water=c` 낙하·impact ripple·jet
- 중앙 운해: 효과를 배치하지 않는 콘텐츠 안전영역

`world-map-v1.png`, `world-map-region-effects.html`의 신규 효과 어휘, 종전 A/B/C 강도 선택은 기각 이력으로만
보존하며 구현 정본이 아니다.

## 2. 소유권·레이어 계약

```text
AppShell
├─ WorldMapBackground (fixed scene owner 1개)
│  ├─ responsive 최적화 세계지도 이미지
│  ├─ CSS 정적/저빈도 국소 광원
│  └─ Canvas 1개 / RAF loop 1개 / 네 권역 particle
├─ sticky header
├─ main / single white content plane
├─ footer / CompareBar / MobileBottomNav
└─ modal / drawer / dropdown
```

- AppShell이 scene lifecycle을 단독 소유한다. route/page/detail 컴포넌트는 이미지, Canvas, RAF를 새로 만들지 않는다.
- 수평 셸 계약의 일반 route `surface-sunken`과 `/auctions` 전용 water scene은 이 공통 scene으로 대체한다.
  `/auctions`는 공통 scene의 water 권역 강조만 요청한다.
- 상세 배경 계약의 route별 전체화면 element 이미지와 Canvas도 공통 scene에 합성·대체한다.
  `ElementDetailBackground`가 content/theme 역할을 유지할 수는 있으나 scene DOM·이미지·Canvas·RAF를 소유하지 않는다.
- background는 AppShell root 최하단, content plane·chrome·footer·CompareBar·mobile navigation은 그 위,
  dialog·drawer·dropdown은 모든 shell layer 위다. 새 scroll/stacking context를 만들지 않는다.
- 장식 레이어는 `aria-hidden="true"`, `pointer-events:none`이며 focus·읽기·landmark 순서에 참여하지 않는다.

## 3. 자산·권역 좌표 계약

- docs 원본을 직접 서비스하지 않는다. `frontend/public`에는 AVIF/WebP와 fallback의 responsive 파생본을 둔다.
- 원본 비율 기준 hotspot과 범위는 아래와 같다. `cover` crop 뒤에도 정규화 좌표를 viewport로 보정한다.

| 권역 | 중심 `(x,y)` | 기준 범위 | 랜드마크 |
|---|---|---|---|
| earth | `(22%, 22%)` | `x 0~43%, y 0~43%` | 석조 광장·마을·산악 |
| wind | `(20%, 69%)` | `x 0~43%, y 35~100%` | 청록 거목·바람 성소 |
| fire | `(76%, 23%)` | `x 55~100%, y 0~47%` | 용암 성채·발광 룬 |
| water | `(77%, 72%)` | `x 52~100%, y 39~100%` | 수로·폭포·완전한 선박 |
| safe | `(50%, 52%)` | `x 35~65%, y 25~78%` | 중앙 운해, 신규 입자 금지 |

- desktop은 `center center / cover`가 기본이다. 390px 모바일에서는 최소 water와 다른 두 권역이 식별되도록
  responsive source 또는 focal position을 사용한다. 중앙 안전영역을 장식으로 채우지 않는다.
- 배포본 목표는 desktop 1920px 700KB 이하, mobile 350KB 이하이며 원본 3MB PNG 그대로의 배포를 금지한다.
  이미지 실패는 `surface-sunken` fallback으로 강등하고 제품 기능을 막지 않는다.

## 4. 효과 합성·route accent 계약

- neutral route는 네 승인 motif를 낮은 공통 밀도로 동시에 표시한다. motif·궤적·원소 의미를 바꾸지 않는다.
- 상세 성공 응답의 `element`는 대응 권역의 밀도·알파만 높이고 나머지는 neutral 밀도로 유지한다.
  `AuctionDetail.item.element`와 `ItemInstanceDetail.template.element`를 `toElementKey`로 검증한 값만 사용한다.
- `/auctions` exact static accent는 water 권역 강조로 흡수한다. 우선순위는
  **현재 pathname과 일치하는 detail dynamic accent → exact static accent → neutral**이다.
- loading·error·404·미등록 element는 neutral이다. URL/query/이전 응답에서 element를 추측하지 않는다.
- element 색은 권역 장식에만 쓰며 CTA·nav·form·상태 의미로 확장하지 않는다. 기존 opaque content plane과
  경매 상세/list region 및 chrome surface가 가독성을 책임진다.
- route 전환은 scene을 재생성하지 않고 accent state만 갱신한다. 이전 accent·timer·listener가 누출되면 안 된다.

## 5. Canvas·접근성·성능 계약

- Canvas 1개, RAF loop 1개만 사용한다. desktop 전체 particle 48개 이하, coarse pointer·저전력 24개 이하,
  DPR 1.5 상한, frame delta 40ms 상한이다. 권역별 할당도 전체 상한 안에서 나눈다.
- CSS는 transform·opacity 중심이며 프레임마다 layout/filter를 변경하거나 DOM particle을 증식하지 않는다.
- `document.hidden`에서 RAF를 즉시 멈춘다. resize는 debounce하고 모든 listener와 RAF를 unmount 때 정리한다.
- `prefers-reduced-motion: reduce`와 `(update: slow)`에서는 입자·회전·맥동을 제거하고 정적 이미지와 고정 광원만
  남긴다. coarse pointer·저전력은 강등하며 `forced-colors: active`에서는 이미지·Canvas를 숨긴다.
- Canvas/image 초기화 실패는 장식만 제거한다. nav, 콘텐츠, sticky, modal, 거래·입찰 기능에는 영향이 없다.
- 일반 텍스트 4.5:1, 큰 텍스트·UI 경계·focus ring 3:1은 최악 배경에서 surface를 포함해 확인한다.

## 6. 검증 계약

- 모든 AppShell route에 정본 지도 1개가 보이고 AuthLayout에는 이미지·Canvas·RAF·관련 요청이 0개다.
- neutral, detail dynamic 4종, `/auctions` water static 우선순위와 route cleanup을 검증한다.
- 전체 앱에서 scene DOM·image request·Canvas·RAF loop가 각각 1개 이하다.
- 승인 motif parity와 좌표·crop을 1920px, 1280px, 390px에서 비교한다.
- 320px, 200% 확대, reduced motion, update slow, forced colors, coarse pointer, visibility 정지를 검증한다.
- content plane, 경매 상세/list region, sticky, modal, drawer, dropdown, CompareBar, footer의 stacking·scroll·focus·
  body scroll-lock 회귀가 없어야 한다.
- 자산 크기, responsive source, 실패 fallback과 전체 frontend typecheck·lint·test·build를 검증한다.

## 7. 선행 계약 대체와 영향

- 수평 셸 계약 v1.4 §1·§5.1·§6의 일반 route 정적 배경, 상세 전용 scene, `/auctions` water scene은 이 계약이
  우선한다. 내비·content plane·AuthLayout 제외는 유지한다.
- 상세 배경 계약 v2.2 §2~§6의 route별 이미지·Canvas lifecycle은 이 계약이 우선한다. 상세 응답 검증과
  content/chrome theme은 유지한다.
- 직접 영향: FC-233, FC-237, FC-239~244, FC-248, FC-251~252, FC-257~260.
- 회귀 영향: FC-249~250, FC-254, FC-256. 기존 티켓은 감사 이력으로 수정하지 않는다.
- API 계약, ERD, 백엔드, item element wire 값, 거래 동작은 변경하지 않는다.

## 8. 구현 티켓

- FC-261: 확정 계약·에픽 정본 연결
- FC-262: responsive 최적화 자산과 AppShell 공통 scene 기반
- FC-263: 승인 네 효과를 단일 Canvas에 이식
- FC-264: 상세 dynamic·목록 static accent 통합과 중복 scene 제거
- FC-265: 접근성·성능·route cleanup·stacking 리뷰
- FC-266: 승인 효과 parity·responsive crop·최종 통합 리뷰
