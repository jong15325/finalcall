# FinalCall 프론트 내 계정 — 계약 정합 · 화면 spec · API 함수층 설계 (frontend-account-spec.md)

상태: v1 — architect 산출(FC-012). EPIC-FE-MEMBER(프론트 auth 실구현 + 마이페이지 + 잔액 표시) contract-first 설계.
소유: architect(설계). 이 문서는 frontend-impl(FC-013/014/015) 팬아웃 근거다. 코드·계약 정본·보드는 이 문서가 수정하지 않는다.
근거: api-contract **v1.5**(§2 auth · §2.5 member · §4.4 balance), erd v0.8(user·user_balance), design-system v0.2.2(토큰·컴포넌트), screen-spec v0.4(IA·§3.1 auth·§3.1-b member). 프론트 스켈레톤 재사용: `lib/api/client.ts`(401 refresh 회전 single-flight)·`stores/authStore.ts`·레이아웃 4종·`components/feedback/*`.
범위(게이트1 승인, 안 A): auth 실구현 + 마이페이지(프로필 조회/닉네임 수정/탈퇴) + 잔액 표시. **제외**: 충전·교환 UI, 타인 프로필, 비밀번호 변경(별도 안건).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1 | 2026-07-17 | 초안 — 계약 정합(D-030) 판정, 화면 4종 spec + 상태 매트릭스 + 에러코드→UI, features 구조·함수 시그니처·query/mutation 규약, 잔액 표시 위치 판정, stub 제거 계획, 디자인 게이트 입력, 팬아웃 교차 분석 |

---

## 0. 핵심 결정 요약 (총괄용)

1. **계약 정합(D-030)**: 모노레포(D-098)이므로 **사본 폐기 → 단일 정본 직접 참조** 권고. 프론트 README가 참조하는 경로·버전·"사본을 둔다" 규약 3건이 모두 어긋났다(경로 `docs/api-contract.md`→실제 `docs/spec/api-contract.md`, 버전 v1.4→v1.5, 존재하지 않는 사본을 전제). [2절]
2. **로그인 세션 하이드레이션(계약 정합 발견)**: 계약 §2 login 응답은 `{ accessToken, refreshToken, accessExpiresAt }`뿐 — **user 요약(nickname·isAdmin)이 없다.** 그런데 `authStore.setSession`은 `user: UserSummary`를 요구하고 레이아웃(헤더 닉네임·admin 가드)이 이를 읽는다. → **로그인은 반드시 `GET /me`(§2.5)로 user를 하이드레이션한 뒤 setSession** 해야 한다. 계약 변경은 불요(§2.5가 정본 출처). 이로 인해 `getMe`가 auth와 member 두 티켓에 공유된다. [4.4, 6절]
3. **COMMON_005(탈퇴 주체 401) 처리**: 신규 분기 불요. 기존 `client.ts` 401 경로(refresh 회전 시도 → 실패 → `clearSession`)가 그대로 삼킨다(탈퇴 시 refresh 세션 전량 폐기이므로 회전은 반드시 실패). UI는 **"탈퇴된 계정" 같은 특정 카피 금지** — 미인증과 동일하게 로그인 리다이렉트(SEC-007 열거 방지). [3.3, 5절]
4. **잔액 표시 위치 판정**: 마이페이지의 요약은 유지하고 `/me/wallet`에는 승인된 모바일 월렛형 상세를 운영 적용한다. 둘은 같은 `GET /me/balance` 쿼리를 재사용한다. 헤더 상시 표시는 매 페이지 폴링 유발이라 보류한다. [4.5]
5. **팬아웃**: FC-013/014/015는 **쓰기 파일 집합이 쌍마다 교차**한다(getMe·authStore.updateUser·ProfilePage). **병렬 부적합 → 순차(013→014→015) 또는 단일 frontend-impl 세션 권고.** [6절]

---

## 1. 계약 v1.4 → v1.5 델타 (내 계정 관련)

정본은 v1.5. 내 계정 범위에 실제 영향을 주는 변화는 **§2.5 탈퇴 주체 401 `COMMON_005`** 하나다.

