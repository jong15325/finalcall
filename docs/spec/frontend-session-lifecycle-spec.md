# FinalCall 프론트 세션 생명주기 — 원자적 전환 계약 (frontend-session-lifecycle-spec.md)

상태: v1 — architect 산출(FC-174). 계정 전환 시 세션·캐시 오염(신원 desync·쪽지 노출) 버그의 **수정 스펙**.
소유: architect(설계). frontend-impl(FC-174) 팬아웃 근거다. 코드·계약 정본·보드는 이 문서가 수정하지 않는다.
근거: FC-056(세션 스토어·전송로)·frontend-account-spec.md(로그인 2단계 하이드레이션 §2 판정). api-contract **무변경**. 백엔드 **무변경**(신원은 서버가 토큰 주체로 확정, 클라는 senderId 미전송).
범위: 로그아웃·로그인·계정전환·refresh 실패·탈퇴 시 (토큰 + user 요약 + react-query 캐시)의 원자적 리셋. **제외**: 백엔드/계약 변경, 쿼리 키 사용자-스코프화(대안으로 검토·기각, §4.2).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1 | 2026-08-03 | 근본원인 A/B 확정(코드 근거), 원자적 세션 전환 계약, 전역키 전수 감사, 회귀 테스트 스펙, FC-174 분해 |

---

## 0. 핵심 결론 요약 (총괄용)

1. **근본원인 A(캐시 미초기화) = 확정.** `clearSession`(authStore.ts:118)은 zustand 상태만 비우고 **모듈 싱글턴 `queryClient`(queryClient.ts:51) 캐시를 건드리지 않는다.** 모든 쿼리 키가 **사용자 무관 전역 키**(`['memos']`·`['balance']`·`['me']`·`['orders']`·`['inventory']`·`['temp-storage']`·`shopKeys.mines`)라, 로그아웃해도 demo1의 받은함·미열람 뱃지가 gcTime(5분) 동안 캐시에 살아남아 demo2 화면에 그대로 렌더된다. `enabled: isAuthed`는 **새 fetch를 막을 뿐 기존 캐시를 축출하지 않는다.** → 증상 1(쪽지 노출) 완전 설명. "전체 리로드 후 정상"과 정합(리로드가 싱글턴 캐시를 새로 만듦).
2. **근본원인 B(토큰 desync) = 구조 확정.** 클라는 senderId를 **보내지 않는다**(memos.ts:20-26,90-92 — 서버가 토큰 주체로 고정). 따라서 `sender_id=demo1`은 **송신 시점 store.accessToken이 demo1의 토큰(T1)이었다**는 결정적 물증이다. 원인은 **세션 전환이 원자적·직렬화되지 않았고, 토큰 쓰기에 세션 세대 가드가 없다**는 것 — (i) 로그인이 `updateTokens`(부분 갱신)만 하고 이전 user·캐시를 원자적으로 갈아끼우지 않음(AuthProvider.tsx:44), (ii) refresh single-flight(client.ts:142-177)가 **세션이 바뀌었는지 확인 없이** rotate된 토큰을 store에 되쓴다(`applyRotatedTokens`→`updateTokens`) → 이전 계정에서 시작된 refresh가 계정 전환 뒤 착지하며 T2를 T1'으로 덮어써 store가 이전 계정 토큰을 품는다. 타이밍 의존이라 재현이 불안정하고 리로드로 사라지는 관측과 정합.
3. **수정 원칙: 밴드에이드 금지.** 메모 쿼리만 무효화하지 않는다. **세션 전환 1곳(오케스트레이션 계층)에서 (store + queryClient) 전역 원자 리셋** + **refresh 세션 세대 가드**로 근본 해결한다.
4. **아키텍처 판정: authStore는 QueryClient를 몰라야 한다.** 순수 상태 스토어에 서버-캐시 라이브러리를 결합하면 store→queryClient 의존과 순환 위험이 생긴다. 캐시 purge는 **핸들러/AuthProvider(React) + session 브릿지(모듈)** 계층이 오케스트레이션한다(§3).
5. **분해: 단일 frontend-impl 티켓으로 닫힌다**(§5). 계약·백엔드 무변경 → **게이트2 아님.**

---

## 1. 근본원인 확정 (코드 근거)

### 1.1 A — react-query 캐시 미초기화 (확정)

