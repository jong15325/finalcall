# 도시에: 프론트 내 계정 (EPIC-FE-MEMBER — auth·마이페이지·잔액 표시)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·spec·계약·보드·리뷰·디자인 결정로그에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·
> 리뷰)로 뒷받침한다 — 과장·미구현을 구현으로 쓰지 않는다.

- **영역/에픽**: EPIC-FE-MEMBER (프론트 내 계정 — 로그인·회원가입·로그아웃 + 마이페이지 프로필/닉네임/탈퇴 + 잔액 표시)
- **상태**: 완료 · 게이트3 승인(Done)
- **기간(커밋 기준)**: `306d333`(FC-012 architect 계약·spec 확정) ~ `e9744dd`(토큰 U-021 교체) ~ `88cdca8`(내 계정 실구현) ~ `909fa44`(게이트3 Done)
- **관련 티켓**: FC-012(architect)·FC-013·FC-014·FC-015(frontend-impl 단일 1패스)·FC-016(reviewer, passed) · 파생 FC-017·FC-018(리뷰 minor 분리)
- **Jira 미러**: EPIC-FE-MEMBER=KAN-14 · FC-012~016=KAN-15~19

> **범위 명확화**: 이 도시에는 프론트엔드 "내 계정" 표면(auth·마이페이지·잔액 **표시**)만 완료로 다룬다.
> 충전(EPIC-CHARGE)·교환 UI·타인 프로필·비밀번호 변경·소셜 로그인은 범위 밖(별도 에픽). 잔액은 백엔드
> §4.4 `GET /me/balance`를 **표시**만 하며 증감·교환 로직은 화폐 도메인(백엔드)의 몫이다.

## 1. 개요 (한 문단)

프론트 스켈레톤에는 로그인·마이페이지가 **stub(임시 세션 버튼·placeholder)**로만 존재했다. 이 에픽은
그 껍데기를 백엔드 확정 계약(§2 auth·§2.5 member·§4.4 balance)에 맞춘 **실구현**으로 대체한다 — 실제
로그인·회원가입·로그아웃, 마이페이지의 프로필 조회·닉네임 수정·탈퇴, 그리고 캐시/게임머니/홀드/가용
잔액 표시다. 표면은 평범한 CRUD 화면 4종이지만, 이 에픽의 실제 가치는 세 겹에 있다: (1) **contract-first
오케스트레이션**을 프론트에서 처음 완주하며 팬아웃 교차를 분석해 병렬 대신 단일 1패스를 택한 판단,
(2) 계약에 없는 login-user 요약을 `GET /me` **하이드레이션**으로 메운 정합 설계, (3) 남색 게임스킨을
**라이트 커머스 디자인 시스템(U-021)**으로 실코드 토큰까지 교체한 전환. 여기에 이 에픽에서 드러난
**Jira 미러 누락 사건을 규율로 전환**한 프로세스 성숙까지가 케이스 스터디의 서사다.

## 2. 해결한 기술 도전과 해법

- **계약에 없는 로그인 사용자 요약 → `GET /me` 하이드레이션(계약 변경 없이 정합)**: 계약 §2 login 응답은
  `{ accessToken, refreshToken, accessExpiresAt }`뿐 — **헤더 닉네임·admin 가드가 요구하는 user 요약이
  없다.** login 응답 확장은 게이트2 대상이고 §2.5가 명시적 출처이므로, 로그인은 토큰 수신 직후
  `GET /me`로 user를 하이드레이션한 뒤 `setSession`한다. 이때 `getMe(accessToken)`에 **토큰을 명시
  인자로 넘겨 Authorization을 직접 실어** 스토어에 의존하지 않는다 → 중간 인증 상태·가드 플리커 없이
  로그인 원자성을 지킨다(`useAuth.ts::useLogin`, `memberApi.ts::getMe`). 이 하이드레이션이 `getMe`를
  auth·member 두 티켓이 공유하는 근원이 됐다.

- **탈퇴 주체 401 열거 방지(COMMON_005)를 신규 분기 없이 흡수**: soft delete된 계정이 만료 전 access로
  `/me`를 호출하면 401 `COMMON_005`(미인증·만료와 동일 코드·포맷)를 받는다. 프론트는 이를 잡아
  "탈퇴된 계정" 같은 **특정 카피를 절대 띄우지 않는다**(회원 열거 노출) — 기존 `client.ts` 401 경로(refresh
  회전 시도 → 탈퇴 주체는 세션이 전량 폐기돼 회전 실패 → `clearSession`)가 그대로 삼켜 미인증과 동일하게
  로그인으로 유도한다. `errorCodes.ts`에 상수 1줄만 추가하고 신규 처리 코드는 두지 않았다(SEC-007).