- **§2.5 GET·PATCH·DELETE `/me` 공통 주(v1.5, 게이트2)**: 토큰은 유효하나 주체가 soft delete된 계정이 만료 전 access로 호출하면 **401 `COMMON_005`(세션 무효)**. 미인증·만료 토큰 401과 **동일 코드·포맷**이라 탈퇴 여부가 응답으로 드러나지 않는다(회원 열거 방지 SEC-007).
- `errorCodes.ts`에 `COMMON_004`만 있고 **`COMMON_005`가 없다** → frontend-impl이 상수 1줄 추가 필요(아래 2.3).
- 그 외 §2·§2.5·§4.4 엔드포인트·스키마·에러코드는 v1.4와 동일(v1.5는 COMMON_005 명세만 추가).

---

## 2. 계약 정합 판정 (D-030)

### 2.1 판정: 사본 폐기 · 단일 정본 직접 참조 (권고)

**모노레포(D-098)에서 계약 사본은 안티패턴이다. `docs/spec/api-contract.md`(v1.5)를 프론트가 직접 참조하고 사본을 두지 않는다.**

근거:
- D-030 사본 규약은 **프론트가 별도 저장소였을 때** 교차-레포 스냅샷을 위한 것이었다. D-098로 단일 워킹트리가 되면서 그 존재 이유(레포 격리)가 사라졌다.
- 사본은 **이중 관리 → drift**를 낳는다. drift 회피가 바로 D-030이 막으려던 위험인데, 모노레포에선 정본이 프론트 코드와 **같은 커밋으로 원자적으로** 버저닝되므로 사본이 위험만 추가한다.
- 실제로 사본은 **존재하지 않는다**(`frontend/` 아래 계약 사본 없음). 즉 README가 "사본을 둔다"고 적었으나 이행되지 않았고, 참조가 공중에 뜬 상태다.

### 2.2 프론트 README 정정 지시 (실행: frontend-impl/총괄 — 나는 지시만)

`frontend/README.md` "## 계약" 절을 아래 취지로 교체:
- 경로: `docs/api-contract.md` → **`docs/spec/api-contract.md`**(레포 루트 기준).
- 버전: **v1.4 → v1.5**.
- "백엔드 저장소의 … 복사본을 두고 헤더에 원본 경로·버전·해시 기입(D-030)" 문장 **삭제** → "모노레포 단일 정본을 직접 참조한다(D-098). 사본을 두지 않는다"로 대체.
- 부수: README "## 구조" 예시의 `features/`가 비어 있음 표기 → 본 에픽으로 `auth·member·wallet` 채워짐(FC-013/014/015 완료 시 갱신).

> 주: `types/*.ts`·`design-system.md`·`screen-spec.md`의 계약 참조 버전(각 v1.4 잔존 소지)은 **본 에픽 범위 밖**이다. 필요 시 별도 정합 티켓으로 총괄 판단(본 spec은 프론트 README만 지시).

### 2.3 `errorCodes.ts` COMMON_005 추가 지시

`frontend/src/types/errorCodes.ts` `ERROR_CODES`에 아래 1줄 추가(공통 블록):
```ts
COMMON_005: 'COMMON_005', // 세션 무효(탈퇴 주체 등, [2.5]) (401)
```
소비 티켓: FC-014(마이페이지). frontend-impl이 추가한다.

---

## 3. 화면 spec

공통(전 화면, screen-spec 말미): 로딩(스켈레톤 `LoadingState`)·빈 상태(`EmptyState`)·에러(`ErrorState`, 계약 §5 코드 1:1) 3종. 시간은 서버 Instant(UTC) 수신 → 표시 시점 로컬 변환. 폼은 `design-system §5.2 Field`(라벨 가시·placeholder 라벨 대용 금지·error는 `aria-describedby`), 버튼은 `§5.1 Button`(primary/outline/ghost/danger, focus-ring 2px+offset).

### 3.1 로그인 (`/login`, AuthFormLayout) — FC-013

