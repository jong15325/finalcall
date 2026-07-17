상태: VOID(무효) — 실행 금지 (2026-07-15). 사유: 발신 전제("CC 미착수")가 **거짓**이었다. CC는 006을 이미 완주했다(`notes/cc-reports/006-skeleton-scaffold.md`, DoD 6항목 실측 그린). 오판 원인 = 호스트 Glob이 채워진 디렉터리에도 0건을 반환(에러 없이 stale/공집합 서빙)했고 이를 "미착수" 근거로 삼은 것. Grep 재확인으로 006 보고 실재 확인.
경고: 본 지시를 실행하면 완성된 스켈레톤을 처음부터 재생성하게 된다. **실행하지 마라.** 남은 작업은 A안 → U-020 토큰 교체뿐이며, 별도 지시로 발행한다(디자인 회신 후 — outbox/009 질의 대기).
supersedes: frontend/outbox/006-스켈레톤-scaffold-재발신.md (U-020 토큰 명칭 확정 — 생성 전 편입)
# [프론트 → Claude Code] 작업 지시: skeleton - 프론트 스켈레톤 scaffold (U-020 토큰 반영)

대상: 프론트 클라이언트 스켈레톤 — 라우팅 셸·인증 가드·api 클라이언트·공용 타입·전역 상태 골격·토큰 매핑·공통 UI 상태 3종. 도메인 feature 제외.

참조: `docs/frontend-planning/skeleton-plan.md` v0.2(선행 기준선 — 범위 [2]·IA 셸 [3]·토큰 방침 [4]·계약 정합 [5]·DoD [7]), `docs/api-contract.md` **v1.4**(계약 정본), `docs/frontend-planning/screen-spec.md` v0.3(IA·라우트), `docs/ux/design-system.md` **v0.2**(토큰 정본 — [2.6] 확정 팔레트), 프론트 `CLAUDE.md` [3]~[6], F-002(구성), 062(레인 순서·repo 후생성), ux/017(U-020 통지).

근거(인용) (D-082):
- 범위 — skeleton-plan [1]: "스켈레톤 = 도메인 feature를 채우기 전에 모든 feature가 공통으로 딛는 바닥이다. ... 도메인 지식을 스켈레톤에 넣지 않는다."
- 계약 기준 — api-contract 상태줄: "상태: v1.4 — G3 확정(2026-07-14) + 6절 계약 변경 4건(D-070, D-073, 엣지 오류 명세/057, 회원 리소스 공백 보완/069)."
- envelope — api-contract [1.4]: "성공: `{ \"success\": true, \"data\": <object|null>, \"timestamp\": \"<ISO-8601 UTC>\" }`."

## 작업 디렉터리 (repo 후생성 — 062)

repo는 **아직 만들지 않는다.** 로컬 작업 디렉터리에 scaffold → DoD 검증 → 그 후 사용자가 repo 생성·초기 push. `git init`·커밋·푸시를 실행하지 마라(D-061).

## 범위 (포함 — skeleton-plan [2])

1. **부트스트랩·툴링(F 구성 F-002)**: Vite + React + TypeScript(strict, `noUncheckedIndexedAccess` 포함). path alias `@/` → `src`. ESLint + Prettier(named export 우선, `any` 금지). 스크립트: `dev`·`build`·`lint`·`typecheck`.
2. **폴더 구조(CLAUDE.md [3])**: `src/{features,components,stores,lib,types,pages}`. `features/`는 비워 두고 README로 도메인 9종만 명기(auth·auction·bid·shop·item·inventory·order·wallet·admin).
3. **라우팅 셸(skeleton-plan [3])** — 레이아웃 3종 + 전 라우트 **빈 placeholder**:
   - Public: `/` · `/auctions` · `/auctions/:auctionPublicId` · `/shops` · `/shops/:shopPublicId` · `/items/:itemInstancePublicId` · `/market-prices`
   - Public(Auth 폼, 최소 변형): `/login` · `/signup` — 인증 상태면 `/`로 되돌림
   - Protected: `/sell` · `/me/inventory` · `/me/temp-storage` · `/me/orders` · `/me/orders/:orderPublicId` · `/me/wallet` · `/me/wallet/charge/confirm` · `/me/profile`
   - Admin: `/admin/auctions/:auctionPublicId` — 인증 + `isAdmin`
