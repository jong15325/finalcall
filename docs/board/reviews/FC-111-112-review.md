# FC-111·FC-112 리뷰 (코덱스 프론트 디자인 세션 회수)

- 리뷰어: reviewer (2026-07-24)
- 대상: 커밋 683a936(FC-111 마켓 카드)·53550ec(FC-112 인벤토리)
- **판정: changes-requested** (major 2건 → Done 불가, 재작업 필요)
- 재현 검증: 테스트 32건 전건 통과(ItemFrame 9·ItemCard 11·Inventory 10·ShopCard 2), typecheck 통과, ESLint 5파일 클린 — 코덱스의 "테스트/타입/린트 통과" 주장 재현·확인.

## CRITICAL
- 없음.

## MAJOR

### M1 (FC-112) 인벤토리 — 스킬 정보가 `<button>` 자손이라 스크린리더 노출 불가 + 상세 링크 제거로 회귀
- 위치: `InventorySlotGrid.tsx` `FilledSlot`(~200–250줄).
- 구조: `<button aria-label="… 스킬 보기">` → `<span>` → `<ItemSkillSummary>`(`<ul><li>`). 스킬 내용이 **버튼의 자손**.
- ARIA `button` 롤은 children presentational=true → 브라우저가 버튼 자손을 접근성 트리에서 제거하고 접근명(aria-label)만 노출. **SR 사용자는 skill1/skill2 실제 텍스트에 영구 접근 불가**. aria-expanded 펼쳐도 내용이 버튼 내부라 안 읽힘.
- 동시에 이 커밋이 슬롯의 상세 링크(`/items/:id`, 스킬 이름·효과 노출 경로)를 제거 → **AT 사용자의 기존 도달 경로 소멸 + 새 노출은 SR에 안 닿음 = 순회귀.**
- 부수: `<ul>`을 `<button>` 안에 넣는 것은 유효하지 않은 HTML(button은 phrasing content만 허용).
- 시각적 키보드 사용자는 접근 가능(focus-visible CSS 플립). **문제는 스크린리더 한정** → major.
- 기대: 펼침 콘텐츠를 버튼 외부 별도 region(aria-controls 참조)에 두어 SR이 읽게. 또는 상세 접근 경로 대체 확보.

### M2 (FC-111) 마켓 ShopCard — 상세 링크 오버레이 매직넘버 `top-[252px]`가 CSS `min-height:252px`와 취약 결합
- 위치: `ShopCard.tsx`(상세 Link) + `ItemFrame.css` `.item-card__skill-flip.is-market .item-frame__stage { min-height:252px }`.
- 상세 이동 빈 `<a>`가 `absolute inset-x-0 bottom-0 top-[252px]`로 하드코딩 — 이미지 스테이지 `min-height:252px`에 수동 정렬.
- `min-height`이라 스테이지가 252 초과 시(반응형·폰트확대·아트스케일) 링크가 이미지 하단을 덮어 **플립 hover/터치 영역 잠식**, 어긋나면 정보영역 상단 클릭 사각지대. 브레이크포인트별 오프셋 조정 없음(웹/모바일 별도설계 규약과 상충 소지).
- 기대: 링크영역·이미지높이 단일 소스 연동. **실브라우저 육안 확인 필수.**

## MINOR
- **m1** (FC-111) 마켓 hover 플립 시 aria-hidden/inert 미동기화(마우스 무해, 스킬 정보영역 중복 존재).
- **m2** (FC-111) 스킬 이중 렌더 → 펼침 시 SR 중복 낭독. 뒷면 고유 정보는 사실상 판매자뿐.
- **m3** (FC-111/112) aria-expanded 시맨틱 불완전(aria-controls 없음, disclosure 관계 불명확).
- **m4** (FC-111·게이트2 소지) `ShopCard`가 `sellerNickname` 원문 신규 노출 — `design-worklist §5.3` 마스킹 열린 결정에 저촉. 제품/프라이버시 확인 대상.
- **m5** (FC-111) 테스트 실효성 갭 — `ShopCard.test`가 DOM 중첩만 검증, "비교 클릭이 상세 이동을 유발 안 함" **행위 자체는 미단언**(확정 UX 핵심 요건 미커버). 플립 토글·aria-expanded·inert·Escape는 견고.
- **m6** (FC-111) 스킬 강조색 불일치(앞면 orange-deep / 뒷면 gold-bright), element 배지 1~4만 스타일(실무 무해).
- **m7** (FC-112) 플립 무관 포맷 churn(coding-discipline 원칙3 경미 위반).