요소: 제목 · loginId(text) · password(password) · 로그인 버튼(primary lg) · "회원가입" 링크(`link` 토큰=상시 underline) · returnUrl 표시(디버그 아님, 사용자 노출 불요 — 스켈레톤의 returnUrl 박스는 제거).

플로우:
1. 제출 → `POST /auth/login { loginId, password }` → `{ accessToken, refreshToken, accessExpiresAt }`.
2. 토큰 임시 보관 없이 **곧바로 `GET /me`**(하이드레이션, 4.4 참조) → `{ userPublicId, nickname, isAdmin, createdAt }`.
3. `setSession({ ...tokens, user: { userPublicId, nickname, isAdmin } })`.
4. `navigate(sanitizeReturnUrl(returnUrl) ?? '/', { replace: true })`. returnUrl은 `lib/returnUrl.ts` 재사용(P-011).
- **AuthFormLayout이 이미 인증 시 홈으로 되돌린다** — 별도 처리 불요.

상태 매트릭스:

| 상태 | 트리거 | UI |
|---|---|---|
| 로딩 | 제출 in-flight | 버튼 `aria-busy` + 중복 제출 차단(disabled), 라벨 "로그인 중" |
| 에러(자격) | AUTH_003(401) | 폼 상단 인라인 에러 "아이디 또는 비밀번호가 올바르지 않습니다"(어느 쪽인지 특정 금지 — 열거 완화 SEC-007) |
| 에러(검증) | 400 `errors[]` | 필드별 에러(`field`→해당 인풋, `aria-describedby`) |
| 에러(429) | GATEWAY_429 | `warning` 토스트 + `Retry-After` 카운트다운, 버튼 잠금(design-system §5.6). 클라 로직은 `client.ts`/`errors.ts` 재사용 |
| 성공 | 200 + GET /me | returnUrl 또는 홈 이동 |

### 3.2 회원가입 (`/signup`, AuthFormLayout) — FC-013

요소: loginId · password · **password 확인**(클라 일치 검증 전용·서버 미전송, P-009) · nickname · 가입 버튼(primary lg) · "로그인" 링크.

플로우(P-010): `POST /auth/signup { loginId, password, nickname }` → 201 `{ userPublicId, nickname }` → **성공 안내 → `/login` 이동(loginId prefill 권장)**. **자동 로그인 없음**(signup 응답에 토큰 없음 + login 재호출 버스트가 GATEWAY_429 위험).

상태 매트릭스:

| 상태 | 트리거 | UI |
|---|---|---|
| 로딩 | 제출 in-flight | 버튼 aria-busy·disabled |
| 검증(클라) | password≠확인 | 확인 필드 인라인 에러(서버 400 아님) |
| 에러(중복 loginId) | AUTH_001(409) | loginId 필드 에러 "이미 사용 중인 아이디입니다"(SEC-007: 구체 사유 최소화하되 loginId 중복은 가입 진행상 불가피) |
| 에러(중복 nickname) | AUTH_002(409) | nickname 필드 에러 "이미 사용 중인 닉네임입니다"(표시용이라 유지 — 계약 §2 SEC-007 주) |
| 에러(검증) | 400 `errors[]` | 필드별 매핑 |
| 에러(429) | GATEWAY_429 | 3.1과 동일 |
| 성공 | 201 | 성공 안내 → /login |

### 3.3 마이페이지 (`/me/profile`, ProtectedLayout) — FC-014 (+ FC-015 잔액 카드)

ProtectedLayout이 미인증 시 `login?returnUrl` 리다이렉트를 이미 처리한다. 화면은 3블록: **프로필 · 잔액 카드 · 탈퇴**.

**A. 프로필 블록** — `GET /me` → `userPublicId`·`nickname`·`isAdmin`·`createdAt` 표시. 닉네임은 인라인 수정.
- 닉네임 수정: 편집 모드 → nickname 인풋 → 저장 → `PATCH /me { nickname }` → 200(동일 스키마) → 쿼리 갱신 + **`authStore.updateUser({ nickname })`**(헤더 닉네임 동기화, 4.4 참조).

