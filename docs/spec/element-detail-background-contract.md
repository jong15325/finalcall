# 속성별 상세 몰입형 글래스 셸 계약 v2.2

- 상태: **DECIDED — `/auctions` water scene·opaque list region 승인 2026-08-11**
- 디자인 기준: `docs/ux/mockups/auction-detail-immersive-background.html`의 v3 배경과 확정 효과
  (`wind=b`, `fire=c`, `earth=c`, `water=c`)
- 범위: 경매 상세 `/auctions/:id`, 아이템 인스턴스 상세 `/items/:id`, 정적 water 경매 목록 `/auctions`
- 범위 밖: 경매 외 목록·홈·마켓 목록 등 다른 라우트의 배경, 영속 AppShell 전역 배경, API·DB 스키마 변경

## 1. 데이터 연결 계약

새 필드를 만들지 않는다. 상세 조회 성공 뒤 아래 기존 정수 코드를
`frontend/src/features/item/lib/element.ts`의 `toElementKey`로 변환한다.

| 화면 | 기존 응답 경로 | 속성 키 |
|---|---|---|
| 경매 상세 | `AuctionDetail.item.element` | `1=water`, `2=fire`, `3=earth`, `4=wind` |
| 아이템 상세 | `ItemInstanceDetail.template.element` | 동일 |

미등록 코드 또는 데이터 로딩 전에는 속성 이미지를 추측하지 않고 중립 배경을 사용한다. 속성 라벨은
기존 `elementLabelOf`/`elementBadgeLabelOf`를 계속 출력하며, 배경색·모션만으로 속성을 전달하지 않는다.
서버 응답과 URL 쿼리로 배경을 선택하지 않고, 성공적으로 검증된 상세 응답만 신뢰한다.

## 2. RouteVisualThemeProvider와 적용 경계

- AppShell은 `RouteVisualThemeProvider`를 소유한다. provider가 제공하는 등록 API의 입력은
  `elementKey`와 정적으로 정의된 상세 테마 variant뿐이며 임의 CSS 값·URL을 받지 않는다.
- provider는 현재 pathname을 `matchPath`로 검증해 정확히 `/auctions/:id`와 `/items/:id`일 때만 등록된
  테마를 소비한다. pathname 불일치 시 등록값이 남아 있어도 즉시 기본 AppShell로 렌더한다.
- 상세 페이지는 **성공 응답**의 `AuctionDetail.item.element` 또는 `ItemInstanceDetail.template.element`를
  `toElementKey`로 검증한 뒤에만 등록한다. URL·쿼리·이전 응답·로딩 데이터로 속성을 추측하지 않는다.
- 배경은 두 상세 라우트가 마운트된 동안에만 **전체 뷰포트/AppShell 시각 영역**을 채운다. 상세 페이지가
  등록 수명을 소유하고 route id·pathname 변경 및 unmount에서 등록을 해제한다. provider도 location 변경 시
  기본값으로 방어 초기화한다.
- `body`·`html` dataset/class/style, localStorage 및 라우트 이탈 후 남는 전역 상태로 테마를 전달하지 않는다.
  다른 라우트에는 배경·Canvas DOM, 속성 테마 selector, 이미지 요청, RAF·listener가 없어야 한다.
- 정확한 `/auctions`는 API 없이 정적 water source를 사용한다. 상세 dynamic registration이 현재 pathname과
  일치하면 그것이 우선하며, static source는 별도 scene을 만들지 않는다. 상세·목록 모두 scene·Canvas·RAF는
  화면당 하나다. 세부 우선순위와 cleanup은 `horizontal-app-shell-contract.md` v1.4 §5.1이 정본이다.
- `/auctions`의 제목·설명·필터·정렬/결과수·상태·grid·pagination은 opaque `auction-list-region` 하나 안에
  둔다. water scene은 region 바깥에 유지하고 내부 card/form은 light baseline을 쓴다. 경계·반응형 정본은
  `horizontal-app-shell-contract.md` v1.4 §1·§5.1·§6이다.
- 장식 레이어는 `position: fixed; inset: 0`을 기준으로 하되 `100vw`로 scrollbar 폭을 침범하지 않는다.
  AppShell root의 격리된 stacking context 안에서 배경은 최하위, 내비·콘텐츠·footer는 그 위에 둔다.
- 콘텐츠 래퍼에는 다이얼로그를 가두는 z-index stacking context를 만들지 않는다. 기존 fixed 다이얼로그
  `z-50`, TopNavbar `z-30`, Sidebar·모바일 drawer·CompareBar·MobileBottomNav의 상대 순서를 보존한다.
- `main`이나 route wrapper에 새 overflow/scroll container를 만들지 않아 `BidPanel` sticky와 body 스크롤,
  다이얼로그의 body scroll-lock 및 `scrollbar-gutter: stable`을 보존한다.
