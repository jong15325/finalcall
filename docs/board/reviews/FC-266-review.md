# FC-266 재리뷰 — 월드맵 공통 배경 최종 통합

- 대상: 최초 구현 `607672f`, 수정 커밋 `76bc0bc`, `docs/spec/world-map-common-background-contract.md` v1.0, FC-261~266
- 판정: **passed**
- 발견: critical 0 / major 0 / minor 0
- 검증: `npm.cmd test` 97 files·769 tests 통과, `npm.cmd run typecheck` 통과, `npm.cmd run lint` 오류 0·기존 무관 경고 2, `npm.cmd run build` 통과(기존 500 kB 초과 chunk 경고)

## 기존 발견 해결 확인

### Major 1 — 390px 모바일 권역 생존 및 hotspot 보정: 해결

- 위치: `frontend/public/img/backgrounds/world-map/world-map-mobile.{avif,webp,jpg}`, `frontend/src/components/layout/WorldMapBackground.css:86-122`, `frontend/src/features/item/components/ElementDetailBackground.tsx:59-64`
- 확인: 모바일 파생은 960×2078로 390×844 viewport와 거의 같은 종횡비여서 `object-fit: cover`에서 실질적인 좌우 crop 없이 표시된다. 실제 JPEG를 원본 크기로 확인한 결과 중앙 아트 띠에 earth·wind·fire·water 네 권역이 모두 생존한다.
- hotspot: CSS glow는 earth 22%/42.7%, wind 20%/55%, fire 76%/43%, water 77%/56%로 보정됐다. Canvas mobile bounds도 같은 아트 띠 범위로 이동해 정적 랜드마크와 효과가 대응한다.
- 결과: 계약의 390px 권역 생존과 중앙 안전영역 조건을 충족한다.

### Major 2 — coarse pointer 48↔24 강등: 해결

- 위치: `frontend/src/features/item/components/ElementDetailBackground.tsx:66-80`, `:164-168`, `:183-199`
- 확인: `seedParticles()`가 현재 `(pointer: coarse)` 값에 따라 24/48개로 배열을 다시 만들고 `data-particle-limit`도 갱신한다. 전용 change handler가 reseed 후 RAF를 재시작하며 unmount 시 동일 handler를 제거한다.
- 테스트: `WorldMapBackground.test.tsx`가 coarse false→true→false 전환에서 `48→24→48`을 검증한다.

### Major 3 — Canvas motif/lifecycle 회귀 테스트: 해결

- 위치: `frontend/src/components/layout/WorldMapBackground.test.tsx`
- 확인: 실제 Canvas context mock으로 한 프레임을 실행해 wind의 quadratic curve, fire의 radial gradient, earth의 rotation, water의 ellipse를 모두 확인한다. reduced motion, update slow, forced colors, coarse pointer, visibility, debounced resize, unmount 후 listener/RAF 비활성도 실행 경로로 검증한다.
- 결과: 공통 Canvas의 승인 motif와 lifecycle 핵심 계약이 다시 회귀 테스트로 보호된다.

### Minor 1 — 모바일 JPEG fallback 상한: 해결

- 위치: `frontend/src/components/layout/WorldMapBackground.tsx:22-49`, `frontend/public/img/backgrounds/world-map/world-map-mobile.jpg`
- 확인: 폭 639px 이하용 `image/jpeg` source가 추가됐으며 실제 크기는 131,155 bytes다. 모바일 AVIF 135,295 bytes, WebP 116,594 bytes도 모두 350KB 상한 이내다.

## 통합 계약 재확인

- AppShell 공통 scene 1개, AuthLayout scene 0개 및 기존 detail/list scene 제거 상태가 유지된다.
- dynamic detail accent → exact `/auctions` water → neutral 우선순위와 loading/error/404 중립 처리가 유지된다.
- Canvas 1개·RAF loop 1개 구조, DPR 1.5·delta 40ms·particle 상한, reduced/update/forced/visibility cleanup이 유지된다.
- nav/footer/content/modal/drawer/CompareBar/MobileBottomNav보다 낮은 배경 stacking, `aria-hidden`, `pointer-events-none` 및 기존 body lock 동작에 회귀가 없다.
- 수정 범위는 기존 리뷰 4개 발견에 직접 추적된다. 무관한 코드 리팩터·포맷 변경은 없다.

## 최종 판정

기존 major 3건과 minor 1건이 모두 해결됐고 신규 critical/major/minor 발견이 없다. FC-266은 **passed**로 판정한다.