**B. 잔액 카드(FC-015)** — `GET /me/balance` → 4필드 `MoneyAmount`(design-system §5.10)로 표시: `cashBalance`(캐시)·`gameMoneyBalance`(게임머니)·`gameMoneyHeld`(홀드)·`gameMoneyAvailable`(가용). held/available 라벨 명확 구분. 천단위 구분·`font-num`. **표시만**(충전·교환 버튼 없음 — 별도 에픽).

**C. 탈퇴 블록** — 탈퇴 버튼(danger) → 확인 단계(Modal §5.5 권장) → 아래 D-080 4요소:
1. **잔존 잔액 표시** — B의 `GET /me/balance` 값 재사용(같은 쿼리, 재요청 불요).
2. **소멸·복구 불가 경고** — "탈퇴 시 잔여 캐시·게임머니는 소멸하며 복구·환불되지 않습니다."(danger 톤)
3. **명시 동의 체크박스**(design-system §5.2 Checkbox) — 미체크 시 탈퇴 버튼 `disabled` + **비활성 사유 문장 병기**(사유 없는 비활성 금지). 체크가 `balanceForfeitAcknowledged: true`로 전송. 잔액 0이어도 필수.
4. 실행: `DELETE /me { balanceForfeitAcknowledged: true }` → 204 → **`clearSession()` + `queryClient.clear()` → `/` 이동**.

상태 매트릭스:

| 블록 | 상태 | 트리거 | UI |
|---|---|---|---|
| 프로필 | 로딩 | GET /me in-flight | `LoadingState` |
| 프로필 | 에러 | 401(미인증/COMMON_005) | 3.3 하단 "세션 무효 처리" 참조 |
| 닉네임 | 에러(중복) | MEMBER_001(409) | nickname 필드 에러 "이미 사용 중인 닉네임입니다" |
| 닉네임 | 에러(검증) | 400 `errors[]` | 필드 매핑 |
| 닉네임 | 성공 | 200 | 표시 갱신 + 헤더 동기화 + 성공 토스트(success) |
| 잔액 | 로딩 | GET /me/balance in-flight | 카드 스켈레톤 |
| 잔액 | 에러 | 4xx/네트워크 | `ErrorState` + 재시도(카드 국소) |
| 탈퇴 | 차단 | MEMBER_002(409) | "진행 중인 거래(경매·입찰·주문)가 있어 탈퇴할 수 없습니다. 정리 후 다시 시도하세요." + 관련 화면 경로 안내(사용자 잘못 아님·다음 행동 카피) |
| 탈퇴 | 성공 | 204 | clearSession → 홈 |

**세션 무효 처리(COMMON_005 = 미인증 동일 취급)**:
- `/me` 계열 401(미인증·만료·COMMON_005 무구분)은 **`client.ts`가 이미 처리**: refresh 회전 시도 → 탈퇴 주체는 refresh 세션이 폐기돼 회전 실패 → `clearSession()` → `AUTH_004` throw. clearSession 후 ProtectedLayout 재렌더가 `login`으로 리다이렉트.
- **frontend-impl 금지 사항**: `COMMON_005`를 잡아 "탈퇴된 계정입니다" 등 **특정 카피를 띄우지 않는다**(열거 노출). 미인증과 동일한 로그인 유도만.

### 3.4 에러코드 → UI 매핑 (종합)

| 코드 | HTTP | 화면 | UI 처리 |
|---|---|---|---|
| AUTH_001 | 409 | 회원가입 | loginId 필드 에러 |
| AUTH_002 | 409 | 회원가입 | nickname 필드 에러 |
| AUTH_003 | 401 | 로그인 | 폼 상단 통합 에러(계정/비번 특정 금지) |
| AUTH_004 | 401 | 전역 | `client.ts` refresh 실패 경로 — clearSession→재로그인(신규 처리 불요) |
| MEMBER_001 | 409 | 마이페이지 | nickname 필드 에러 |
| MEMBER_002 | 409 | 마이페이지 탈퇴 | 차단 안내 + 다음 행동 카피 |
| COMMON_005 | 401 | 마이페이지 | **미인증과 동일**(특정 카피 금지, 로그인 리다이렉트) |
| 검증 400 `errors[]` | 400 | 로그인/가입/닉네임 | `field`→인풋 매핑, `aria-describedby` |
| GATEWAY_429 | 429 | 로그인/가입 | warning 토스트 + Retry-After 카운트다운(재사용) |

