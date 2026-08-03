# FC-174 통합 리뷰 — 계정 전환 신원 격리(IDOR급)

- **대상**: FC-174 세션 생명주기 원자화(계정 전환 시 세션·캐시 오염 수정)
- **리뷰어**: reviewer(읽기 전용)
- **일자**: 2026-08-03
- **판정**: **PASS** (critical/major 0, minor 2) → `review_status: passed`

## 초점별 근거 (요약)
1. **신원 격리(refresh 세대 가드)** — PASS. `client.ts::performRefresh`가 시작 시 `startedRefreshToken` 캡처, `applyRotatedTokens` 직전 `getRefreshToken() !== startedRefreshToken`이면 stale rotate **폐기**. 실패 catch도 대칭 가드(`=== startedRefreshToken`일 때만 `resetSession()`) → stale 실패가 새 세션을 죽이지 않음. `refreshEpoch`+`invalidateRefresh()`로 single-flight 부기·in-flight 무효화 정확. 성공/실패 양 경로 가드 확인.
2. **캐시 축출 완전성** — PASS. `queryClient.clear()`(전량 축출, 8계열 밴드에이드 아님)가 4경로(로그아웃·로그인진입·탈퇴·refresh실패) 전부 통과. React 경로=`useQueryClient()` 컨텍스트, 비-React=모듈 싱글턴 이원 배선 정확(§4.3-a). 프로덕션은 App.tsx가 싱글턴을 Provider에 주입 → 동일 인스턴스.
3. **원자성** — PASS. `establishSession` = resetSession(동기) → updateTokens(동기) → await getMe → setUser. "새 토큰+옛 user/옛 캐시" 공존 창 없음. getMe 실패 시 resetSession 롤백(반쪽 세션 금지).
4. **런타임 순환 import** — PASS. client↔session 상호참조가 함수 본문 지연 참조(ES live binding) → 부팅·전체 스위트 안전.
5. **회귀 테스트 실질성** — PASS(직접 실행 24/24). T2=stale rotate 폐기 불변식 실검증(가드 제거 시 실패 구조), T5c=전환 후 `sendMemo` Authorization==새 토큰(발신 신원 FE 대리검증). T1·T3·T4·T6 실검증.
6. **컨벤션·과설계** — PASS. 전 변경이 spec §3~§4·DoD에 추적. dangling import 없음. epoch+lineage 이중 가드는 관심사 분리(과설계 아님).

## minor (비차단, 후속 재량)
- **M1**: `MePage.tsx` 탈퇴가 React 컴포넌트임에도 컨텍스트 `useQueryClient()` 대신 모듈 싱글턴 `resetSession()` 사용 — 프로덕션은 동일 인스턴스라 기능 정상이나 §4.3-a 원칙과 미세 불일치, 탈퇴 캐시 축출 단위 테스트 부재(수동 인수 의존).
- **M2(이론)**: 라인리지 가드가 refreshToken 값 동일성 의존 — 서버 1회성 회전+로그인 새 토큰 발급으로 현실 오탐 불가. 세대 카운터 대안이 이론적으로 더 견고하나 강제 아님.

## 검증 실행
- `npx vitest run src/lib/api/client.test.ts src/auth/AuthProvider.test.tsx` → 24/24 pass.
- 전체 스위트 664 pass, 3 fail=`oauth.test.ts`(env `client_id` 의존, FC-174 무관 확인).

## 변경 파일
`frontend/src/lib/api/client.ts`·`session.ts`, `frontend/src/auth/AuthProvider.tsx`, `frontend/src/pages/MePage.tsx`, `frontend/src/lib/api/client.test.ts`, `frontend/src/auth/AuthProvider.test.tsx`.

## 라이브 인수(수동, §6.3)
demo1 → 로그아웃 → demo2 로그인 → 발신 → `user_memo.sender_id == demo2` + demo2 받은함에 demo1 쪽지·뱃지 없음(리로드 없이).
