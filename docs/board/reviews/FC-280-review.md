# FC-280 카드 회귀 복구 최종 리뷰

- 비교 기준: `4ee3ef4^`의 `ItemCard`·`ItemCardTile` 및 market/inventory/home 소비자
- 판정: **passed**
- 집계: critical 0 / major 0 / minor 0
- 범위 주의: 사용자 소유 `frontend/src/features/member/components/InventoryItemCard.test.tsx` 변경과 해당 파일의 lint warning 2건은 발견 집계에서 제외했다.

## 마지막 major 해소 확인

- `InventoryItemCard`의 배송 badge는 상단 control rail의 44px 칸에서 빠져 `top: 6px; left: 6px`의 독립 시각 overlay로 복원됐다.
- badge wrapper는 `pointer-events: none`이므로 상호작용 없는 상태 표시가 아래 `control-gap` 카드 action을 막지 않는다. badge 픽셀을 포함한 비-control 영역 클릭이 동일 modal action으로 전달된다.
- badge에 고정 폭을 부여하지 않고 `max-width: calc(100% - 12px)`만 적용해 기존 44px 칸 중앙 정렬로 인한 좌측 crop 가능성도 제거됐다.
- inventory footer는 별도 포인터용 `footer` action이 전체 footer rect를 소유하므로 잠금 문구 영역도 modal을 연다.

## 카드 action/control 및 접근성 확인

- 이미지 상단은 `control-gap`과 실제 control만 flex 형제로 나뉜다. flip과 compare는 각각 정확한 44px rect를 소유하며 gap/artwork/content/footer action과 물리적으로 겹치지 않는다.
- 이미지의 상단 44px 아래, 정보 본문, 상단 빈 gap, inventory footer가 동일 주 action으로 연결되어 market/inventory 전체 modal 클릭과 home 전체 상세 link 동작을 복원한다.
- 접근 가능한 주 action은 content action 하나다. artwork/control-gap/footer 포인터 action은 `aria-hidden="true"`, `tabIndex=-1`이고 flip·compare만 별도 보조 control로 순차 focus된다.
- visible `카드정보 보기` 버튼과 nested interactive는 없다. modal action은 `aria-haspopup="dialog"`를 유지하고, flip Escape 처리는 해당 composition focus 범위로 제한된다.

## 시각 parity 및 범위 확인

- 홈은 `hover:shadow-[var(--shadow-card-hover)]`를 단일 카드 표면에 적용해 기준의 hover shadow를 복원했다.
- 이미지 크기/fill/overlay, 이름·설명·가격·스킬·판매자·footer 순서와 spacing, market/inventory hover 및 full-height가 기준과 일치한다.
- 배송 badge는 기존 좌상단 6px overlay 위치와 온전한 너비를 유지한다.
- 변경은 카드 composition과 관련 테스트에 한정되어 불필요한 대량 변경은 확인되지 않았다.

## 검증 결과

- `npm.cmd run check:ui-system`: 통과
- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 오류 0. 제외 대상 사용자 소유 테스트 warning 2건
- 관련 테스트: 4 files / 23 tests 통과
- 직전 전체 테스트: 98 files / 762 tests 통과. 기존 `NoticeSection` unique key warning 출력
- `npm.cmd run build`: 통과. 단일 JS chunk 크기 warning(`668.09 kB`, gzip `180.67 kB`)
- `git diff --check`: whitespace error 0

## 최종 판정

배송 badge overlay/pointer/crop, 비-control 전체 클릭, inventory footer, control rect 비중첩, 단일 키보드 대표 action과 이전 시각 parity가 모두 충족됐다. critical 0 / major 0 / minor 0으로 FC-280은 **통과**, `review_status=passed` 판정이다.