---

## 4. API 함수층 설계

### 4.1 features 구조

```
frontend/src/features/
├── auth/
│   ├── api/
│   │   ├── authApi.ts        # login, signup, logout (계약 §2)
│   │   └── useAuth.ts        # useLogin, useSignup, useLogout (mutation)
│   ├── components/           # LoginForm, SignupForm (선택 — 페이지 내 인라인도 허용)
│   └── types.ts              # LoginRequest/Response, SignupRequest/Response 등
├── member/
│   ├── api/
│   │   ├── memberApi.ts      # getMe, updateNickname, deleteMe (계약 §2.5)
│   │   └── useMember.ts      # useMe(query), useUpdateNickname, useWithdraw (mutation)
│   ├── components/           # ProfileSection, WithdrawDialog
│   └── types.ts              # MeResponse, UpdateNicknameRequest, WithdrawRequest
└── wallet/
    ├── api/
    │   ├── walletApi.ts      # getBalance (계약 §4.4) — 향후 charges/exchanges 확장
    │   └── useWallet.ts      # useBalance (query)
    └── types.ts              # BalanceResponse
```

- **타입은 per-feature `types.ts`에 둔다**(중앙 `types/api.ts` 미편집 → 팬아웃 교차 회피). `types/api.ts`(envelope)·`types/errorCodes.ts`(COMMON_005만 추가)·`authStore.ts`의 `UserSummary`/`SessionTokens`는 **재사용**한다.
- **`member` feature 신설**: screen-spec §1의 9-feature 목록(auth·auction·…·admin)은 §2.5(v1.4 회원 리소스) 이전 작성분이라 member가 없다. §3.1-b가 이미 "member(마이페이지)"를 명명했으므로 member를 10번째 feature로 추가한다(계약 §2.5 소유). 경미한 IA 확장 — 총괄 인지용 기록.

### 4.2 함수 시그니처 (계약 스키마 1:1 — 임의 필드 금지)

`apiClient`(`lib/api/client.ts`) 위에 구축. envelope 언랩·401 회전·에러 정규화는 client가 담당하므로 함수는 얇다.

```ts
// features/auth/api/authApi.ts  (계약 §2)
login(body: { loginId: string; password: string }):
  Promise<{ accessToken: string; refreshToken: string; accessExpiresAt: string }>
  = apiClient.post('/auth/login', body, { auth: false })      // 미인증 호출

signup(body: { loginId: string; password: string; nickname: string }):
  Promise<{ userPublicId: string; nickname: string }>
  = apiClient.post('/auth/signup', body, { auth: false })

logout(): Promise<void>
  = apiClient.post('/auth/logout')                            // 인증 필요, 204

// features/member/api/memberApi.ts  (계약 §2.5)
getMe(): Promise<{ userPublicId: string; nickname: string; isAdmin: boolean; createdAt: string }>
  = apiClient.get('/me')

updateNickname(body: { nickname: string }): Promise<MeResponse>  // 조회와 동일 스키마
  = apiClient.patch('/me', body)

deleteMe(body: { balanceForfeitAcknowledged: true }): Promise<void>  // 204
  = apiClient.delete('/me', body)

// features/wallet/api/walletApi.ts  (계약 §4.4)
getBalance(): Promise<{ cashBalance: number; gameMoneyBalance: number;
                        gameMoneyHeld: number; gameMoneyAvailable: number }>
  = apiClient.get('/me/balance')
```

- **login·signup은 `{ auth: false }`** — `AUTH_PATHS`에 이미 포함돼 401 회전 대상이 아니다(무한 루프 방지). client가 처리하므로 함수는 옵션만 넘긴다.
- `apiClient.delete`는 body를 받는다(client 시그니처 확인 완료) — `DELETE /me` 동의 body 전송 가능.

### 4.3 TanStack Query 키 · 뮤테이션 규약

