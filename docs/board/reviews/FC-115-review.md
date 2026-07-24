# FC-115 리뷰 — 마켓 카드 플립 트리거 aria-controls 배선

- 리뷰어: reviewer (2026-07-24)
- 대상: 커밋 b5992db (ItemCard aria-controls 배선, FC-111 m3 후속)
- **판정: pass** (critical/major/minor 0건)

## 재현 검증
- vitest 67파일 561 pass · tsc --noEmit exit 0 · ESLint(변경 3파일) exit 0. 구현 주장과 일치.

## 확인 항목
1. **disclosure 배선 정확** — `useId()`→`skillsId` 단일 소스, 뒷면 region `id={skillsId}`·트리거 `aria-controls={skillsId}` 동일 값 연결. 둘 다 `flipEnabled` 동일 조건 렌더라 dangling reference 없음. `aria-expanded={flipped}`·aria-label 토글 정상.
2. **인벤토리(FC-112 FilledSlot) 패턴과 일치** — useId→id+aria-controls+aria-expanded 동형, import 방식까지 동일.
3. **회귀 없음** — diff는 정확히 3라인 추가 + import 1라인 교체. 시각 플립·aria-hidden/inert 토글·overlay(비교) 독립·detailLink·Escape 닫기 전부 무변경. 테스트가 회귀 가드 유지.
4. **테스트 실효** — ItemCard.test·ShopCard.test가 트리거 `aria-controls` ↔ back `id` 일치를 실제 단언(존재 확인 아님). ShopCard는 통합 경로 검증.
5. **과잉 변경 없음** — 3파일 +17 -1, 모든 라인이 배선 요청에 직접 추적. 포맷 churn·무관 리팩터 없음(coding-discipline 원칙3 준수).

## 참고(결함 아님)
- 뒷면 div `role="region"` 미명시 — 인벤토리 패턴과 동일하며 disclosure 필수 아님, 범위 밖.

## Done
critical/major 0 → Done 가능. review_status: passed. 게이트3(사용자 Done 승인) 대기.
