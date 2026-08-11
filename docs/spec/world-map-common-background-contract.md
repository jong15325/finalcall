# 세계지도 공통 배경·영역 효과 계약 초안 v0.1

- 상태: **PROPOSED — 게이트2·디자인 게이트 대기**
- 기준 자산: `docs/ux/mockups/assets/common-background-variants/world-map-v1.png`
- 비교 목업: `docs/ux/mockups/world-map-common-background-motion-options.html`
- 적용 후보 범위: `AppShell` 아래 모든 route. `AuthLayout`·API·백엔드·DB는 제외한다.
- 승인 전 동결: 이 문서는 구현 권한을 부여하지 않는다. 사용자가 효과 조합과 적용 범위를 선택하기 전에는
  `frontend/**`와 배포용 이미지 자산을 변경하지 않는다.

## 1. 결정이 필요한 항목

이번 변경은 공통 셸 배경, 기존 상세 속성 scene의 소유권, 이미지 전송량과 지속 애니메이션 비용을 바꾸므로
게이트2 대상이다. 다음 두 값을 사용자가 확정해야 DECIDED로 전환한다.

1. 효과 조합: A `잔잔한 생태`, B `모험의 맥동`(추천), C `원소 대격변`.
2. 범위: 모든 AppShell route 공통(추천) 또는 일반 route만. 전자를 택하면 기존 상세/목록 속성 scene은 세계지도
   위의 국소 효과로 흡수하고, 후자를 택하면 상세 scene과 공통 지도의 이중 배경 소유권을 별도 관리해야 한다.

추천은 **B + 모든 AppShell route 공통**이다. 지도 속 지형을 알아볼 수 있을 만큼 움직임이 명확하면서도 콘텐츠
가독성과 저전력 강등이 가능하고, route별 fixed scene 중복을 제거해 소유권을 AppShell 하나로 수렴시킨다.

## 2. 공통 배경 소유권과 레이어

승인 시 `horizontal-app-shell-contract.md` §1의 일반 route `surface-sunken`과 §5.1의 `/auctions` 고정 water scene을
이 계약이 대체한다. `ElementDetailBackground`의 route별 이미지·Canvas 소유권도 공통 scene으로 흡수하는 것을
기본안으로 한다.

```text
AppShell
├─ WorldMapBackground (fixed, scene owner 1개)
│  ├─ 최적화된 world-map-v1 이미지
│  ├─ CSS 국소 광원·안개 레이어
│  └─ Canvas 국소 입자 레이어 1개
├─ sticky header
├─ main / single content plane
├─ footer / CompareBar / mobile navigation
└─ modal / drawer / dropdown
```

- 지도는 `center center / cover`를 기본으로 하되 주요 지형 hotspot이 잘리는 모바일에서는 별도 focal position을
  사용한다. 이미지 자체를 DOM 콘텐츠로 취급하지 않고 `aria-hidden="true"`, `pointer-events:none`으로 둔다.
- 좌표는 원본 이미지의 정규화 비율로 정의한다: 산악·폭포 `(12%, 20%)`, 숲 미궁 `(17%, 65%)`,
  마을 `(75%, 22%)`, 성소 `(84%, 73%)`, 중앙 운해 `(51%, 52%)`. cover crop 후 동일 좌표계를 보정한다.
- 공통 scene은 AppShell root의 최하단 stacking layer다. content plane·chrome·footer·CompareBar는 그 위,
  dialog·drawer·dropdown은 모든 shell layer 위를 유지한다.
- 콘텐츠 가독성은 전체 화면 veil이 아니라 기존 불투명 white content plane과 chrome surface가 책임진다.
  배경을 보이기 위해 카드·form의 대비를 낮추지 않는다.

## 3. 디자인 게이트 선택지

| 안 | 산악·폭포 | 숲 미궁 | 마을 | 성소 | 중앙 운해 | 비용/인상 |
|---|---|---|---|---|---|---|
| A 잔잔한 생태 | 느린 설분·물보라 | 반딧불 소량 | 굴뚝 연기·창문 숨빛 | 얕은 청록 파동 | 느린 안개 이동 | 가장 절제됨, 24입자 상한 |
| **B 모험의 맥동(추천)** | 설분·번개 잔광·폭포 안개 | 반딧불 군집·길의 맥동 | 창문 점등·굴뚝 연기·광장 불씨 | 룬 회전·청록 파동·상승 입자 | 방향성 운해·빛줄기 | 지형별 정체성이 가장 선명, 40입자 상한 |
| C 원소 대격변 | 낙뢰·눈보라 | 초록 소용돌이·포자 | 황금 축제 불꽃 | 이중 룬·에너지 기둥 | 빠른 구름·화면 광량 변화 | 가장 극적, 피로·성능 위험, 56입자 상한 |

목업의 버튼은 비교 도구일 뿐 제품 UI가 아니다. 목업의 지형 라벨·hotspot 윤곽도 구현하지 않는다.

## 4. 모션·접근성·성능 계약

- 지속 애니메이션은 `transform`·`opacity`와 단일 Canvas만 사용한다. layout/paint를 반복 유발하는 DOM 입자
  증식, 다중 Canvas, 필터의 프레임별 변경은 금지한다.