- **모노레포 계약 사본 폐기(D-030 → D-098)**: 프론트 README가 별도 저장소 시절 규약(D-030, 계약 사본을
  두고 해시 기입)을 참조했으나, 사본은 실제로 존재하지 않고 경로·버전(v1.4)도 어긋나 참조가 공중에 뜬
  상태였다. 모노레포(D-098)에선 정본이 프론트 코드와 **같은 커밋으로 원자적으로 버저닝**되므로 사본은
  drift 위험만 더한다 → **사본 폐기·단일 정본 직접 참조**로 정정(FC-012 §2, README 3건 수정).

- **팬아웃 교차 분석 → 병렬 대신 단일 1패스**: FC-013/014/015는 형식상 병렬 후보였으나, 쓰기 파일
  집합이 쌍마다 교차했다 — `getMe`(013 하이드레이션 ∩ 014 프로필), `ProfilePage.tsx`(014 생성 ∩ 015
  잔액 카드 삽입), `authStore.updateUser`(신설). "같은 도메인"이 아니라 **"같은 파일"로 팬아웃을 세는**
  규칙에 따라 병렬 부적합으로 판정하고, 세 화면이 하나의 "내 계정" 표면이며 규모가 작아 **단일
  frontend-impl 1패스**가 커밋 원자성·정합에 유리하다고 택했다(FC-012 §6, 보드는 3티켓 추적 유지).

- **닉네임 수정 시 헤더 동기화**: `PATCH /me` 성공 시 쿼리 캐시 갱신에 더해 `authStore.updateUser({ nickname })`로
  헤더 표시명을 즉시 반영한다 — 백엔드가 반환한 동일 스키마를 신뢰하고 낙관적 조작을 만들지 않았다
  (`useMember.ts::useUpdateNickname`).

## 3. 핵심 결정과 근거 (트레이드오프)