## 디자인 규약(worklist §4) 준수 — PASS
- Game-Color Containment: 요소색은 아이템 카드 속성 배지에만, 크롬/내비/버튼/배경 유출 없음. 뒷면 네이비+골드는 카드 콘텐츠(크롬 아님). 블랙 CTA/퍼플 위반 없음.

## 실브라우저 육안 확인 필요
1. 데스크톱 hover / 모바일 탭 플립 실동작(jsdom 미검증).
2. prefers-reduced-motion 트랜지션 제거.
3. **M2** ShopCard `top-[252px]`가 브레이크포인트/폰트확대에서 이미지영역 잠식 없이 정보영역만 덮는지.
4. 인벤 72×134 아트가 96×178 슬롯 중앙 비율유지·pixelated 렌더(규No.6).
5. 높이 통일: 스킬 1개 vs 2개 카드 앞면 높이 동일, 인벤 뒷면 스킬 96×178 내 넘침 없음.
6. backface-visibility 뒷면 비침 없음(크로스 브라우저).
7. 인벤 슬롯 키보드 focus-visible 플립.

## 메인세션 처리 (1차)
- FC-111·FC-112 → `review_status: changes-requested`, state → `doing`(재작업).
- **M1**: 인벤 뒷면 스킬을 버튼 밖 영역 분리 또는 상세 접근 경로 대체.
- **M2**: 링크영역·이미지높이 단일 소스화.
- **m4**: 판매자 원문 노출 게이트2 상신 여부 판단.

---

## 재검 (2차 · 2026-07-24 · 재작업 커밋 426ef94) — 판정: **pass (Done 가능)**
- 재현: `npm test` 561건 전건 통과 · typecheck · ESLint 클린.
- **M1 해소** — FilledSlot을 disclosure로 재구성. 토글을 빈 오버레이 버튼으로 분리, 스킬 콘텐츠가 더는 버튼 자손 아님(유효 HTML + SR 접근). 뒷면 `id`↔버튼 `aria-controls`/`aria-expanded` 연결, `aria-hidden`/`inert` 방향 정확(펼침 시 앞면 잠금·뒷면 노출). 스킬 없으면 트리거·플립 없음. focus-visible·Escape·hover/터치·96×178 회귀 없음.
- **M2 해소** — `top-[252px]` 완전 제거. 상세 링크를 ItemCard 정보영역(`.item-card__market-info` position:relative) 안 `absolute inset-0`으로 이동 → 이미지 플립 스테이지의 형제 서브트리라 구조적으로 침범 불가. 비교(z-20)와 링크(z-[5]) DOM·영역 무교차. `detailLink` prop은 기존 footer/overlay 노드 주입 패턴과 정합(과잉 변경 아님).
- **잔여 minor m3(비차단)** — 마켓 플립 트리거는 `aria-controls`/뒷면 id 미배선(인벤은 반영됨). 마켓 뒷면은 이미 형제 region+aria-hidden/inert 토글이라 SR 접근 자체는 가능 → disclosure 시맨틱 완결성만 미흡. **Done 차단 아님, 별도 minor 후속 권고.**
- **m5 해소** — ShopCard 테스트가 LocationProbe로 비교 클릭 후 경로 불변 실효 검증. **m4** = 원문 노출 사용자 확정으로 이슈 아님.
- **새 회귀** 없음.
- 실브라우저 육안 QA 잔여: M2 링크 비침범·hover/터치 플립·reduced-motion·backface 비침·인벤 96×178 넘침.

### 메인세션 처리 (2차)
- FC-111·FC-112 → `review_status: passed`. state는 `review` 유지(게이트3 사용자 Done 승인 + 육안 QA 선행).
- m3는 minor 후속 티켓으로 분리 권고.