- **전역 키(사용자 무관)** — 축출 대상이 사용자별로 분리돼 있지 않다:
  - `memoKeys.all = ['memos']` (memos.ts:35) → received/sent/unread/detail
  - `balanceKeys.all = ['balance']` (balance.ts:13), `meKeys.all = ['me']` (me.ts:21)
  - `orderKeys.all = ['orders']` (orders.ts:14), `inventoryKeys.all = ['inventory']` (inventory.ts:14)
  - `tempStorageKeys.all = ['temp-storage']` (tempStorage.ts:22), `shopKeys.mines()`=`['shops','mine']` (shop.ts:51)
- **정리 누락 지점**:
  - `clearSession`(authStore.ts:118) = `set({ ...emptySession })` — **zustand 상태만**.
  - `signOut`(AuthProvider.tsx:82-91) = `apiLogout` → `clearSession()` — **queryClient 미접근**.
  - `queryClient`(queryClient.ts:51)는 **모듈 싱글턴**이고 App이 이를 그대로 Provider에 주입(App.tsx:17) → 로그아웃/로그인으로 재생성되지 않는다. `gcTime: 5*60_000`(5분) 동안 demo1 캐시 잔존.
- **결과**: demo2 로그인 직후 `useUnreadMemoCount`·`useReceivedMemos`는 `enabled:isAuthed`로 다시 활성화되나, react-query는 **stale 캐시를 즉시 렌더한 뒤** 백그라운드 refetch한다(staleTime 30s). 그 창에서 demo1의 목록·뱃지가 demo2에게 노출된다. → **증상 1 완전 설명.**

### 1.2 B — 토큰·user 원자성 결여 + refresh 세대 가드 부재 (확정)

- **전제(반박 불가)**: `sendMemo`는 `{ receiverNickname, body }`만 보낸다(memos.ts:21-26). 발신자·type은 **서버가 토큰 주체로 고정**(memos.ts:8-10, 계약 §2.6). `apiClient`는 매 요청 `getAccessToken()`으로 store 토큰을 **라이브로** 읽어 `Authorization: Bearer`에 싣는다(client.ts:110-113). ⟹ `sender_id=demo1`은 **송신 순간 store.accessToken == T1(demo1)** 이라는 유일한 결론.
- **defect (i) 로그인 비원자**: `establishSession`(AuthProvider.tsx:42-60)은 `updateTokens(tokens)`(부분 갱신 — accessToken/refreshToken/expiresAt만, **user 유지**) 후 async `getMe()` → `setUser`. `setSession`(원자 전면 교체)을 쓰지 않고 **캐시도 비우지 않는다.** 전환 중 "새 토큰 + 옛 user + 옛 캐시" 공존 창이 생긴다.
- **defect (ii) refresh 세대 가드 부재(핵심)**: refresh single-flight(client.ts:142-177)의 `performRefresh`가 시작 시 refreshToken을 캡처하고, 완료 시 `applyRotatedTokens`(session.ts:20-22)→`updateTokens`로 **현재 세션이 캡처 당시와 같은지 확인 없이** store에 되쓴다. 이전 계정(demo1)에서 만료 access→401로 촉발된 refresh가 **계정 전환 이후 착지**하면 demo2의 T2를 demo1의 회전토큰 T1'으로 덮어쓴다. 이후 send는 T1'→`sender_id=demo1`. 모듈 싱글턴 `refreshPromise`도 세션 리셋 시 무효화되지 않는다.
- **타이밍 의존성**: (ii)는 refresh 착지 시점이 전환 전/후냐에 따라 달라 재현이 불안정하고, 전체 리로드(싱글턴·store 재초기화)로 사라진다 — 관측과 정합. **가드가 없는 한 잠재적 IDOR급 신원 오귀속**이므로 구조적으로 닫아야 한다.

> 판정: A는 증상 1의 충분 원인, B는 증상 2(신원 뒤바뀜)의 원인. 둘 다 "세션 전환이 원자적·전역적이지 않다"는 한 뿌리의 두 발현이다. 수정은 **전환 원자화(A) + refresh 세대 가드(B)** 를 함께 해야 완결된다.

---

## 2. 영향 surface 전수 감사 (전역키 쿼리)

세션 전환 시 잔존하면 **다른 계정에 노출/오염**되는 쿼리(전부 전역 키). 메모만이 아니다:

