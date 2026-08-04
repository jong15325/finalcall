# FC-183 (T5) 리뷰 — ItemCardTile 정본 + ShopCard/InventoryItemCard 어댑터화

- **티켓**: FC-183 (EPIC-CARD-SYSTEM T5) · Jira KAN-206
- **판정**: **PASS** (critical 0 · major 0)
- **검수자**: reviewer (읽기 전용)
- **일자**: 2026-08-04

## 요약
순수 프론트 리팩터. 형상 보존 정확·의존 방향 정합·어댑터화 달성·카드 스위트 35건 green·tsc 0 error. Done 전이 가능(총괄/사용자 승인 대상).

## 형상/픽셀 보존 (최우선 — 통과)
base(HEAD) 정적 diff 대조 + 기존 DOM 단언 테스트 재실행으로 이중 확인.
- **ShopCard(마켓)**: `ItemCardTile`(fullHeight 미전달)이 동일 트리 생성. 루트 클래스 문자열 `fullHeight=false`→바이트 동일. `ItemCard` className `""`와 미전달이 `.trim()` 처리로 동일 DOM. 비교 `z-20` div 무조건 렌더 = 전과 동일.
- **InventoryItemCard(인벤)**: fullHeight=true → `h-full` 삽입 위치 동일. compare 미전달 → 비교 div 미렌더(인벤 요건 충족). aria-label 동일.
- 기존 DOM 단언 테스트(버튼 3개·비교 독립레이어·hidePrice 가격줄 부재·aria-label) 전부 green.

## 축별 판정
1. **의존 방향(§9.2)** 통과 — CardCompareOverlay item 승격, 전 소비자 `→ item` 단방향, 삭제 경로 잔존 참조 0, 순환 없음.
2. **승격 무결성** 통과 — 이동 파일 CRLF 제외 바이트 동일(순수 이동).
3. **어댑터화 정합** 통과 — 복붙 조립 제거, 정본 조립을 ItemCardTile 단독 소유. member가 shop 베낀 복붙 소멸.
4. **회귀** 통과 — 플립 hover·비교 z-layer·hidePrice 가격줄 부재 보존.
5. **과설계 경계** 통과 — 가로 병합·만능 카드·뮤테이션 셸 승격·variant 조기정비(T6) 없음. skillFlip/hidePrice boolean은 T5 형상보존 DoD상 유지가 정확(T6 흡수 예정 주석 명시).
6. **테스트 신뢰성** 통과 — 카드 6스위트 35건 green, tsc 0 error. oauth 3 fail은 T5 무관 기존 실패(base 재현).

## Minor (비차단)
- **M-1(스타일층)**: 신설·이동 파일 CRLF 온디스크. 커밋 전 `git diff --cached`로 순수 rename(R) 인식 확인 권고([[git-mv-prestage-commit-bleed]]). 기능·형상 영향 없음.
- **M-2(정보)**: `ItemCardTile` footer 슬롯은 현 소비자 미사용이나 DoD 1항·제안 §2.2 계약 seam이라 정당(후속 소비자용).
