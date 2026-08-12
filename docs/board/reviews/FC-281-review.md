# FC-281 이미지 clipping 수정 리뷰

- 비교 기준: `4ee3ef4^`의 `ItemFrame`·`ItemCard`와 최신 market/inventory/MyShop/preview/detail 소비자
- 판정: **passed**
- 집계: critical 0 / major 0 / minor 1

## Minor 1 — 추가 테스트가 실제 폭·overflow·hover clipping을 검증하지 않는다

- 위치: `frontend/src/features/item/components/ItemCardComposition.test.tsx:34-70`
- 재현: 새 CSS의 `.item-frame.item-card__artwork-frame { width: 100%; }` 또는 `display: block`을 제거해도 테스트를 실행한다.
- 기대: FC-281의 원인 규칙이 사라지거나 우측 열, 스킬/무스킬, hover transform에서 frame이 잘리면 회귀 테스트가 실패해야 한다.
- 실제: vitest는 이 CSS를 적용하지 않으며 테스트는 class와 `.item-frame__stage`·`.card-art`·`.item-art` 자식 및 `src` 존재만 확인한다. 실제 computed width, overflow 경계, 우측 열 배치와 hover 상태를 검증하지 않아 수정 규칙이 없어도 통과한다. 브라우저 레이아웃 회귀 보호가 부족하지만 현재 구현의 정적 레이아웃은 올바르므로 minor다.

## clipping 수정 확인

- `ItemCardArtwork`가 전용 `item-card__artwork-frame` class를 주입하고, 해당 root만 `width: 100%; min-width: 0; display: block`을 적용한다.
- market 무스킬, inventory 무스킬, MyShop 기본 카드에서도 root와 stage가 그리드 셀의 전체 폭을 소유한다. 72×134 `card-art` 자체 크기와 비율은 변경하지 않고 stage 중앙 정렬을 유지한다.
- market/inventory 스킬 카드는 기존 `.item-card__skill-flip-front > .item-frame { width: 100%; }`와 새 공통 규칙이 같은 결과를 내며, flip 앞·뒤 면의 grid sizing도 유지된다.
- 6열 catalog의 우측 열도 각 카드 내부 stage가 독립적인 100% 폭을 가지므로 프레임과 hover drop-shadow를 위한 좌우 여백이 카드 안에 확보된다. 목록/grid 조상에는 새 overflow나 transform 변경이 없다.
- market stage는 최소 252px와 상하 padding 28px, 기본/MyShop stage는 최소 168px와 상하 padding 12px를 유지한다. 72×134 frame의 `translateY(-3px)`와 drop-shadow가 상하 경계에 닿지 않는다.
- frame 내부의 `overflow: hidden`은 원본 art·PNG frame을 72×134 캔버스에 맞추는 기존 계약이며, stage의 overflow는 배경 echo 경계용이다. 이번 root 폭 확장으로 카드/그리드 우측에서 프레임 자체가 잘리던 경로는 제거됐다.

## preview·상세 및 FC-280 회귀 확인

- home preview는 기존부터 `fill`이 `width/height: 100%`를 소유한다. 새 `:not(.item-frame--fill)` display 규칙의 대상이 아니어서 158px preview 높이와 fill 동작은 변하지 않는다.
- 상세·hero·compare·임시보관·판매 화면은 `ItemFrame`을 직접 사용하므로 `item-card__artwork-frame` 선택자 대상이 아니며 scale·frame 크기에 영향이 없다.
- FC-280의 content/artwork/control-gap/footer action과 44px flip/compare rect CSS는 수정되지 않았다. 전체 카드 클릭, 단일 키보드 대표 action, badge pointer 통과와 control 비중첩이 유지된다.
- 변경은 `ItemCardArtwork`, 전용 CSS와 회귀 테스트에 한정되어 불필요한 변경은 확인되지 않았다.

## 검증 결과

- `npm.cmd run check:ui-system`: 통과
- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 오류 0. 사용자 소유 `InventoryItemCard.test.tsx` warning 2건
- `npm.cmd run test`: 98 files / 764 tests 통과. 기존 `NoticeSection` unique key warning 출력
- `npm.cmd run build`: 통과. 단일 JS chunk 크기 warning(`668.13 kB`, gzip `180.68 kB`)
- `git diff --check`: whitespace error 0

## 최종 판정

공통 카드 root가 stage 폭을 안정적으로 소유해 market 스킬/무스킬, 우측 열, inventory와 MyShop의 clipping 원인이 해소됐다. preview·상세와 FC-280 클릭/hit-area 계약에도 회귀가 없다. critical 0 / major 0 / minor 1로 FC-281은 **통과**, `review_status=passed` 판정이다.