- **디자인 방향 전환 U-020 남색 게임스킨 → U-021 라이트 커머스**: 게임 아이템 정보창의 남색(#001C33)
  단일 다크 스킨을 커머스 전체 팔레트로 채택한 U-016/U-020을 **사용자가 오류로 정정**했다 — 실제 돈에
  준하는 캐시·게임머니를 다루는 UI는 "게임"이 아니라 "믿을 수 있는 거래처"로 읽혀야 한다. 무신사(미니멀
  에디토리얼)+마켓컬리(화이트+딥퍼플) 참조로 전환하되 참조 모방이 아닌 고유값(#6E2A9F)을 세웠다.
  frontend-impl이 `tailwind.config.js`·`index.css`의 구 남색값을 **실코드 토큰까지 U-021로 교체**
  (커밋 `e9744dd`). (근거: `docs/ux/decision-log.md` U-021 ACCEPTED, U-016/U-020 SUPERSEDED)

- **CTA=블랙, 퍼플=액센트로 격리**: 주 CTA는 블랙(`ink` #18181B, 흰 글자 대비 17.72:1)이고 브랜드
  퍼플(#6E2A9F)은 **링크·포커스·선택 상태 등 액센트에만** 쓴다(CTA 채움 아님). 전 토큰을 라이트
  베이스(#FFFFFF) sRGB 상대휘도로 계산해 WCAG AA를 전건 검증했다. 이 규칙 덕에 토큰 교체 후 남은
  퍼플 채움 CTA(404 화면)를 리뷰가 규칙 위반으로 잡아낼 수 있었다(→ FC-017). (근거: U-021 조작 계층 개정)

- **게임색 격리(Game-Color Containment)**: element 4색 아트 hex는 불변으로 두되, 라이트 배경에서 대비가
  무너지므로(4색 전건 AA 미달) **소프트 틴트 배경 + near-black 라벨 + solid 도트로 전경만 반전**하고,
  배치는 **아이템 카드·속성 배지·아이템 필터 칩에만** 한정한다. 게임 감성을 자금 거래 신뢰감과 물리적으로
  분리한 이원 구조다. (계정 화면은 element 무영향 — 아이템 에픽에서 Q4 배지강도만 이연)

- **탈퇴 잔액 소멸 명시 동의(D-080)와 파괴적 조작의 의도적 마찰**: `DELETE /me`는 `balanceForfeitAcknowledged:
  true`를 필수로 요구하고, 미체크 시 버튼을 disabled + **비활성 사유를 병기**한다(사유 없는 비활성 금지).
  탈퇴는 되돌릴 수 없으므로 Modal(포커스 트랩·Esc)로 의도적 마찰을 만들고, 잔액 0이어도 동의 필드를
  요구해 클라 분기를 제거했다. 성공 204 시 `clearSession` + `queryClient.clear()`로 다음 사용자 오염을
  차단한다. (근거: frontend-account-spec §3.3-C, D-080)

- **토큰 = 메모리 세션(persist 미도입)**: `authStore`에 persist를 붙이지 않아 새로고침 시 재로그인이
  정상이다 — localStorage/cookie 토큰 저장의 XSS 노출면을 애초에 두지 않는 보안 선택. persist 완화는
  wallet 도메인 착수 전 별도 보안 검토로 미룬다(트레이드오프: UX 편의 대신 노출면 최소화).

- **디자인 게이트 1회로 3화면 승인, 잔액 카드는 게이트 불요**: 새 화면 3종(로그인·가입·마이페이지)의
  방향을 디자인 게이트 1회로 함께 승인받고, 잔액 표시는 신규 지갑 화면이 아니라 마이페이지 내 표시
  요소이므로 게이트 없이 자동 진행으로 판정했다(FC-012 §4.5·§6.3).

## 4. 아키텍처

```
features/                         상태·API 계층                        재사용 스켈레톤 자산
  auth/                             stores/authStore.ts                  lib/api/client.ts
   · authApi(login/signup/logout)    · setSession/clearSession            · envelope 언랩
   · useAuth(useLogin: login→getMe    · updateUser(닉네임 동기화·신설)     · 401 refresh 회전(single-flight)
     하이드레이션→setSession)          · persist 없음(메모리 세션)          · {auth:false}·delete(body)
  member/                          types/errorCodes.ts                  lib/returnUrl.ts
   · memberApi(getMe/update/delete)   · COMMON_005 추가(1줄)               · sanitizeReturnUrl(open-redirect 차단)
   · useMember(useMe/Nickname/Withdraw) 레이아웃 4종                       lib/queryClient.ts
   · NicknameDialog·WithdrawDialog    · AuthFormLayout(인증 시 홈)         · 4xx no-retry·429 Retry-After
  wallet/                            · ProtectedLayout(미인증 리다이렉트)  components/ui, feedback
   · walletApi(getBalance §4.4)       · AdminLayout(isAdmin 가드)          · Field·Button·Modal·Checkbox
   · BalanceCard(4필드 MoneyAmount)                                       · MoneyAmount·Alert·Loading/Error

pages: LoginPage · SignupPage · ProfilePage(프로필+잔액카드+탈퇴 3블록)
디자인 토큰: tailwind.config.js·index.css = U-021 라이트 커머스(CTA=ink #18181B·퍼플 액센트 #6E2A9F·베이스 #FFFFFF)
로그인 흐름: POST /auth/login → getMe(명시 토큰) → setSession → sanitizeReturnUrl 복귀
401 흐름: client.ts refresh 회전 → 실패 시 clearSession(COMMON_005 = 미인증 동일 취급, 특정 카피 없음)
```

## 5. 증거

- **엔드포인트/화면**: 계약 §2 `POST /auth/{login,signup,logout}`(AUTH_001/002/003) · §2.5 `GET/PATCH/DELETE /me`
  (MEMBER_001/002, COMMON_005) · §4.4 `GET /me/balance`(cash·gameMoney·held·available). 에러코드→UI 매핑은
  frontend-account-spec §3.4와 1:1.
- **설계 문서(architect)**: `docs/spec/frontend-account-spec.md` — 계약 정합 판정(D-030→D-098)·화면 4종 spec·
  상태 매트릭스·API 함수층·하이드레이션 설계·팬아웃 교차 분석(§6). contract-first의 핵심 산출.
- **핵심 파일**:
  - `frontend/src/features/auth/api/useAuth.ts` — useLogin(login→getMe 하이드레이션→setSession)·useLogout(qc.clear)
  - `frontend/src/features/member/api/memberApi.ts` — getMe(명시 토큰 인자·스토어 비의존)·updateNickname·deleteMe
  - `frontend/src/features/member/api/useMember.ts` — useUpdateNickname(updateUser 헤더 동기화)·useWithdraw
  - `frontend/src/features/member/components/WithdrawDialog.tsx`·`NicknameDialog.tsx` — 탈퇴 동의·닉네임 수정
  - `frontend/src/features/wallet/components/BalanceCard.tsx` + `components/ui/MoneyAmount.tsx` — 잔액 4필드 표시
  - `frontend/src/pages/{LoginPage,SignupPage,ProfilePage}.tsx` — stub 제거→실 화면(마이페이지 3블록)
  - `frontend/src/stores/authStore.ts` — setSession/clearSession/updateUser, persist 없음(메모리 세션)
  - `frontend/src/types/errorCodes.ts` — COMMON_005 추가
  - `frontend/tailwind.config.js`·`frontend/src/index.css` — U-020 남색→U-021 라이트 커머스 토큰 교체
- **디자인 근거**: `docs/ux/decision-log.md` U-021(ACCEPTED, CTA=ink 17.72:1·퍼플 액센트·게임색 격리·AA 전건 검증) ·
  U-016/U-020(SUPERSEDED) · 정본 `docs/ux/design-system.md` · 전략/브랜드 `PRODUCT.md`·`DESIGN.md`.
- **리뷰**: `docs/board/reviews/FC-016-review.md` — review_status **passed**(critical 0 · major 0 · minor 5).
  typecheck·lint·build(tsc+vite, 125 modules) 전건 그린. 확인 정합: 메모리 세션·returnUrl open-redirect 차단·
  COMMON_005 열거방지·탈퇴 동의·stub 완전 제거·토큰 교체 정합·접근성(Field/Modal 포커스 트랩/Checkbox/색 단독
  전달 금지). minor 2건은 무관 파일 임의 편집 대신 **플래그**로 분리(coding-discipline 준수) → FC-017(NotFoundPage
  퍼플 CTA→ink)·FC-018(ThemeToggle no-op).
- **커밋**:
  - `306d333` chore(board): FC-012 done — 프론트 내 계정 계약·spec 확정 (architect)
  - `e9744dd` refactor(design): 프론트 토큰 U-020 남색→U-021 라이트 커머스 교체
  - `88cdca8` feat(fe): 내 계정 실구현 — 로그인·마이페이지·잔액 (FC-013/014/015)
  - `41a6598` chore(board): EPIC-FE-MEMBER 리뷰 passed·Jira 미러·HANDOVER 하드닝
  - `98a35bb` docs: PRODUCT.md 추가 (impeccable init — 전략·브랜드 정본)
  - `909fa44` chore(board): EPIC-FE-MEMBER done 전이 (게이트3 승인)

## 6. 프로세스에서 배운 것 (Jira 미러 누락 → 규율 전환)

이 에픽은 **실패를 규율로 바꾼 사례**도 남겼다. EPIC-FE-MEMBER(FC-012~016)가 사용자 대시보드인 Jira에
**아예 미러되지 않은 사건**이 드러났다("이력관리는 중요하다"는 사용자 검토 지시, 2026-07-17). 근본원인은
4겹이었다: ① 에픽 생성 당시(이전 세션) 미러 누락, ② 인수 세션이 CLAUDE.md §12의 "비차단"을 "선택적"으로
**오독**해 의도적 연기, ③ push와 달리 미러엔 훅·드리프트 검사 같은 **가드레일 부재**(`state != todo`인데
`jira_key: null`이 유일한 드리프트 신호인데 아무도 안 봄), ④ HANDOVER "이어받는 법"에 **미러 패리티
확인 단서 부재**로 인수 시 백필 계기 없음.

해소는 두 방향이었다: (a) **백필** — EPIC-FE-MEMBER=KAN-14·FC-012~016=KAN-15~19를 상태·Epic Link·
Blocks 링크·라벨까지 소급 반영하고 `jira_key`를 보드에 기록(불변), (b) **HANDOVER 하드닝** — "이어받는 법"에
"`state`가 todo 아닌데 `jira_key: null`인 티켓을 스캔해 백필한다"는 **미러 패리티 확인 단계를 신설**하고,
"비차단"의 의미를 "미러 호출 실패해도 파일 작업을 멈추지 말라는 실패 허용이지 생략이 아니다"로 못박았다.
가시성 도구의 조용한 드리프트를 프로세스 단계로 봉쇄한 것이다. (근거: `docs/board/HANDOVER.md` line 10·34,
커밋 `41a6598`, 메모리 `jira-mirror-discipline`)
