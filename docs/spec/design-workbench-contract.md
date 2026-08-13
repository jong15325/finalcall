# 디자인 워크벤치 계약 v0.1

- 상태: **DECIDED — 게이트2 사용자 승인 (2026-08-13)**
- 적용 범위: `frontend/src/workbench/**`, `frontend/src/app/router.tsx`, `frontend/src/index.css`,
  `frontend/scripts/**`, `frontend/package.json`, 디자인 게이트 검증
- 선행 계약: `frontend-ui-system-contract.md` v1.0, `horizontal-app-shell-contract.md` v1.5
- 제외: API wire contract, 백엔드, DB 스키마, 운영 route의 UI 계약과 데이터 계약
- 목적: 목업이 실제 프론트와 달라지는 문제를 없애고, 이후 디자인 판단을 실제 런타임 CSS·shell·공용
  컴포넌트에서 검증한다.

## 1. 현행 기준과 문제

현재 프론트는 다음 구조를 이미 정본으로 사용한다.

- `frontend/src/main.tsx`가 `index.css`를 한 번 import한다.
- `index.css`가 `styles/tokens.css`와 Tailwind를 로드한다.
- `App.tsx`의 provider 순서는 BrowserRouter → QueryClient → Auth다.
- 공개·보호 화면은 `AppShell`, 인증 화면은 `AuthLayout`이 React Router `Outlet`을 소유한다.
- navigation과 footer는 `AppShell`의 실제 `TopNavbar`, `HorizontalNav`, `MobileBottomNav`,
  `AppFooter`가 렌더한다.

반면 `docs/ux/mockups/*.html`은 각 파일이 shell·markup·CSS를 복제하므로, 실제 컴포넌트나 token이
변경되어도 자동으로 따라가지 않는다. CSS 값을 다시 복사해 맞추는 것은 두 번째 정본을 만들 뿐이며 해결책으로
인정하지 않는다.

## 2. 결정안과 게이트2

### 2.1 승인 결정

Vite 개발 서버에서만 존재하는 `/__design/<scenario>` 워크벤치를 운영 app의 동일 provider·router 안에 둔다.
`import.meta.env.DEV`로 감싼 lazy import 경계 밖에서는 `src/workbench/**`를 import하지 않는다. 각 scenario는
실제 `AppShell` 또는 `AuthLayout` 아래 실제 공용 컴포넌트를 조립하고, 차이는 fixture와 semantic token
override로만 주입한다.