4. **인증 가드**: 미인증 Protected 접근 → `/login?returnUrl=<원경로>` 복귀(**앱 내부 라우트 한정** — 외부 URL 리다이렉트 금지). 관리자 판정은 **서버 권위**, 클라 `isAdmin`은 UI 노출 제어용일 뿐 인가 아님(api-contract [1.2]).
5. **공용 타입(계약 1:1, 임의 필드 추가·개명 금지)**: `ApiResponse<T>`·`ErrorResponse`([1.4]) · `CursorPage<T>`·`OffsetPage<T>`([1.3]) · 목록/상세 스키마([3.3] — `AuctionSummary`/`AuctionDetail`·`ShopSummary`/`ShopDetail`·`item` 블록, **등급 없음** D-073) · `ErrorCode` 상수([5] 전 코드 + `COMMON_004` + `GATEWAY_*`[1.6] + **`MEMBER_001`·`MEMBER_002`** v1.4).
6. **api 클라이언트(lib/api)**: base URL `/api/v1`(env 오버라이드), `Authorization: Bearer` 첨부, [1.4] envelope 언랩 후 `data` 반환, 에러는 `code` 기반 정규화. 401 → refresh 회전([2] 회전 정책: 신규 refreshToken 저장) → 실패 시 세션 정리·재로그인. `AUTH_004`(401) = 세션 정리 후 재로그인 유도. `GATEWAY_429`([1.6]) = `Retry-After` 존중 백오프(없으면 기본) — **기존 envelope 소비 로직 재사용, 신규 파서 금지**. `GATEWAY_403` = **별도 분기 두지 않음**.
7. **전역 상태(CLAUDE.md [4])**: Zustand 최소 — 인증 세션(`accessToken`·`accessExpiresAt`·`refreshToken`·user 요약) + 테마. **persist 없음(메모리 세션)** — skeleton-plan [6]#5 보안 사안, 새로고침 시 재로그인이 정상. TanStack Query Provider + QueryClient(보수적 기본값). 쿼리 키 `[도메인, 리소스, 파라미터]` 헬퍼. **서버 데이터를 Zustand·useState에 복제 금지.**

8. **디자인 토큰 — U-020 확정 팔레트(design-system v0.2 [2.6] 정본)**

   구조는 skeleton-plan [4] 그대로다(테마 무관=Tailwind 정적값 / 테마 의존=CSS 변수 + `[data-theme]`). **명칭·값만 아래 확정본을 쓴다.** A안 잠정 팔레트는 폐기됐다 — 게임 상태 언어가 명도 스케일이 아니라 hue 전환이라 `primary-500/600/700` 명칭이 성립하지 않는다.

   `tailwind.config.js` — `theme.extend.colors` **전체**:
   ```js
   colors: {
     // 조작 계층 — 게임 상태 언어(테마 무관 정적값)
     primary: { DEFAULT:'#0667BD', hover:'#0560AD', pressed:'#E25706', selected:'#E2B206', disabled:'#0A3A63', fg:'#FAF7D5' },
     'on-accent-fg': '#001C33',

     // 정보 계층 — 의미색(-soft 는 12% 알파 합성, 별도 토큰 없음)
     success:'#4ADE80', warning:'#E2B206', danger:'#FF4D4D', info:'#3394DE',

     // 아이템 계층 — 아트 실측(변경 금지)
     element: { water:'#19B2FF', fire:'#FF5500', earth:'#95B259', wind:'#66CCCC' },

     // 표면·텍스트 — CSS 변수 참조
     bg:'var(--color-bg)', surface:'var(--color-surface)', 'surface-raised':'var(--color-surface-raised)',
     'surface-slot':'#000000',
     border:'var(--color-border)', 'border-muted':'var(--color-border-muted)',
     text:'var(--color-text)', 'text-muted':'var(--color-text-muted)', 'text-subtle':'var(--color-text-subtle)',
   }
   ```

   전역 CSS — 변수 블록:
   ```css
   :root, [data-theme="dark"] {
     --color-bg: #001C33;             --color-surface: #012A4A;
     --color-surface-raised: #013A63; --color-border: #3394DE;
     --color-border-muted: #14496E;   --color-text: #FAF7D5;
     --color-text-muted: #B8C4D9;     --color-text-subtle: #6B8CA6;
   }
   ```

   **만들지 마라(죽은 설정)**: `primary` 50/100/300/500/600/700 6단 스케일 · `accent` 500/600 · 의미색 `-soft`/`-strong` 변형 · **등급(grade) 토큰**(D-073).

   라이트 테마 값은 **아직 미확정**(U-005)이다. `[data-theme]` **토글 기제만** 만들고 라이트 값을 임의로 지어내지 마라 — 현재 `:root`와 dark가 동일한 것이 정상이다. 타이포·간격·반경·그림자·모션도 동일 원칙(design-system [3]·[4]): 토큰명 1:1, 정본 참조.