| 키 | 파일 | 성격 | 전환 시 위험 |
|---|---|---|---|
| `['memos']` (received/sent/unread/detail) | memos.ts:35 | **사용자 전용** | 이전 계정 쪽지·미열람 뱃지 노출(관측된 증상) |
| `['balance','me']` | balance.ts:13 | **사용자 전용** | 이전 계정 잔액 노출 |
| `['me','profile']` | me.ts:21 | **사용자 전용** | 이전 계정 프로필(닉네임·이메일마스킹·createdAt) 노출 |
| `['orders',...]` | orders.ts:14 | **사용자 전용** | 이전 계정 거래내역 노출 |
| `['inventory','me']` | inventory.ts:14 | **사용자 전용** | 이전 계정 인벤토리 노출 |
| `['temp-storage','me']` | tempStorage.ts:22 | **사용자 전용** | 이전 계정 임시보관 노출 |
| `['shops','mine',...]` | shop.ts:51 | **사용자 전용** | 이전 계정 판매목록 노출 |
| `['items','detail',id]` | items.ts:13 | 사용자 귀속(소유 인스턴스) | 이전 계정 아이템 상세 잔존 |
| `['shops','browse'/'detail']` | shop.ts:44,47 | 공개 | 정확성 무해(재조회) |
| `['auctions','preview'/'browse'/'detail']` | auctions.ts:47 | 공개 | 정확성 무해 |
| `['itemTemplates',...]` | itemTemplates.ts:17 | 공개(불변 시드) | 정확성 무해 |

**결론**: 사용자 전용 키가 8계열이다. "메모만 무효화"는 나머지 7계열을 방치하는 밴드에이드다. → **전환 시 `queryClient.clear()`(전량 축출)** 1곳으로 해결한다. 공개 캐시까지 지워지지만 정확성 무해하고 단순 재조회일 뿐이며, **사용자 전용 키를 하나도 빠뜨리지 않는 유일하게 안전한 방식**이다(§4.2에서 대안 비교).

---

## 3. 원자적 세션 전환 계약

### 3.1 불변식 (invariant)

1. **한 번에 하나의 신원.** store의 (accessToken, refreshToken, user)와 react-query 캐시는 **항상 같은 계정에 속한다.** 두 계정의 상태가 공존하는 창을 두지 않는다.
2. **모든 전환 진입점은 1개의 오케스트레이션을 통과한다.** 로그인·로그아웃·탈퇴·refresh실패 어느 경로든 (store 리셋 + queryClient 축출)을 **원자 페어**로 실행한다.
3. **stale 토큰은 착지해도 쓰지 않는다.** 세션이 바뀐 뒤 도착한 refresh 결과는 **폐기**한다(세대 가드).
4. **authStore는 QueryClient를 모른다.** 캐시 오케스트레이션은 store 바깥(핸들러/브릿지)에 산다.

### 3.2 계층 배치 (아키텍처 판정)

- **authStore** = 순수 세션 상태(토큰+user 요약). QueryClient import 금지(순환·결합 방지). 세대 가드용 카운터는 여기 둘 수 있으나(순수 값), 캐시 접근은 하지 않는다.
- **session 브릿지(lib/api/session.ts)** = api층↔store 브릿지. 여기에 **`resetSession()` 오케스트레이터**를 둔다: `useAuthStore.getState().clearSession()` + **모듈 싱글턴 `queryClient.clear()`** + refresh in-flight 무효화. 모듈 스코프라 **비-React 경로(client.ts refresh 실패)도** 이 1곳을 부른다.
  - 주의: 앱은 `lib/queryClient.ts`의 **싱글턴**을 Provider에 주입(App.tsx:4,17)하므로 브릿지가 그 싱글턴을 직접 clear하면 프로덕션 컨텍스트 클라이언트와 동일 인스턴스다. (테스트는 renderWithProviders가 별도 클라이언트를 쓰므로 §4.3 주의.)
- **AuthProvider(React 핸들러)** = 로그인/로그아웃 사용자 액션의 오케스트레이션. 로그인 성공·로그아웃 시 `resetSession()` 계약을 따른다(아래 3.3).

### 3.3 전환별 규약

- **로그아웃(`signOut`, AuthProvider.tsx:82)**: `apiLogout(refreshToken)`(서버 refresh 폐기, 실패해도) → `finally`에서 **`resetSession()`**(store clear + `queryClient.clear()` + refresh 무효화). 현행은 `clearSession()`만 → **`resetSession()`으로 교체.**
- **로그인(`establishSession`, AuthProvider.tsx:42)**: 순서를 원자화한다.
  1. **`resetSession()`** — 진입 즉시 이전 계정 캐시·상태 전량 축출(계정 전환 대비. 로그아웃 없이 재로그인해도 안전).
  2. 새 토큰 심기(`updateTokens` 또는 토큰만의 부분 세션). 이 시점 store = {새 토큰, user=null}.
  3. `getMe()`(새 토큰으로) → 성공 시 `setUser(me)`. 실패 시 **`resetSession()`**(반쪽 세션 금지).
  - 효과: "새 토큰 + 옛 user/옛 캐시" 공존 창 제거. user는 **새 토큰의 /me로만** 하이드레이트.