- 추천 B 기준 desktop 입자 40개 이하, coarse pointer·저전력 20개 이하, DPR 1.5 상한, delta 40ms 상한이다.
- `prefers-reduced-motion: reduce`와 `(update: slow)`에서는 입자·회전·맥동을 제거하고 정적 지도와 고정 광원만
  남긴다. `forced-colors: active`에서는 이미지·효과를 숨긴다.
- `document.hidden`에서 RAF를 중지하고 visibility/resize/media-query listener를 unmount 때 모두 정리한다.
- 원본 2.8MB PNG를 그대로 배포하지 않는다. 배포본은 AVIF/WebP와 fallback을 만들며 1920px 후보는 700KB 이하,
  모바일 후보는 350KB 이하를 목표로 한다. 일반 route 최초 진입에서 공통 배경 요청은 1회, Canvas·RAF loop도
  각각 1개여야 한다.
- 배경 실패·Canvas 실패는 장식만 제거한다. 내비게이션, 콘텐츠, 거래 기능, focus 순서에는 영향이 없어야 한다.
- 320px, 1280px, 200% 확대, reduced motion, forced colors, 저전력 강등을 시각·자동 테스트한다.

## 5. 기존 속성 테마와의 합성 규칙

- 세계지도는 전 route의 base scene이다. 상세 응답의 `element`는 별도 전체화면 이미지를 선택하지 않고 국소
  accent만 선택한다: water=성소·폭포, fire=마을·광장, earth=숲 미궁, wind=산악·운해.
- route 우선순위는 `detail dynamic accent → exact static accent → neutral`이다. `/auctions`의 종전 water 값은
  static accent로만 남길지 제거할지를 디자인 선택 후 확정한다. 어떤 경우에도 scene owner는 하나다.
- 미등록 element, loading, error, 404는 neutral 세계지도만 표시한다. URL·query·이전 응답으로 accent를 추측하지
  않는다.
- element 색은 장식 hotspot에만 허용하고 CTA·내비·form 상태색으로 확장하지 않는다.

## 6. 영향 분석

확정 계약을 바꾸기 전에 확인해야 할 기존 티켓은 다음과 같다.

- **직접 영향**: FC-233(공용 배경 기반·자산), FC-237/239(route-scoped host), FC-240~244(속성 scene·리뷰),
  FC-248(공통 background layer), FC-251/252(상세 통합), FC-257/258(`/auctions` water scene), FC-260(scene 회귀).
- **회귀 영향**: FC-249(공개 route), FC-250(보호 route), FC-254(stacking/scroll), FC-256(경매 상세 region).
- **계약 문서**: `element-detail-background-contract.md` v2.2 §2~§7,
  `horizontal-app-shell-contract.md` v1.4 §1·§5~§7, 두 에픽의 children·게이트 기록.
- **코드 예상 영향**: `AppShell.tsx`와 테스트, `RouteVisualThemeContext`, `ElementDetailBackground` TSX/CSS와 테스트,
  배포용 background assets, 공개·보호 route 및 stacking 회귀 테스트.
- **무영향**: API 계약, ERD, 백엔드, item element wire 값, 화면 정보 구조와 거래 동작.

사용자 확인 전에는 위 기존 계약·티켓·코드를 수정하지 않는다. 승인이 나면 기존 티켓은 감사 이력으로 보존하고
아래 파생 티켓에서 변경을 추적한다.

## 7. 승인 후 티켓 분해안

| 제안 ID | owner | depends_on | 목표 |
|---|---|---|---|
| FC-261 | architect | [] | 선택 결과 반영, 두 선행 계약의 대체 조항 확정 |
| FC-262 | frontend-impl | [FC-261] | 배포용 responsive 지도 자산 최적화와 공통 scene 기반 구현 |
| FC-263 | frontend-impl | [FC-262] | 선택안의 지형별 CSS/Canvas 효과와 reduced-motion·저전력 강등 구현 |
| FC-264 | frontend-impl | [FC-263] | 상세 dynamic accent·목록 static accent를 단일 scene에 통합하고 구 scene 제거 |
| FC-265 | reviewer | [FC-264] | 접근성·성능·route cleanup·stacking·전 route 회귀 리뷰 |
| FC-266 | reviewer | [FC-265] | 게이트3 전 시각 parity와 최종 통합 검증 |

에픽 제안명은 `EPIC-WORLD-MAP-BACKGROUND`다. 새 화면은 아니지만 모든 AppShell route의 주요 시각 체계를
바꾸므로 디자인 게이트를 먼저 통과한다. 실제 보드 파일 생성과 상태 전이는 메인세션이 담당한다.

## 8. 승인 기준

- 목업에서 A/B/C를 PC와 390px 모바일 폭으로 비교할 수 있다.
- 선택안에서 산악·숲 미궁·마을·성소 중 최소 3영역의 움직임이 서로 구별된다.
- 콘텐츠 plane 위 텍스트·form·CTA 대비와 focus가 배경 변화에 의존하지 않는다.
- reduced motion에서 의미 손실이 없고, 장식 제거 시 기능·정보 손실이 없다.
- 사용자가 효과 조합과 적용 범위를 명시적으로 승인한 뒤에만 v1.0 DECIDED와 구현 티켓을 만든다.