Vite는 `import.meta.env.DEV`를 빌드 시 정적으로 치환해 production에서 해당 분기를 tree-shake할 수 있다.
Tailwind 4는 번들 도달성이 아니라 소스 텍스트를 스캔하므로 `index.css`에서 `src/workbench/**`를 source
detection 대상에서 명시적으로 제외한다. 따라서 워크벤치가 쓰는 class는 production source에도 이미 존재하는
semantic utility여야 한다. 근거는 [Vite 환경 상수](https://vite.dev/guide/env-and-mode)와
[Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)이다.

### 2.2 비교 선택지

| 안 | 장점 | 비용·위험 | 판정 |
|---|---|---|---|
| A. 운영 app 내부 dev-only lazy route | provider·CSS·shell·반응형을 그대로 재사용, drift 최소 | route/build 격리 guard 필요 | **승인** |
| B. 별도 Vite entry의 독립 preview app | 운영 router와 물리 분리 | provider·router·전역 환경을 다시 조립해 새 drift 경계 생성 | 비추천 |
| C. 정적 HTML에 운영 CSS를 복사 | 시작 비용이 작음 | shell·markup·상태가 계속 분기, 복사 CSS가 두 번째 정본이 됨 | 폐기 |

이 결정은 API·스키마·백엔드 성능을 바꾸지 않는다. 다만 개발 route 경계, Tailwind source detection,
production 산출물 검증과 조직의 디자인 게이트 정본을 바꾸므로 **계약 및 되돌리기 비용이 있는 게이트2
대상**이다. 2026-08-13 사용자 승인으로 A안을 확정했으며, B안과 C안은 채택하지 않는다.

## 3. route와 모듈 경계

### 3.1 URL 계약

- 정식 경로는 `/__design/<scenario>`다. `<scenario>`는 typed registry의 ID와 정확히 일치한다.
- `/__design`은 개발 환경에서 scenario 목록 또는 명시적인 안내를 제공할 수 있다.
- 등록되지 않은 ID는 워크벤치 내부의 접근 가능한 not-found를 표시한다.
- fixture variant가 필요하면 `?variant=<id>`를 쓴다. URL segment를 늘리거나 운영 `paths.ts`에 등록하지 않는다.
- production에서는 위 route가 존재하지 않으며 운영 router의 기존 `*` not-found로 귀결된다.

### 3.2 import 경계

운영 router에는 아래 의미의 경계 하나만 허용한다. 실제 변수명은 달라도 된다.

```tsx
const DevelopmentWorkbench = import.meta.env.DEV
    ? lazy(() => import('@/workbench/WorkbenchRoutes'))
    : null
```

- dev route 선언도 `DevelopmentWorkbench !== null` 조건 안에 둔다.
- `src/workbench/**`의 유일한 production-side import 지점은 이 lazy import 경계다.
- production module은 workbench module, fixture, scenario, candidate를 import하지 않는다.
- registry는 eager barrel이 아니라 scenario별 lazy loader를 사용한다. 한 scenario 진입이 다른 모든 후보의
  module initialization을 유발하지 않는다.
- 별도 BrowserRouter, QueryClientProvider, AuthProvider, `main.tsx`, HTML entry를 만들지 않는다. 현재
  `App.tsx` provider 순서를 그대로 소비한다.

## 4. scenario registry와 preview frame

registry는 최소한 아래 의미를 타입으로 고정한다.

```ts
type WorkbenchShell = 'app' | 'auth'
type WorkbenchScenarioId = string

interface WorkbenchScenarioDefinition<TFixture> {
    id: WorkbenchScenarioId
    title: string
    shell: WorkbenchShell
    routeContext: string
    load: () => Promise<WorkbenchScenarioModule<TFixture>>
    variants?: readonly string[]
}

interface WorkbenchScenarioModule<TFixture> {
    default: React.ComponentType<{ fixture: TFixture }>
    fixture: TFixture
}
```

- `shell: 'app'`은 실제 `AppShell` route element와 그 `Outlet` 아래 scenario를 렌더한다.
- `shell: 'auth'`는 실제 `AuthLayout` route element와 그 `Outlet` 아래 scenario를 렌더한다.
- `routeContext`는 `paths.ts`로 조립한 실제 운영 pathname이다. workbench 내부의 중첩 `Routes`가 이 location을
  매칭해 `useLocation` 소비자에게 제공하되 브라우저 주소는 `/__design/<scenario>`로 유지한다. 예를 들어
  홈 chrome 후보는 `/`, 가입 frame 후보는 `/signup`, 상세 후보는 concrete 상세 pathname을 사용한다.
  이를 생략하면 `AppShell.resolveRouteUi()`가 workbench URL을 404로 판단하고 `AuthLayout`도 가입 폭을 선택하지
  못하므로 동일 환경으로 인정하지 않는다.
- shell이 `Outlet`을 소유한다는 현재 계약을 유지한다. workbench 때문에 `children`·`preview` prop을
  AppShell/AuthLayout에 추가하거나 shell 내부 조건문을 넣지 않는다.
- navigation, footer, mobile drawer, CompareBar, world map을 workbench가 다시 조립하지 않는다.
- workbench toolbar가 필요하면 content scenario 안에 두되 shell 위에 겹치거나 캡처 viewport를 변형하지 않는다.
  variant는 URL로 직접 열 수 있어야 한다.

## 5. 재사용과 후보 컴포넌트

### 5.1 직접 재사용 의무

- 전역 스타일은 현재 `main.tsx → index.css → tokens.css` 경로만 사용한다. workbench에서 이 파일들을 다시
  import하거나 내용을 복사하지 않는다.
- 버튼·카드·dialog·목록·금액·상태·brand·layout은 production 공용/feature 컴포넌트를 직접 import한다.
- 실제 컴포넌트에 필요한 상태는 public props와 기존 context/store 계약으로만 넣는다. DOM을 베껴 비슷하게
  만드는 adapter는 허용하지 않는다.

### 5.2 신규 후보

- 아직 채택되지 않은 후보는 `src/workbench/candidates/**`의 실제 React 컴포넌트로 만들 수 있으나 운영 route와
  production component에서 import하지 않는다.
- 후보는 실제 production component를 composition하고 기존 semantic utility만 소비한다. shell, 공용 버튼,
  카드, dialog를 후보 이름으로 복제하지 않는다.
- 후보 채택 시 production feature/common 위치로 **이동**하고 테스트를 갖춘 뒤 운영 route에 연결한다. workbench
  사본과 production 사본을 함께 유지하지 않는다.
- workbench 전용 CSS/SCSS/CSS module, `<style>`, CSS-in-JS, raw utility stylesheet를 금지한다.
  `src/workbench/**`는 Tailwind source detection에서도 제외하므로 workbench-only utility를 새로 만들 수 없다.

## 6. fixture와 semantic token override

fixture가 소유할 수 있는 것은 아래 세 범위뿐이다.

1. 컴포넌트 입력 데이터와 고정 시간
2. loading·empty·error·success, 로그인 여부, 선택 상태 같은 재현 가능한 UI 상태
3. 승인 후보를 비교하기 위한 semantic CSS custom property override

- fixture는 API 응답인 척하는 전역 fetch monkey patch, 실제 mutation, 운영 데이터 쓰기를 수행하지 않는다.
- 인증 fixture는 기존 auth store의 public action으로 심고 scenario 이탈·variant 전환 때 원상 복구한다.
- query/store/timer 상태는 scenario 간 격리하며 캡처가 끝난 뒤 다른 화면에 누출하지 않는다.
- fixture에는 JSX, shell markup, 공용 컴포넌트 구현, CSS selector가 들어가지 않는다.
- token override key는 `frontend-ui-system-contract.md`의 semantic alias 중 해당 시나리오가 선언한 allowlist로
  제한한다. 예: `--chrome-bg`, `--chrome-bg-strong`, `--chrome-bg-raised`, `--chrome-bg-selected`,
  `--control-action`, `--control-action-hover`, `--control-action-ink`, `--control-focus`.
- override는 shell 바깥의 단일 scope element에 inline custom property로 적용해 navigation·footer·button이 같은
  후보를 소비하게 한다. `:root`, `html`, `body`를 변경하지 않으며 unmount 시 흔적이 남지 않는다.
- raw color 후보값은 `src/workbench/fixtures/**`에서만 허용하고 contrast 검증 대상에 포함한다. production token
  registry를 후보 비교 목적으로 수정하지 않는다.
- 취소·승인·위험·성공 같은 의미 상태는 brand override와 분리한다. 후보가 상태 의미를 재색하지 않는다.

## 7. production 제외 계약

`npm run build` 산출물은 다음 조건을 모두 만족해야 한다.

- `/__design` route와 workbench lazy chunk가 없다.
- JS/CSS/HTML/source map에 `__design`, 고유 workbench marker, scenario ID, fixture ID가 없다.
- `src/workbench/**`의 module 또는 workbench-only Tailwind utility가 없다.
- production module graph에서 `src/workbench/**`로 향하는 import는 DEV 조건 lazy 경계 외 0건이다.
- `/__design/<known-scenario>`를 production preview에서 열면 운영 not-found가 표시된다.

이를 위해 `index.css`는 Tailwind의 `@source not`으로 `src/workbench/**`를 제외한다. workbench에서 사용한 class
token이 production source에 존재하지 않으면 정적 guard가 실패해야 한다. 단순히 파일명만 확인하지 않고 build
산출물 본문도 재귀 검사한다.

## 8. 자동 guard

FC-287은 기존 `check:ui-system`과 build 흐름에 다음 실패 조건을 연결한다.

- workbench 아래 stylesheet, `<style>`, raw color의 fixture 밖 사용
- workbench에서 AppShell/AuthLayout/navigation/footer/common component를 재선언하거나 동일 파일명으로 복제
- production → workbench 역방향 import 또는 DEV 조건 밖 route/import
- registry ID 중복, URL-safe하지 않은 ID, fixture variant 미등록
- `paths.ts`에서 유도되지 않은 route context 또는 route context와 shell 종류의 불일치
- semantic override allowlist 밖 custom property, 상태색 override, scope 밖 전역 style mutation
- workbench class 중 production source 어디에도 존재하지 않는 Tailwind utility
- production build 산출물에 [7]의 marker 또는 route/code 잔존

guard는 문자열 하나만 우연히 일치해 생기는 오탐을 피하도록 고유 marker 목록과 module graph 조건을 함께 쓴다.
가드는 production build 뒤 실행되는 별도 script이거나 `prebuild/postbuild`에 연결할 수 있지만, 로컬과 CI에서 같은
명령으로 재현되어야 한다.

## 9. 브라우저·접근성 검증

각 디자인 게이트 후보와 FC-288 통합 리뷰는 개발 서버의 동일 scenario/variant를 다음 두 viewport에서 직접 연다.

| 구분 | viewport | 필수 확인 |
|---|---:|---|
| mobile | `390 × 844` | mobile navigation·safe area·가로 overflow·44px 권장 touch target |
| desktop | `1280 × 800` | horizontal navigation·content plane·footer·focus 순서 |

공통 검증은 다음과 같다.

- 실제 navigation, footer, primary/secondary/semantic button이 같은 token 후보를 소비한다.
- loading·empty·error·success와 hover·focus-visible·active·disabled 상태를 확인한다.
- 키보드만으로 모든 조작에 도달하고, focus가 가려지지 않으며 drawer/dialog Escape와 focus 복귀가 동작한다.
- 본문 4.5:1, 큰 텍스트와 UI 경계 3:1, 색 외 라벨/아이콘 병기를 확인한다.
- 금액·잔액·카운트다운은 tabular 숫자를 유지하고 상태 전환 때 layout shift가 없다.
- `prefers-reduced-motion`, 200% 확대, 긴 한국어 문구에서도 정보 손실이나 가로 overflow가 없다.

필수 명령은 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, workbench guard다. 브라우저 증거는
390·1280 각 viewport의 캡처 또는 리뷰 기록으로 남긴다.

## 10. 기존 정적 목업의 지위

- 기존 `docs/ux/mockups/*.html`과 연결 asset은 삭제하지 않고 **역사 참고 자료로 동결**한다.
- 기존 파일은 당시 선택지와 결정 맥락을 설명할 수 있으나 현재 프론트의 시각 정본, 회귀 기준, 디자인 게이트
  승인 증거가 아니다.
- 기존 HTML을 최신 frontend와 맞추기 위한 CSS·shell·component 수정은 하지 않는다.
- 이후 navigation·footer·button·page·주요 component의 신규 시각안은 이 계약의 workbench scenario로 만든다.
  원본 아트·생성 이미지 자체를 비교하는 자료는 `docs/ux/mockups/assets/**`에 둘 수 있지만, 실제 UI 합성 검증은
  workbench에서 한다.

## 11. 영향 티켓과 승인 후 순서

| 티켓 | 영향 | 계약 근거 |
|---|---|---|
| FC-284 | DEV lazy route, typed scenario registry, unknown/index 처리 | [3], [4] |
| FC-285 | 실제 AppShell/AuthLayout route tree, fixture/token scope와 상태 격리 | [4]~[6] |
| FC-286 | 메인 색상 10안을 semantic override scenario로 이관 | [5], [6], [9] |
| FC-287 | stylesheet·복제·역방향 import·Tailwind·production artifact guard | [7], [8] |
| FC-288 | 390/1280 브라우저, 접근성, 전체 frontend 검증과 production 격리 판정 | [7]~[9] |

의존 순서는 `FC-283 → FC-284 → FC-285 → FC-286`, `FC-283 → FC-287`,
`FC-286 + FC-287 → FC-288`이다. 2026-08-13 게이트2 승인으로 계약이 DECIDED가 되었으므로
FC-284~FC-288은 위 의존 순서와 각 티켓 DoD에 따라 구현할 수 있다.