- 로딩·에러·404에는 중립 배경을 사용한다. 이전 성공 응답의 속성 배경을 남기지 않는다.
- 기존 상세 콘텐츠와 내비 surface가 대비를 책임지며, 입찰·구매·판매 액션과 포커스 순서를 변경하지 않는다.
- 목업의 속성 전환기·명암 선택기·효과 선택기는 비교 도구이므로 실제 제품 UI에 넣지 않는다.

## 2.1 몰입형 글래스 셸과 시맨틱 토큰

배경 이미지와 파티클은 Sidebar·TopNavbar·main·footer·CompareBar·MobileBottomNav 뒤에서 한 장면으로
이어져야 한다. 흰색 전면 veil은 사용하지 않고 각 chrome·카드가 국소 surface로 가독성을 책임진다.

- AppShell root에만 상세 route용 시맨틱 CSS custom property를 설정한다:
  `--detail-chrome-surface`, `--detail-chrome-border`, `--detail-content-surface`,
  `--detail-content-border`, `--detail-text`, `--detail-muted`, `--detail-cta-bg`,
  `--detail-cta-text`, `--detail-focus-ring`.
- 네 속성 값은 코드에 정적으로 매핑한다. 사용자/API 입력을 CSS 변수 값으로 직접 대입하지 않는다.
- Sidebar·TopNavbar·footer·CompareBar·MobileBottomNav는 상세 route에서 짙은 navy 반투명 surface를
  소비해 배경을 비치게 한다. dropdown·drawer·modal은 읽기 안정성을 위해 더 높은 불투명도를 허용한다.
- 주요 콘텐츠 카드는 밝은 90~96% surface 또는 승인된 dark 보조 panel을 사용한다. 페이지 전체를 덮는
  흰 veil과 blur/filter 애니메이션은 금지한다.
- 주요 CTA는 브랜드 orange/gold 계열을 유지한다. 속성색은 장식·얇은 border·halo에만 쓰며 위험·성공·
  비활성 상태색과 CTA 의미를 덮지 않는다. 속성은 기존 텍스트 라벨을 계속 병기한다.
- 상세 테마가 없는 route에서 모든 chrome·card·button은 v2 도입 전 클래스·토큰과 시각적으로 동일해야 한다.

## 3. 자산 계약

원본은 `docs/ux/mockups/assets/finalcall-element-{wind|fire|earth|water}-bg-v3.png` 4종이다. 구현 시
배포용 파생 자산을 `frontend/public/img/backgrounds/item-elements/`에 배치하고, 파일명은
`{element}-detail-v3.<format>`으로 고정한다. `docs/` 원본을 런타임에서 직접 참조하지 않는다.

- 원본 PNG를 그대로 복사하지 않고 빌드 전 웹 최적화 파생본을 만든다.
- 4종을 초기 번들 또는 목록 화면에서 선로드하지 않는다. 현재 상세 속성 1종만 지연 로드한다.
- 미등록 코드·로드 실패용 중립 배경은 CSS 그라데이션으로 제공해 네트워크 실패와 분리한다.
- 배경은 장식 이미지다. DOM 이미지로 둘 경우 빈 `alt`, CSS 배경이면 별도 접근성 노출을 하지 않는다.

## 4. 접근성 계약

- `prefers-reduced-motion: reduce`에서는 캔버스/입자와 모든 지속 애니메이션을 제거하고 정적 배경만 쓴다.
- `forced-colors: active`에서는 이미지·효과를 숨기고 시스템 색 기반 콘텐츠 경계를 보장한다.
- 장식 레이어는 `aria-hidden=true`, `pointer-events:none`, 탭 순서 제외다.
- 텍스트·컨트롤 대비는 배경 이미지가 아니라 불투명/반투명 콘텐츠 surface가 책임진다. WCAG AA
  (일반 텍스트 4.5:1, 큰 텍스트와 UI 경계 3:1)를 각 4속성에서 검증한다.
- 320px부터 가로 스크롤이 없어야 하며 확대 200%에서도 주요 액션과 오류 문구가 가려지지 않아야 한다.
- 전체 뷰포트 배경은 landmark·접근 가능한 이름을 추가하지 않으며 내비와 콘텐츠 읽기 순서에 관여하지 않는다.
- nav·card·form·CTA·dropdown·modal은 네 속성 모두 일반 텍스트 4.5:1, 큰 텍스트·UI 경계·focus ring
  3:1을 만족한다. 반투명 surface는 최악의 배경 지점에서 측정한다.

## 5. 성능 계약과 게이트2 결정

원본 v3 PNG 4종은 합계 약 11.4MB(개별 약 2.4~3.1MB)라 그대로 배포하지 않는다.

### 검토 선택지 A — 정적 배경만 (저위험)

현재 속성의 최적화 이미지 1장만 lazy-load하고 CSS 오버레이만 사용한다. 캔버스 입자는 제외한다.
구현·회귀 비용과 배터리 사용이 가장 낮다.

