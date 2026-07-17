# [Claude Code → 프론트] 완료 보고: 006 스켈레톤 scaffold

대상 지시: `frontend/outbox/006-스켈레톤-scaffold-재발신.md` (정본). 기준 계약 api-contract v1.4.
작업 디렉터리: `D:\Java\finalcall-frontend` (로컬 scaffold — repo 미생성, git 미실행 D-061·062).

## 결과

Vite + React + TS(strict) 스켈레톤을 006 [범위] 10항목대로 생성했다. 라우팅 셸 3종·인증 가드·api 클라이언트(envelope 언랩·에러 정규화·refresh 회전)·계약 타입 1:1·토큰 매핑·공통 UI 상태 3종 완비. `lint`·`typecheck`·`build` 실측 그린, 브라우저에서 셸·가드·복귀·테마 토글 실동 확인. 도메인 feature 없음(정상).

## 산출물 (파일 트리 요지)

루트 툴링(F-002 배선): `package.json` · `tsconfig.json`/`.app`/`.node`(strict + `noUncheckedIndexedAccess`, alias `@/`→src) · `vite.config.ts` · `tailwind.config.js` · `postcss.config.js` · `.eslintrc.cjs`(any 금지 error) · `.prettierrc.json` · `.gitignore`(`.env` 제외) · `.env.example`(`VITE_API_BASE_URL`) · `index.html` · `README.md`.

```
src/
├── App.tsx (Provider 배선 + data-theme 적용) · main.tsx · index.css(토큰 CSS 변수 + 테마 오버라이드) · vite-env.d.ts
├── types/     api.ts(envelope·페이징) · errorCodes.ts(계약 [5] 전 코드) · schema.ts([3.3] 목록/상세)
├── lib/
│   ├── api/   client.ts(base URL·Bearer·언랩·401 refresh 회전) · errors.ts(ApiError 정규화) · session.ts(스토어 브릿지) · queryKeys.ts(키 규약)
│   ├── queryClient.ts(보수적 기본값 + 429 백오프) · returnUrl.ts(오픈 리다이렉트 차단)
├── stores/    authStore.ts(인증 세션, persist 없음) · themeStore.ts
├── components/ ErrorBoundary.tsx · ThemeToggle.tsx · feedback/{Loading,Empty,Error}State.tsx · layout/{Public,AuthForm,Protected,Admin}Layout.tsx
├── routes/    AppRoutes.tsx(라우트 셸) · paths.ts(경로 상수·빌더)
├── pages/     PagePlaceholder.tsx · LoginPage.tsx · SignupPage.tsx · NotFoundPage.tsx
└── features/  README.md (비움 — 도메인 9종 명기)
```

## DoD 대비 (006 [DoD] 6항목 — 실측)