9. **공통 UI 상태 3종**: 로딩(스켈레톤)·빈 상태·에러의 **골격만**(각 화면 카피는 feature 단계).
10. **시간·식별자**: 서버 `Instant`(UTC, ISO-8601) 수신 그대로 보관, 표시 시점에만 로컬 변환. 외부 식별자는 `public_id`(ULID), `item_template`은 `typeCode`([1.1]). 내부 BIGINT id 타입에 두지 마라.

## 하지 말 것 (skeleton-plan [2] 제외)

- **도메인 feature 구현 9종**(화면·쿼리 훅·도메인 컴포넌트) — 라우트 placeholder까지만. 경매·입찰 규칙이 스켈레톤에 새면 안 된다.
- **토큰을 컴포넌트에 바르지 마라.** 스켈레톤에서 토큰은 **정의만** 하고 소비처를 만들지 않는다(Button 등 시안 컴포넌트 금지). 확산이 0이어야 후속 조정 비용이 0으로 유지된다.
- **회원 리소스 화면 구현**(프로필·닉네임 수정·탈퇴 폼·탈퇴 확인 UI) — member feature 단계. `/me/profile`은 **placeholder만**.
- **비주얼 추가 확정**(라이트 테마 값·타이포 최종), **실시간 채널**(SSE/WS — 폴링 전제 F-001, 구독 계층 두지 마라), **홈 통합 피드 표시 규칙**(탭 분리 잠정).
- **repo 생성·git 커밋/푸시**(사용자 전담, D-061).
- **계약에 없는 엔드포인트·필드 추측 추가** — 공백 발견 시 멈추고 완료 보고에 적시(D-028 선착순 기준 금지).
- 시크릿·API 키 하드코딩(`.env.example`만, 실제 `.env`는 `.gitignore`).

## 구현 지침

프론트 `CLAUDE.md` [3]~[6] 준수 — feature 구조, 서버 데이터=TanStack Query(복제 금지), 에러코드 상수 분기(try-catch 산발 금지 — Query error 경로 + 전역 에러 바운더리), Tailwind 유틸 우선, strict·`any` 금지(불가피 시 사유 주석). 절 참조 표기는 대괄호 `[N.M]`(D-087).

## DoD (skeleton-plan [7])

(1) 3종 레이아웃 + 전 라우트 placeholder 렌더 (2) 인증 가드·`returnUrl` 복귀 동작 (3) api 클라이언트 envelope 언랩·에러 코드 정규화 (4) 토큰 → Tailwind/CSS 변수 매핑 + 테마 토글 1회 동작 (5) 계약 타입 1:1 (6) `lint`·`typecheck`·`build` 그린. **도메인 feature 없음이 정상이다.**

## 완료 보고 반환 경로 (D-088)

정본은 **파일**이다. 채팅 요약은 선택.
- 저장 경로: **`docs/frontend/notes/cc-reports/007-skeleton-scaffold.md`**
- 내용: 결과 요약 · 산출물(파일 트리 요지) · DoD 항목별 충족/미충족(`lint`·`typecheck`·`build`는 **실행 결과 실측** — 추정 금지) · 계약·기획 공백이나 판단 보류 지점 · 커밋 메시지 제안.
- **금지 경로**: `frontend/outbox/`(발신 이력 전용) · `decision-log.md` · `inbox-log.md` · 타 역할 폴더 전부.
- 사용자 복붙 중계 불요 — 프론트 대화가 "수신 확인" 시 인계함을 스캔해 흡수한다.

## 참고 (스켈레톤 범위 아님 — feature 단계 제약, ux/017 [5])

1. `element` 칩은 `bg`(#001C33) 위에만 놓는다 — `primary` 패널 위에선 water 2.4:1·fire 1.78:1로 대비가 무너진다.
2. hover는 채우기만으론 지각되지 않는다 — `primary.hover`는 인접 대비 1.12라 `border`를 #3394DE로 밝히는 것과 **함께** 써야 한다.

## 커밋 제안 (실행은 사용자, D-061 — 프론트 CLAUDE.md [6])

```
chore(skeleton): stage 0 - Vite+React+TS 스켈레톤 + 공유 계층
```