### 승인안 — 하이브리드 배경 + 목업 parity 단일 Canvas

현재 속성의 최적화 이미지 1장만 lazy-load하고 확정 목업 효과를 CSS transform/opacity 위주로 재현한다.
목업의 확정 조합 `wind=b`, `fire=c`, `earth=c`, `water=c`를 시각 정본으로 삼는다. CSS는 큰 ambient
효과를 담당하고, **단일 Canvas**는 네 속성의 작은 파티클 motif·밀도·궤적 parity에 사용할 수 있다.

- Canvas는 화면당 하나, RAF loop도 하나다. desktop 파티클은 목업의 48개를 상한으로 한다.
- mobile·coarse pointer·저전력 환경은 24개 이하 또는 정적 배경으로 강등한다. DPR은 1.5 상한이다.
- `document.hidden`, pathname 이탈, unmount에서 RAF를 즉시 취소한다. resize는 debounce하고 delta를
  40ms 이하로 제한한다. event/media-query listener를 모두 cleanup한다.
- reduced-motion·update:slow에서는 지속 모션을 제거하고, forced-colors에서는 이미지·Canvas를 숨긴다.
- Canvas 초기화·렌더 실패는 장식만 제거하며 chrome·콘텐츠·입찰 기능에는 영향을 주지 않는다.

### 기각 선택지 C — 상한·강등 없는 목업 Canvas 복제 (고위험)

DPR 상한, 입자 수 상한, Page Visibility 정지, resize debounce와 지속 프레임 측정이 추가로 필요하다.
시각 이득 대비 상세 화면의 입찰 상호작용·모바일 배터리 회귀 위험이 커 추천하지 않는다.

승인 기준은 위 **하이브리드안**이다. 배포 자산은 속성별 500KB 이하를 목표로 하고 800KB를 상한으로 하며, 상세
진입 시 현재 속성 배경 외 요청 0건을 검증한다. 배경 실패가 콘텐츠 렌더와 입찰 기능을 막아서는 안 된다.

## 6. 검증 계약

- 단위: 코드 1~4 매핑, 미등록 코드 중립 폴백, 경매/아이템 응답 경로 연결.
- 컴포넌트: 로딩→성공·성공→다른 id·에러 전환에서 이전 배경 잔류 없음.
- 라우트: 두 상세→목록/다른 route 이탈 즉시 theme 등록·배경 DOM·RAF·listener 0개, 다른 route 직접 진입 시
  theme selector·배경·네트워크 요청 0개.
- 접근성: 키보드/스크린리더 회귀 없음, reduced-motion/forced-colors, 320px·200% 확대.
- 성능: 4종 최적화 파일 상한, 현재 속성 1종만 요청, 이미지 실패 시 기능 유지.
- parity: 네 속성의 목업 확정 motif·밀도·궤적을 비교하고, 단일 Canvas·파티클/DPR 상한을 검증한다.
- 회귀: 경매 sticky 입찰·입찰 이력·아이템 상세, AppShell 내비·footer, body scroll-lock, 모달의 z-index와
  포커스 동작 유지.

## 7. 영향 티켓

게이트2 승인에 따라 아래 구현·리뷰 티켓을 확정한다.

1. `FC-232` — 승인 디자인·원본 자산의 근거 티켓. **기존 산출물과 상태는 변경하지 않는다.**
2. `FC-233` — 공용 상세 배경 컴포넌트, 배포 자산 최적화/배치, 폴백·접근성 기반.
3. `FC-234` — `/auctions/:id` 연결과 입찰·레이어링 회귀 테스트.
4. `FC-235` — `/items/:id` 연결과 인증 보호 라우트·상태 전환 회귀 테스트.
5. `FC-236` — 4속성 대비, 감소 모션, 네트워크 요청/자산 크기, 모바일 성능 통합 리뷰.
6. `FC-237` — route-scoped 전체 뷰포트/AppShell 시각 영역으로 적용 경계 변경.
7. `FC-238` — stacking·scroll·modal·접근성·성능 재리뷰.
8. `FC-239` — AppShell route theme host와 시맨틱 토큰 기반.
9. `FC-240` — 네 속성 승인 목업 particle parity 엔진.
10. `FC-241` — 경매 상세 몰입형 글래스 셸 재디자인.
11. `FC-242` — 아이템 상세 몰입형 글래스 셸 재디자인.
12. `FC-243` — route 격리·다른 route baseline·성능 통합 검증.
13. `FC-244` — 접근성·stacking·modal·성능 최종 리뷰.
14. `FC-257` — PC hover arbitration과 `/auctions` 정적 water scene.
15. `FC-258` — hover 접근성·theme 우선순위·scene cleanup 재리뷰.
16. `FC-259` — `/auctions` 불투명 page-level list region.
17. `FC-260` — list region·water scene·responsive 재리뷰.

백엔드·DB·API 계약 티켓은 영향받지 않는다. 공통 목록 배경 티켓도 만들지 않는다.