| # | 항목 | 판정 | 근거(실측) |
|---|---|---|---|
| 1 | 3종 레이아웃 + 전 라우트 placeholder 렌더 | 충족 | 브라우저 실동 — Public(홈), AuthForm(로그인), Protected(`/me/wallet`→"지갑" + 보호 nav), Admin(`/admin/auctions/:id`→"관리자 강제 취소" + 관리자 헤더) 렌더 확인. 전 라우트 placeholder + 404. |
| 2 | 인증 가드·`returnUrl` 복귀 동작 | 충족 | 미인증 `/me/wallet` 접근 → `/login?returnUrl=%2Fme%2Fwallet` 리다이렉트 확인. 로그인(stub 세션) 후 `/me/wallet` 복귀 확인. 하드 리로드 시 메모리 세션 소실 → 재로그인 유도(persist 없음, skeleton-plan [6]#5) 동작도 확인. 외부 URL 리다이렉트는 `sanitizeReturnUrl`로 차단. |
| 3 | api 클라이언트 envelope 언랩·에러 코드 정규화 | 충족(빌드/타입 실측) | `lib/api/client.ts` — [1.4] envelope 언랩 후 data 반환, 에러는 `ApiError`(code 기반) 정규화. 401 → refresh 회전(single-flight, 신규 refreshToken 저장) → 실패 시 `clearSession`. `GATEWAY_429` Retry-After → `queryClient` retryDelay 백오프(기존 envelope 재사용, 신규 파서 없음). `GATEWAY_403` 별도 분기 없음. **런타임 왕복은 백엔드 부재로 미실행** — typecheck·build로만 검증. |
| 4 | 토큰 → Tailwind/CSS 변수 매핑 + 테마 토글 | 충족 | 테마 토글 dark→light 실측: `data-theme` 전환 + `body` bg `#0B0F1A`↔`#F8FAFC`, text `#0F172A` 적용 확인. 테마 무관 토큰=정적값, 테마 의존=CSS 변수 + `[data-theme="dark"]` 오버라이드. 등급 토큰 없음(D-073). |
| 5 | 계약 타입 1:1 | 충족 | `types/` — `ApiResponse<T>`·`ErrorResponse`·`CursorPage`·`OffsetPage`([1.4][1.3]), `ItemBlock`·`Auction/Shop Summary·Detail`([3.3], 등급 없음), `ERROR_CODES`([5] 전 코드 + `COMMON_004`·`MEMBER_001/002`·`GATEWAY_*`). 임의 필드 추가·개명 없음. |
| 6 | `lint`·`typecheck`·`build` 그린 | 충족 | `npm run typecheck`(tsc -b) 무오류 · `npm run lint`(eslint) 무경고·무오류 · `npm run build`(tsc -b && vite build) 성공(103 modules, dist 산출). 콘솔 에러 0. |

## 판단 보류·공백 (계약·기획 문서에서 발견)

추측을 피해 멈춘 지점과 상위 문서 정합 판단을 아래에 남긴다. 어느 것도 임의 가정으로 메우지 않았다.

1. **item `element` enum 값 미열거 (계약 [3.3])**: item 블록의 `element` 필드에 대응하는 wire 값(대문자 표기 [1.3])이 계약 본문에 열거돼 있지 않다(design-system·erd는 water/fire/earth/wind 4종을 색으로만 매핑). 추측 매핑(예: `'WATER'`)을 피해 `schema.ts`에서 `element: string`으로 두었다. 확정 시 유니온으로 좁히면 된다. → 계약 보완 또는 확인 필요.

2. **상태 enum의 근거 위계**: `AuctionStatus`(SCHEDULED/ACTIVE/SOLD/UNSOLD/CANCELLED)·`ShopStatus`(ACTIVE/SOLD/EXPIRED/CANCELLED)·`ResultType`(BID/BUYNOW)를 리터럴 유니온으로 타입화했다. 이 값들은 계약 [3.1] 산문 + screen-spec [3.2][3.4] + design-system [5.8]에 열거돼 있으나, **계약 [3.3] 응답 스키마에 필드 값 목록으로 명시되진 않았다.** 문서화된 값만 사용했고 필드 추가는 아니나, 계약이 상태 값을 스키마 레벨에서 확정해 두면 더 안전하다. → 정보 공유(경미).

3. **테마 의존 토큰 범위 차이**: 006 [8]은 테마 의존 토큰을 `bg·surface·surface-raised·border·text·text-muted` 6종으로 열거하나, 토큰 정본 design-system [2.4]는 여기에 `text-subtle·primary-fg·focus-ring`을 더 둔다. 위계(토큰 정본 > 킥오프)에 따라 **정본의 전체 집합을 반영**했다(포커스 가시성·primary 전경색에 필요). 토큰명·구조만 옮기고 값은 CSS 변수 단일 지점 유지. → 정합 판단 보고(임의 확장 아님, 정본 채택).

4. **로그인 stub 세션(스켈레톤 검증 전용)**: DoD [2]의 "returnUrl 복귀 동작"을 실증하려면 세션 확립이 필요한데 실제 로그인(POST /auth/login 폼)은 auth feature 범위다(006 [하지 말 것]). 이를 위해 `LoginPage`에 **명시적으로 "스켈레톤 검증 전용"으로 주석 처리한 임시 세션 버튼**(사용자/관리자)을 두어 가드→복귀·관리자 가드를 실동 검증했다. 실 API·자격 검증은 없고 메모리 세션만 세팅한다. **auth feature 착수 시 실제 로그인 호출로 대체·제거** 필요. → 판단 근거 공유(도메인 로직 아님, 세션 인프라는 스켈레톤 범위).

5. **client 내부 sentinel 코드 `NETWORK_ERROR`**: envelope 파싱조차 실패한 경우(네트워크 단절·비정형 응답)의 폴백으로 계약 [5]에 없는 클라 내부 `code: 'NETWORK_ERROR'`를 `ApiError`에 부여했다. 계약 코드로 오인되지 않도록 sentinel임을 주석에 명기했다. 계약 표를 오염시키지 않는다. → 정보 공유.

6. **미착수(범위 밖, 기획 잔여 공백 유지)**: 홈 통합 피드 표시 규칙(screen-spec [5] 공백 1)·실시간 채널(공백 2)·교환 비율(공백 3)은 006 [하지 말 것]대로 손대지 않았다. 홈 라우트는 placeholder만. persist 방침(skeleton-plan [6]#5)은 메모리 세션으로 두었고 wallet 착수 전 보안 검토 대상으로 남는다. 아이템 이미지 파생(screen-spec [3.5-b])은 item feature 단계라 미구현.

## 커밋 메시지 제안 (실행은 사용자, D-061 — 프론트 CLAUDE.md [6])

```
chore(skeleton): stage 0 - Vite+React+TS 스켈레톤 + 공유 계층

- 툴링: Vite+React+TS(strict, noUncheckedIndexedAccess), alias @/, ESLint(any 금지)+Prettier
- 라우팅 셸 3종(Public/Protected/Admin) + AuthForm + 전 라우트 placeholder
- 인증 가드: 미인증 Protected→/login?returnUrl(내부 경로 한정), 관리자 가드
- 공용 타입: 계약 v1.4 envelope·페이징·[3.3] 목록/상세·에러코드 1:1(등급 없음)
- api 클라이언트: envelope 언랩·에러 정규화·401 refresh 회전·429 Retry-After 백오프
- 전역 상태: 인증 세션(persist 없음)·테마(Zustand) + TanStack Query Provider
- 디자인 토큰: design-system 토큰명 1:1 → Tailwind + CSS 변수([data-theme] 오버라이드), 값 A안 잠정
- 공통 UI 상태 3종(로딩·빈·에러) 골격 + 전역 에러 바운더리

계약 기준: api-contract v1.4. 도메인 feature 없음(스켈레톤).
```

주: repo 생성·계약 v1.4 복사본 헤더 기입·초기 push는 사용자 전담(062). 검증 완료 상태.
