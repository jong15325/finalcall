# FC-016 리뷰 — 프론트 내 계정 (EPIC-FE-MEMBER = FC-013 + FC-014 + FC-015)

대상: FC-013(auth 실구현) + FC-014(마이페이지 프로필·닉네임·탈퇴) + FC-015(잔액 표시) · reviewer 정식 통합 리뷰 · **통과 권고**. 워킹트리 변경(커밋 전) 대상.
근거 스킬: concurrency-review(JWT·세션 경로) · coding-discipline. 기준: CLAUDE.md §5·§7, `frontend-account-spec.md`, `design-system.md` U-021, api-contract §2·§2.5·§4.4, accessibility.md.

## 판정
review_status: **passed** (critical 0 · major 0 · minor 5). 커밋 진행 가능.

## 검증 증거
- `npm run typecheck` — 통과(무출력)
- `npm run lint` — 통과(0 problems)
- `npm run build`(tsc + vite) — 성공(125 modules, dist 정상 산출)

## 심각도별 발견

### Critical / Major
없음. 핵심 요구(토큰 교체·하이드레이션·COMMON_005 열거방지·탈퇴 동의·stub 제거)가 모두 정확히 이행됨.

### Minor
- **M1. NotFoundPage 퍼플 채움 CTA — U-021 CTA=ink 규칙 위반.** `pages/NotFoundPage.tsx`의 홈 링크가 `bg-primary`라 토큰 교체로 남색→퍼플 채움으로 회귀. design-system [1.2]①·[2.2]·[5.1]("퍼플은 액센트만, 주 CTA는 ink") 위반. 대비는 통과(8.42:1)라 접근성 아닌 순수 디자인 규칙. 계정 플로우 밖·기능 무영향. → **FC-017**로 분리(별도 티켓). frontend-impl이 무관 파일 임의 편집 않고 플래그한 것은 coding-discipline 준수로 타당.
- **M2. ThemeToggle 시각적 no-op.** `themeStore` 기본 'dark'로 `data-theme="dark"`가 붙지만 index.css에 다크 오버레이가 없어 항상 라이트 렌더 → 토글이 비기능 컨트롤. U-005 다크값 미창작 규율 자체는 준수. → **FC-018**로 분리(토글 숨김/disabled 또는 기본 'light').
- **M3. 보드 상태 전이를 frontend-impl이 기록(프로세스).** artifacts 부기 위주이며 `review_status` 자가승격은 없었음(정상). 메인세션이 정본 재정합으로 해소(본 커밋에 반영).
- **M4. getMe 명시-토큰 헤더 보증이 암묵적(강건성).** 하이드레이션 시 client가 `auth:true` 기본에서 store 토큰으로 Authorization을 덮어쓸 수 있으나, `/login` 진입 시 store가 비어 있어(토큰 null→덮어쓰기 skip) 실제로는 안전. 토큰 누출 없음 확인. 가드 의존 성질만 기록.
- **M5. 범위 밖 산출물.** `PRODUCT.md`(신규)는 FC-016 범위 밖 — impeccable init 산출로 별도 docs 커밋 처리. `.claude/settings.local.json.tmp.*`는 하네스 아티팩트(무시).

## 확인된 정합 (근거 대조 완료)
- **보안**: authStore persist 미도입(메모리 세션), 신규 코드 localStorage/cookie/dangerouslySetInnerHTML 0. returnUrl `sanitizeReturnUrl` open-redirect 차단(외부/프로토콜상대/백슬래시). COMMON_005 상수만 추가·특정 카피 0·client.ts 401 위임(SEC-007 열거방지). AUTH_003 통합 에러(계정/비번 비특정). isAdmin 표시 전용(인가 아님). 하이드레이션 login→getMe(명시 토큰·스토어 비의존)→setSession 순서, 중간 인증상태 없음.
- **QA/계약**: 엔드포인트 §2·§2.5·§4.4 1:1, 임의 필드 0(password 확인 클라 전용). 에러 매핑 AUTH_001/002/003·MEMBER_001/002·검증400 errors[] 전부 spec §3.4와 일치. 탈퇴 미체크 disabled+사유 병기·`balanceForfeitAcknowledged:true`·MEMBER_002 차단·성공 시 clearSession+qc.clear→홈. stub 잔재 0.
- **토큰 교체**: tailwind.config.js·index.css가 design-system [2.6]과 정확히 일치(ink·primary 5단·의미색·element-soft·kakao/naver·반경·그림자). 구 U-020 남색값 잔재 0. `[data-theme="dark"]` 미창작(U-005 대기 준수). index.html 라이트 기본 정합.
- **접근성**: Field(라벨 가시·aria-invalid·aria-describedby·border-strong 3:1), Modal(role=dialog·aria-modal·포커스 트랩·Esc·복귀), Checkbox(라벨 토글·aria-describedby·disabled+사유), Alert/BalanceCard(role·aria-live·색 단독 전달 없음). focus-visible 전역 퍼플 2px+offset 위임.

## 플래그 4건 검증
- (a) 전역 Toast 대신 인라인 Alert — **타당**(role/aria-live 정확·429 카운트다운·버튼 잠금·카피 충족, 과설계 회피). spec §3.1 "토스트" 명명 이탈은 무결점 기록.
- (b) NotFoundPage bg-primary — **유효** → M1/FC-017.
- (c) themeStore no-op — **유효** → M2/FC-018.
- (d) OAuth 미포함 — **정당**(spec §3.1/§3.2 요소 목록에 없음, 태스크 범위 밖 명시. 자리확보는 별도 디자인-게이트 티켓).

## 후속 티켓
- **FC-017**(todo): NotFoundPage 퍼플 CTA→ink 교체(M1).
- **FC-018**(todo): ThemeToggle U-005 전까지 숨김/disabled 또는 기본 'light'(M2).
