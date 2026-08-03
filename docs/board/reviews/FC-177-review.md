# FC-177 통합 리뷰 — 인벤토리 개편 + 인벤토리→판매 직접 플로우

- **대상**: FC-177(인벤토리 마켓영역 개편·아이템 클릭→다이얼로그 판매하기·판매 페이지 선점 모드)
- **리뷰어**: reviewer(읽기 전용)
- **일자**: 2026-08-04
- **판정**: CHANGES-REQUESTED → **총괄 처리: MAJOR는 코드 결함 아닌 커밋 위생 → 스테이징 분리로 해소, FC-177 코드 자체는 PASS**. 해소 후 `review_status: passed`.

## MAJOR — 범위 밖 변경 워킹트리 혼입(코드 결함 아님, 스테이징 분리로 해소)
FC-177 파일셋 밖 2파일이 워킹트리에 있음(앞선 별건 요청 산출):
- `frontend/src/components/layout/navItems.tsx`: 사이드바 쪽지·마이페이지 리프 제거.
- `frontend/src/components/layout/TopNavbar.tsx`: 모바일 보유코드 칩 숨김.
→ FC-177과 무관. **해소 = 총괄이 이 2파일을 별도 커밋으로 분리**(FC-177 스테이징에서 제외). FC-177 코드에는 손대지 않음. `git diff --cached` 확인([[git-mv-prestage-commit-bleed]]).

## FC-177 코드 — 전 축 통과(근거)
1. **정합/플로우**: 슬롯 클릭→onItemClick→다이얼로그→[판매하기]→`goToSell`(setSelectedItem(null) 후 `/sell?item=<id>`). SellPage `?item` 파싱→`items.find` 선점, 무효/미선택="판매할 아이템을 선택하세요", 인벤토리 빈상태가 `?item`보다 우선(순서 정확). validateSellForm/useCreateAuction/useCreateShop/확인 다이얼로그 무변경 — 회귀 없음.
2. **접근성**: InventoryItemDialog role=dialog·aria-modal·aria-labelledby·focus trap(Tab/Shift+Tab 순환, disabled 제외)·Esc·scroll lock·언마운트 포커스 복원·backdrop mousedown 닫기 정확. 슬롯/빈슬롯 aria-label 적절.
3. **반응형**: `grid-cols-2 xs:grid-cols-3 min-[1200px]:grid-cols-6`(마켓 동형), 프레임 72×134 원본비율 중앙정렬.
4. **테스트**: 지정 4스위트 14/14 통과(Inventory 2·Sell 4·Dialog 3·Grid 5), tsc·eslint clean. 선점(유효/무효/없음)·빈상태·다이얼로그·네비 실검증.
5. **스코프(핵심 파일)**: 계약/API 형상·백엔드 무변경, 기존 등록 로직 삭제 없음, 무관 리팩터 없음.

## MINOR (비차단, 선택 정리)
- **M1**: `SellPage.tsx:54` `FIELD_INPUT_ID.item='sellItemGroup'` — picker 제거로 DOM 부재. 참조 3경로 모두 런타임 무해(옵셔널체이닝 no-op + 폼은 preemptedItem 있을 때만 렌더→item 검증 분기 도달 불가). 정리하면 명료하나 차단 아님.
- **M2**: InventoryItemDialog 중복 "닫기" accessible name(헤더 X aria-label + 푸터 버튼) — 동일 동작이라 WCAG 위반 아님, 헤더를 "상세 닫기" 등으로 차별화 시 개선(권고). 테스트는 getAllByRole로 대응.

## 후속
- 총괄: navbar 2파일 별도 커밋 분리 → FC-177 atomic 커밋. minor 2건 선택 정리. 라이브 검증 후 done.