키는 `lib/api/queryKeys.ts::queryKey(domain, resource, params?)` 헬퍼로 **각 feature에서 국소 생성**(중앙 레지스트리 파일 안 만듦 → 교차 회피):

| 훅 | 종류 | 키 | 엔드포인트 |
|---|---|---|---|
| `useMe` | query | `queryKey('member', 'me')` | GET /me |
| `useBalance` | query | `queryKey('wallet', 'balance')` | GET /me/balance |
| `useLogin` | mutation | — | POST /auth/login (+GET /me 하이드레이션) |
| `useSignup` | mutation | — | POST /auth/signup |
| `useLogout` | mutation | — | POST /auth/logout |
| `useUpdateNickname` | mutation | — | PATCH /me |
| `useWithdraw` | mutation | — | DELETE /me |

뮤테이션 onSuccess 규약:
- `useLogin`: 하이드레이션(4.4) 후 `setSession`. `queryClient.setQueryData(member.me, meResponse)`로 GET /me 재요청 절약(선택). 이후 `member.me`·`wallet.balance`는 마이페이지 진입 시 fetch.
- `useUpdateNickname`: `setQueryData(member.me, updated)` **또는** `invalidateQueries(member.me)` + **`authStore.getState().updateUser({ nickname })`**(헤더 동기화).
- `useLogout`·`useWithdraw`: `authStore.clearSession()` + **`queryClient.clear()`**(캐시된 me/balance 전량 폐기 — 다음 사용자 오염 방지).
- 뮤테이션 전역 retry는 `queryClient`에서 이미 `false`. GET는 4xx no-retry·429만 Retry-After 백오프(기존 설정 재사용).
- 잔액 staleTime: 기본 30s로 충분(표시만·폴링 불요). 마이페이지 마운트 시 refetch면 족하다.

### 4.4 로그인 세션 하이드레이션 (계약 정합 — 필수 설계)

**계약 §2 login 응답에 user 요약이 없다.** `authStore.setSession`은 `user`를 요구하고 레이아웃이 이를 읽는다(헤더 nickname·AdminLayout `isAdmin` 가드). 따라서:

```
login(body) → { accessToken, refreshToken, accessExpiresAt }
  → (토큰을 Authorization에 실어) getMe() → { userPublicId, nickname, isAdmin, createdAt }
  → setSession({ accessToken, accessExpiresAt, refreshToken,
                 user: { userPublicId, nickname, isAdmin } })
```

- 순서 주의: `getMe`는 `Authorization` 헤더가 필요한데 `client.ts::getAccessToken()`은 authStore에서 읽는다. 로그인 직후 아직 setSession 전이면 토큰이 스토어에 없다. **두 방법 중 택1(frontend-impl 재량, 권고 = 후자)**:
  1. 토큰만 먼저 `updateTokens`로 넣고 → getMe → user까지 `setSession`. (중간 상태 존재)
  2. `getMe`를 **명시 토큰 인자**로 1회 호출할 수 있게 하거나, `apiClient.get('/me', { headers: { Authorization: 'Bearer '+accessToken } })`로 스토어 비의존 호출. → **권고**: 하이드레이션 전용으로 헤더 명시 호출(중간 인증 상태를 만들지 않아 가드 플리커 없음).
- **`getMe`는 auth(로그인 하이드레이션)와 member(프로필 조회) 양쪽이 쓴다** → `features/member/api/memberApi.ts`에 두고 auth가 import. 이 공유가 FC-013↔FC-014 교차의 근원(6절).
- 계약 변경 제안 안 함. login 응답 확장은 게이트2 대상이고, §2.5가 명시적 출처이므로 하이드레이션이 정당한 설계다.

### 4.5 잔액 표시 위치 판정

**판정(2026-08-14 승인으로 종전 placeholder 판정 대체): 마이페이지 요약 + `/me/wallet` 모바일 월렛형 상세.**

- 운영 상세는 DEV workbench `/__design/wallet-balance-studies`에서 승인된 모바일 월렛형을 이관한다. 총 보유·사용
  가능·입찰 보류는 `code`, 캐시 잔액은 `cash`로 표시하며 `frontend-ui-system-contract.md` [2.4.1]을 따른다.