- **탈퇴(`MePage.handleWithdraw`, MePage.tsx:38)**: `onSuccess`에서 현행 `clearSession()`을 **`resetSession()`으로 교체**(잔액·인벤토리 등 사용자 캐시까지 축출) 후 홈 이동.
- **refresh 실패(`performRefresh`, client.ts:147,165)**: 현행 `clearSession()`(session.ts:25 브릿지)을 **`resetSession()`으로 승격** — refresh 실패는 세션 소멸이므로 캐시도 함께 비운다.

### 3.4 refresh 세대 가드 (defect ii 차단)

`performRefresh`(client.ts:144)가 **stale 착지**로 새 세션을 오염시키지 못하게 한다. 택1(구현 재량, 둘 다 계약 충족):

- **(권장) refreshToken 라인리지 대조**: `performRefresh` 시작 시 사용한 `refreshToken`을 지역 캡처. `applyRotatedTokens` **직전에** `getRefreshToken()`이 **여전히 캡처값과 동일한지** 확인. 다르면(= 그 사이 세션이 clear/전환됨) **rotate 결과를 폐기하고 조용히 abort**(store에 쓰지 않음). 동일할 때만 `applyRotatedTokens`.
- **(대안) 세션 세대 카운터**: authStore에 `generation:number`. `setSession/clearSession/resetSession`이 `generation++`. `performRefresh`가 시작 세대를 캡처, 적용 직전 현재 세대와 비교. 불일치면 폐기.

추가: **`resetSession()`은 모듈 `refreshPromise`를 무효화**한다(진행 중 single-flight가 다음 요청에 재사용되지 않도록 — 기존 `__resetRefreshStateForTest`의 프로덕션 판을 세션 리셋에 배선). in-flight fetch 자체는 abort하지 않아도 위 가드가 착지 쓰기를 막는다.

---

## 4. 설계 판정 · 대안 비교

### 4.1 왜 `queryClient.clear()`(전량)인가

세션 전환은 드물고(로그인/아웃/전환), clear는 O(캐시). 공개 캐시 재조회 비용은 무시 가능. **사용자 전용 키를 코드가 열거·유지할 필요를 없애** "새 키 추가 시 purge 목록에 빠뜨리는" 재발(=이 버그의 씨앗)을 원천 차단. 밴드에이드(선택 무효화)의 반대편.

### 4.2 기각: 쿼리 키 사용자-스코프화

각 전용 키에 `userPublicId` 접두(`['memos', uid, ...]`)를 붙이면 계정별 캐시가 분리돼 clear 없이도 격리된다. **기각 이유**: (1) 11개 파일·8계열 전면 침습 + 낙관적 업데이트(`markMemoReadOptimistic` 등)·무효화 반경 전부 수정 → 넓고 위험. (2) **하나라도 빠뜨리면 정확히 이 버그** → 안전이 규율에 의존(키 구조로 보장 안 됨). (3) 신원 desync(B)는 키 스코프로 **안 풀린다**(토큰 자체가 틀림). → clear + 세대 가드가 더 작고 확실하다. (스코프화는 훗날 다계정 동시 세션이 필요해지면 재검토.)

### 4.3 테스트 클라이언트 주의 (frontend-impl 유의)

프로덕션은 `lib/queryClient.ts` 싱글턴을 씀 → 브릿지의 모듈 clear가 곧 컨텍스트 클라이언트. **테스트(renderWithProviders)는 매번 새 클라이언트**를 만든다(renderWithProviders.tsx:37). 따라서 세션 전환 컴포넌트 테스트에서 캐시 축출을 검증하려면 **브릿지가 clear할 인스턴스와 테스트가 주입한 인스턴스가 동일해야** 한다. 택1: (a) 세션 전환 핸들러(AuthProvider)가 **`useQueryClient()`(컨텍스트 클라이언트)로 clear**하고, 비-React refresh실패 경로만 브릿지 싱글턴 clear를 쓴다(권장 — 테스트가 컨텍스트 클라이언트로 단언 가능). (b) 테스트가 싱글턴을 주입. → **(a) 권장**: AuthProvider는 `useQueryClient()`로 clear, session.ts 브릿지의 `resetSession()`은 refresh실패 등 모듈 경로용으로 싱글턴 clear. 두 경로가 같은 헬퍼 시맨틱(store clear + cache clear + refresh 무효화)을 공유하되 clear 대상 클라이언트만 주입원이 다르다.

---

## 5. FC-174 분해 · 파일 쓰기 집합

