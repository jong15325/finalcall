# FC-260 독립 리뷰

- 대상 계약: `docs/spec/horizontal-app-shell-contract.md` v1.4, `docs/spec/element-detail-background-contract.md` v2.2
- 대상 커밋: `f7c0a70`
- 최종 판정: **passed**
- 집계: critical 0 / major 0 / minor 0

## Auction list region 경계

- `AuctionListPage` 최상위 반환 요소가 `auction-list-region` 하나이며 목록 콘텐츠 전체를 감싼다.
- 제목·설명·경매 등록 CTA, 필터·정렬, 결과 수·잔액 링크가 모든 데이터 상태에서 동일 region 안에 유지된다.
- loading skeleton, 초기 error와 retry, empty와 검색/필터 해제 action, ready grid와 모든 AuctionCard, infinite sentinel 및 추가 loading status가 동일 region 내부에 있다.
- 부분 갱신 실패 banner도 ready grid와 함께 region 안에 남는다.
- 상태 분기는 region 내부 자식만 교체하므로 water scene과 AppShell plane에 대한 page-level boundary가 loading/error/empty/ready 전환에서 바뀌지 않는다.

## 불투명 surface·반응형

- region은 opaque `bg-surface`, `border-line`, `rounded-xl`, `shadow-sm`, `xl:rounded-2xl`을 사용해 water scene과 목록 콘텐츠를 명확히 분리한다.
- padding은 `p-3 sm:p-5 lg:p-6`, `min-w-0`이며 320px와 200% 확대에서 불필요한 고정 폭이나 outer horizontal scroll을 만들지 않는다.
- CTA와 filter controls, card는 기존 light surface/text/border baseline을 유지한다. `ambientOnly`가 상세용 dark/glass surface·CTA override를 목록에 적용하지 않는다.
- region 자체에는 `overflow`, `transform`, `filter`, `z-index`가 없어 새 scroll container, fixed containing block 또는 stacking context를 만들지 않는다.
- grid/card 내부의 국소 overflow와 infinite sentinel의 body-scroll 관찰 관계는 유지된다.

## Water scene·route 격리

- exact `/auctions`의 단일 `ElementDetailBackground` scene은 region 바깥에 있고 DOM 순서상 region보다 앞선다.
- scene은 fixed viewport를 채우고 region과 AppShell white plane 바깥 outer gutter에서 water image/particle이 보인다.
- static water는 API와 무관하며 scene/image/Canvas/RAF owner가 화면당 하나다.
- 목록→상세에서는 상세 응답 element가 유일한 dynamic theme/scene으로 교체되고 water frame이 잔류하지 않는다.
- 목록→다른 route에서는 static theme, scene, image, RAF, resize/visibility/media listener가 정리된다.
- 다른 route에는 `auction-list-region`이 없으며 `/market` 등 다른 목록은 scene/image/RAF도 0이다.
- reduced motion, forced colors, coarse pointer, update slow, visibility, DPR/delta 및 Canvas cleanup 계약은 기존 단일 engine을 그대로 사용한다.

## 테스트 적정성

- loading·error가 region과 filter를 공유하는지 검증한다.
- empty 및 ready grid/card/추가 loading이 같은 region에 있는지 검증한다.
- 실제 ambient wrapper에서 scene과 region의 분리·DOM 순서, ambient-only mode, opaque surface 및 금지 class 부재를 검증한다.
- AppShell 누적 테스트가 exact water scene 1개, 다른 route scene/image/RAF 0, 목록→상세 dynamic precedence 및 route cleanup을 검증한다.

## 검증 결과

- `npm.cmd test -- --run`: 통과 — 96 files, 772 tests
- `npm.cmd run typecheck`: 통과
- 변경 대상 ESLint `--max-warnings=0`: 통과
- `npm.cmd run build`: 통과 — 기존 500kB 초과 chunk 경고
- 전체 `npm.cmd run lint -- --max-warnings=0`: 변경 범위 밖 `InventoryItemCard.test.tsx` 81·94행의 기존 `react/jsx-sort-props` warning 2건으로 종료 코드 1
- 전체 테스트 stderr의 기존 `NoticeSection` key warning은 FC-260 변경 범위 밖이다.

확정 계약을 차단하는 critical/major/minor 발견이 없어 통과 판정한다.