- 마이페이지 요약·탈퇴 확인·지갑 상세는 같은 `GET /me/balance` 쿼리를 공유한다. 화면 이관은 API 호출 수,
  API wire contract, DB 스키마를 변경하지 않는다. 헤더 상시 잔액은 종전대로 보류한다.
- 디자인 게이트는 해당 workbench에서 완료됐다. 운영 이관 시 390px·1280px, 200% 텍스트 확대, 긴 안전정수
  overflow와 production residue를 검증한다.

### 4.6 stub 세션 제거 계획 (FC-013)

- `pages/LoginPage.tsx`: `handleStubSignIn`·"임시 세션(사용자)"·"임시 세션(관리자)" 버튼 2개·returnUrl 디버그 박스·점선 안내 블록 **전량 삭제** → 실 로그인 폼(3.1)으로 대체.
- `pages/SignupPage.tsx`: placeholder 문구 → 실 가입 폼(3.2)으로 대체.
- `authStore.ts` API(`setSession`/`updateTokens`/`clearSession`)는 유지·재사용. 스토어에 **`updateUser` 액션 신설**(닉네임 수정 반영용, 4.3) — FC-014 소관.
- `AppRoutes.tsx`: `ROUTES.profile`의 `<PagePlaceholder title="마이페이지" />` → `<ProfilePage />`로 교체(FC-014). login/signup은 이미 실 컴포넌트로 라우팅돼 있어 **AppRoutes 편집 불요**(페이지 내부만 교체).

---

## 5. 디자인 게이트 입력 (초안 — 확정 아님, 총괄이 사용자에 제시)

새 화면 3종(로그인·회원가입·마이페이지). design-system v0.2.2가 확정 토큰·컴포넌트를 제공하므로 **디자인은 재발명이 아니라 조립**이다.

방향 초안(3~5줄):
1. **로그인/회원가입**: `AuthFormLayout`(중앙 정렬 `max-w-sm` 카드, 기존) 그대로. `Field`(라벨 가시)·`Button primary lg`·인라인 에러·`link` 토큰(상시 underline) 조립. 회원가입은 password 확인 필드 포함(클라 검증). 모바일 1열.
2. **마이페이지**: `ProtectedLayout`(헤더+네비 기존) 안에 세로 3섹션 — 프로필 카드(닉네임 인라인 수정) · 잔액 카드(`MoneyAmount` 4필드, held/available 구분) · 탈퇴 영역(danger). `surface` 카드 + `border`로 구획(다크 단일 스킨, 그림자 대신 표면/테두리).
3. **탈퇴 확인**: `Modal`(§5.5, 포커스 트랩·Esc) 안에 D-080 4요소 — 잔존 잔액 + 소멸 경고(danger) + 동의 `Checkbox`(§5.2, 미체크 시 버튼 disabled+사유 병기) + MEMBER_002 차단 안내.
4. **재사용 컴포넌트**: AuthFormLayout·Field·Button·Checkbox·Modal·MoneyAmount·Toast(429/성공)·feedback 3종. 신규 창작 최소.
5. **선택지(사용자 조정 여지)**: 탈퇴 확인을 (a) Modal vs (b) 별도 확인 섹션 인라인. 권고 = Modal(파괴적·되돌리기 불가라 의도적 마찰). 닉네임 수정을 (a) 인라인 편집 vs (b) 별도 다이얼로그. 권고 = 인라인.

---

## 6. 팬아웃 쓰기 파일 교차 분석 (FC-013/014/015)

병렬 조건 = **의존 없음 + 쓰기 파일 집합 무교차**(둘 다). 아래대로 **쌍마다 교차가 있어 병렬 부적합**이다.

### 6.1 티켓별 쓰기 파일 (예상)