**판정: 단일 frontend-impl 티켓.** 하나의 응집된 생명주기 관심사이고, 파일들이 상호 의존(원자 전환은 쪼개면 중간에 반쪽 상태가 남음)이라 병렬 팬아웃 이득이 없다. 하위 분할은 오히려 원자성을 깬다.

**쓰기 파일 집합**(frontend-impl):
- `frontend/src/lib/api/session.ts` — `resetSession()` 오케스트레이터 신설(store clear + cache clear + refresh 무효화). 기존 `clearSession` 브릿지는 유지/승계.
- `frontend/src/lib/api/client.ts` — refresh 세대 가드(§3.4): `applyRotatedTokens` 직전 라인리지/세대 대조로 stale 착지 폐기. 세션 리셋 시 `refreshPromise` 무효화 배선.
- `frontend/src/auth/AuthProvider.tsx` — `establishSession` 원자화(진입 시 purge → 토큰 → getMe → setUser, 실패 시 purge), `signOut`이 `resetSession` 계약 사용. `useQueryClient()` 도입(§4.3-a).
- `frontend/src/store/authStore.ts` — (세대 카운터 택 시) `generation` 필드 + 전이 액션에서 증가. **QueryClient import 금지.**
- `frontend/src/pages/MePage.tsx` — 탈퇴 `onSuccess`가 `resetSession` 사용.
- 테스트: `frontend/src/auth/AuthProvider.test.tsx`(신규 또는 확장) · `frontend/src/lib/api/client.test.ts`(refresh 가드) — §6.

**백엔드/계약**: 무변경(확인). api-contract.md 손대지 않는다.

---

## 6. 회귀 테스트 스펙

### 6.1 단위 (vitest)

- **T1 store 원자성**: `clearSession` 후 (accessToken, refreshToken, user) 전부 null. `setSession(demo2)` 후 이전 user 잔재 없음.
- **T2 refresh 세대 가드(핵심 B)**: `performRefresh`를 refreshToken=A로 시작 → 착지 전 `resetSession()`(또는 세션 전환) → mock refresh 응답이 와도 **store에 쓰이지 않음**(accessToken은 리셋/새 세션 값 유지, A의 회전토큰으로 덮이지 않음). `client.__resetRefreshStateForTest`로 in-flight 격리.
- **T3 refreshPromise 무효화**: `resetSession()` 후 다음 401이 **새 refresh**를 시작(이전 프로미스 재사용 안 함).

### 6.2 통합 (renderWithProviders, mock fetch)

- **T4 로그아웃 캐시 축출(A)**: demo1 세션 + `queryClient.setQueryData(memoKeys.received(), demo1데이터)` + unread 캐시 프라임 → `signOut` → **memoKeys.received()·unread·balance·me·orders·inventory 캐시가 undefined**(전량 축출 확인).
- **T5 계정 전환 격리(A+B)**: demo1 상태·캐시 프라임 → `signIn(demo2)`(mock `/auth/login`→T2, mock `/me`→demo2) → (a) store.user=demo2·accessToken=T2, (b) demo1 메모 캐시 부재, (c) 이후 `sendMemo` mock fetch의 **`Authorization` 헤더 == `Bearer T2`**(신원 정확성의 FE 대리검증).
- **T6 미열람 뱃지 초기화**: 전환 후 `useUnreadMemoCount`가 demo1의 캐시 카운트를 **렌더하지 않고** demo2로 refetch(캐시 축출 → enabled 재조회).

### 6.3 라이브 인수(수동, DoD 물증)

FE 단위로는 DB `sender_id`를 직접 볼 수 없다. **인수 절차**: demo1 로그인→로그아웃→demo2 로그인→demo2에서 임의 수신자에 쪽지 발신→`SELECT sender_id FROM finalcall.user_memo ORDER BY id DESC LIMIT 1` == **demo2**. 동시에 demo2 받은함에 demo1 쪽지·미열람 뱃지가 **없음**을 UI로 확인(리로드 없이). T5(c)의 `Authorization` 단언이 이 물증의 자동화 대리다.

---

## 7. 게이트·후속

- **게이트2 아님**: 스키마·API계약·성능·되돌리기 큰 결정 없음(프론트 내부 동작 계약, 되돌리기 용이). frontend-impl 직접 진행 가능.
- **reviewer 확인소**: 계정 전환 신원 격리(IDOR급) 최종 판정 — T5(c) `Authorization` 정확성 + 캐시 축출 완전성(8계열 전부) 확인.
- **후속(범위 밖)**: 다계정 동시 세션이 요구되면 §4.2 키 스코프화 재검토. 현 스펙은 단일 활성 세션 전제.