| 파일 | FC-013 auth | FC-014 member | FC-015 balance |
|---|---|---|---|
| `pages/LoginPage.tsx` | ✍️ 재작성 | | |
| `pages/SignupPage.tsx` | ✍️ 재작성 | | |
| `features/auth/**` | ✍️ 신규 | | |
| `features/member/api/memberApi.ts`(getMe) | ✍️ **공유**(하이드레이션) | ✍️ **공유**(프로필) | |
| `features/member/**`(그 외) | | ✍️ 신규 | |
| `pages/ProfilePage.tsx` (신규) | | ✍️ 생성 | ✍️ **잔액 카드 삽입** |
| `features/wallet/**`(balance) | | (import) | ✍️ 신규 |
| `stores/authStore.ts`(updateUser 추가) | (하이드레이션은 setSession만) | ✍️ **updateUser 신설** | |
| `routes/AppRoutes.tsx`(profile 라우트) | | ✍️ 1줄 교체 | |
| `types/errorCodes.ts`(COMMON_005) | | ✍️ 1줄 추가 | |

### 6.2 교차 지점

- **FC-013 ∩ FC-014**: `features/member/api/memberApi.ts`의 `getMe`. 로그인 하이드레이션(013)과 프로필 조회(014)가 같은 함수를 쓴다. 두 티켓이 같은 파일에 쓴다.
- **FC-014 ∩ FC-015**: `ProfilePage.tsx`(잔액 카드가 마이페이지에 삽입됨). FC-015 display가 FC-014 화면 파일에 들어간다.
- **FC-013 ∩ FC-015**: 직접 교차 없음(타입·키를 per-feature로 분리해 `types/api.ts`·`queryKeys.ts` 중앙 편집 회피). 단 FC-015가 FC-014의 ProfilePage에 의존하므로 **FC-014 선행이 사실상 강제**.

### 6.3 권고

- **병렬 불가. 순차 권고: FC-013 → FC-014 → FC-015.**
  - 013 먼저: auth 폼 + `memberApi.getMe` 최초 생성 + (원한다면 authStore `updateUser`도 013에서 함께 마련해 014 부담 감소).
  - 014: getMe 재사용, ProfilePage 생성, authStore.updateUser 사용, AppRoutes·errorCodes 편집.
  - 015: 완성된 ProfilePage에 잔액 카드 삽입 + `features/wallet` 추가.
- **대안(권고 동급): 단일 frontend-impl 세션으로 3티켓 일괄.** 세 화면이 하나의 "내 계정" 표면이고 규모가 작으며(폼 2 + 마이페이지 1 + 카드 1), 공유 파일(getMe·authStore·ProfilePage)이 많아 **한 세션이 커밋 원자성·정합 면에서 더 깔끔**하다. 티켓 3개는 보드 상 추적 단위로 유지하되 실행은 1패스.
- 게이트: FC-013·FC-014는 `gate: design`(새 화면) — **디자인 게이트 1회로 3화면 방향을 함께 승인**받는 것을 권고(5절 초안 제시). FC-015는 디자인 게이트 불요(4.5).

---

## 부록: 재사용 확인된 스켈레톤 자산 (frontend-impl 참조)

- `lib/api/client.ts`: envelope 언랩·**401 refresh 회전 single-flight**·Retry-After·`{auth:false}`·`delete(body)` 지원. auth 함수는 이 위에 얇게.
- `lib/api/errors.ts`: `ApiError`(code·status·fieldErrors·retryAfterMs)·`isApiError`·`hasErrorCode`·`isRateLimited`. 에러 분기는 `code`(ERROR_CODES) 기준.
- `stores/authStore.ts`: `setSession`/`updateTokens`/`clearSession` + `UserSummary`/`SessionTokens` 타입. **`updateUser` 신설 필요**(닉네임).
- `lib/returnUrl.ts::sanitizeReturnUrl`: 로그인 후 복귀(P-011).
- 레이아웃: `AuthFormLayout`(인증 시 홈 되돌림)·`ProtectedLayout`(미인증 리다이렉트)·`AdminLayout`(isAdmin 가드) — 가드 내장, 재사용.
- `components/feedback/*`: `LoadingState`·`EmptyState`·`ErrorState`(code·message·onRetry).
- `lib/queryClient.ts`: 4xx no-retry·429 Retry-After 백오프 기본값.
