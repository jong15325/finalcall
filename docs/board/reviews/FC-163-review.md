---
ticket: FC-163
epic: EPIC-NICKNAME-UX
reviewer: reviewer
date: 2026-07-30
verdict: PASS
blocking: []
resolved: [MAJOR-1]
scope: [FC-161(backend), FC-162(frontend)]
contract: docs/spec/api-contract.md §2 v1.17
---

# FC-163 통합 리뷰 — EPIC-NICKNAME-UX (닉네임 가용성 조회 + 소셜 항상-꼬리표)

## 판정: PASS (재검증 2026-07-30 · critical/major 0)
1차: CHANGES-REQUESTED — MAJOR-1(게이트웨이 rate limit 미배선). FC-161 재작업(게이트웨이 `auth-rate-limited` predicate에 `/api/v1/auth/nickname/availability` 추가)으로 **해소**. 재검증 결과 라우트 순서·필터·계약 §2 v1.17 정합 확인 → **PASS**. 그 외 정합성/QA·소셜 닉네임·프론트 UX·접근성은 1차부터 PASS.
**관찰(스코프 밖)**: `/api/v1/auth/oauth/**`도 동일 게이트웨이 rate-limit 라우트에서 누락(FC-156 선존 gap) — 별건 후속.

---

## CRITICAL
없음.

## MAJOR

### MAJOR-1 — 가용성 엔드포인트가 게이트웨이 auth rate limit에 포함되지 않음 (계약↔인프라 드리프트, 열거 완화 미작동)
- 위치: `backend/gateway/src/main/resources/application.yml` L22~38 (`auth-rate-limited` 라우트) vs 신설 경로 `/api/v1/auth/nickname/availability`.
- 사실관계:
  - `auth-rate-limited` predicate = `Path=/api/v1/auth/login,/api/v1/auth/signup,/api/v1/auth/refresh` — **정확 경로 3개만** 토큰버킷(replenish 5/s, burst 10) 적용.
  - 신설 경로는 이 목록에 없어 catch-all `service-proxy`(`Path=/api/v1/**`, **rate limiter 없음**)로 흘러 **무제한**이 된다.
  - 그런데 계약 §2(v1.17)는 "열거 방지(SEC-007): … 시도 제한은 게이트웨이 rate limit(D-068, auth 계열 동일)"로 **완화 제어가 걸려 있다고 단언**한다. 실제로는 걸려 있지 않다 → 계약과 배선의 모순.
- 공격 시나리오: 비로그인 공격자가 단일 GET(`?nickname=`)으로 닉네임 존재 여부 boolean 오라클을 얻는다. signup(AUTH_002)도 같은 존재를 노출하지만 signup은 (ⓐ auth 버킷으로 5/s 제한 + ⓑ 유효 loginId/password 페이로드 필요)이라 대량 수확 비용이 크다. 가용성 GET은 **스로틀 없이** 초당 수천 건 열거가 가능해 signup 대비 열거면이 실질적으로 확대된다. 참고: domain-spec은 닉네임을 목록·상세에서 **마스킹** 노출한다고 기술 — "완전 공개값" 전제보다 민감도가 약간 높다.
- 기대 vs 실제: 기대 = 계약대로 auth 계열과 동일 rate limit 흡수. 실제 = 무제한.
- 요구 조치(택1, 코드 미수정·판정만): (a) 게이트웨이 `auth-rate-limited` predicate에 `/api/v1/auth/nickname/availability` 추가(1줄), 또는 (b) 리스크 수용 시 계약 §2의 "게이트웨이 rate limit 적용" 문언을 실제와 일치하도록 정정하고 게이트2로 상신. 어느 쪽이든 **계약과 배선을 일치**시켜야 한다.
- 관측(스코프 밖·비판정): 동일 라우트에 `/api/v1/auth/oauth/**`(FC-156)도 빠져 있어 같은 미배선 상태다 — 선존 이슈로 FC-163 판정 대상 아니나, "auth 경로 추가 시 게이트웨이 라우트 갱신 누락"이 반복 패턴임을 시사.

## MINOR
없음(아래 확인 항목은 모두 정상).

---

## 확인 완료 (PASS 근거)

### 1. 정합성/QA
- **엔드포인트 계약 일치**: `GET /api/v1/auth/nickname/availability`, `@Valid NicknameAvailabilityRequest`(쿼리 `nickname`), 응답 `ApiResponse<{available}>`. 계약 §2 형상 일치. (AuthController L56~65)
- **판정 단일 경로**: `AuthService.isNicknameAvailable` = `!existsByNicknameAndIsDeletedFalse(nickname)` — signup(AuthService L64)·PATCH /me(MemberService L84)와 **동일 메서드**. 조회↔가입 드리프트 없음.
- **검증 400/errors[]**: Request record에 `@NotBlank`+`@Size(max=30)` — signup(SignupRequest L22)·PATCH(MemberProfileUpdateRequest L13)와 **동일 규칙**. 쿼리 바인딩 record + `@Valid` → 400 + errors[] 확인(NicknameAvailabilityIntegrationTest: 공백 "  "·31자 모두 400 errors[] 배열).
- **advisory·정규화 미가**: trim/lowercase 미적용, signup 원문 판정과 일관. TOCTOU 인정·최종 권위=AUTH_002 문서화.
- **소셜 항상-꼬리표**: `resolveUniqueNickname`이 충돌 여부와 무관하게 `stem_XXXX` 부여. 스템 = `NICKNAME_MAX_LENGTH(30) - NICKNAME_SUFFIX_TOTAL(5) = 25`자 절단 → 총 길이 항상 ≤30(VARCHAR(30)). 30자 표시명 테스트가 정확히 30자·`가×25_` 확인.
- **충돌 재시도/초과**: 10회 재시도(36^4≈168만 공간), 초과 시 `CommonErrorCode.INTERNAL_ERROR`. 재시도 테스트(`thenReturn(true, false)`)로 검증.
- **UK·중복검사 무변경**: `existsByNicknameAndIsDeletedFalse`·`nickname_active` UK 무변경 확인(FC-159 결정 B 준수). 조회 API 추가 + 소셜 부여 방식만 변경.

### 2. 회원 식별/인가 (IDOR)
- 엔드포인트는 SecurityContext 미접근·`/me` 미접두·비인증 단순 조회. 기존 주체 인가·/me IDOR에 영향 없음.
- **permitAll 표면**: 추가 경로는 **정확 문자열** `/api/v1/auth/nickname/availability`(와일드카드 아님). 다른 표면을 열지 않음. (SecurityConfig L43~44)

### 3. 프론트(FC-162)
- advisory 정확: `canSubmit`이 `nicknameCheck`에 **비의존** → available:true여도 제출 가능·409(AUTH_002)가 `signupErrorMessage`로 최종 처리(SignupForm handleSubmit).
- 트림 일관: 조회·제출 모두 `nickname.trim()` 전송 → 프론트↔서버 판정값 일치.
- 원문 미노출: catch 블록이 400·네트워크 모두 고정 문구로 수렴, 원문 미표시(테스트 `/boom/` 부재 확인).
- 접근성: `role="status"` + `aria-live="polite"` 결과 통지, `aria-invalid`(taken 시)·`aria-describedby` 배선. 입력 변경 시 `idle` 초기화로 재확인 유도. 기존 화면 회귀 없음(아이디 중복확인은 "준비 중" disabled 자리 유지 — 스코프 밖).

### 4. 테스트 커버리지
- 백엔드: AuthServiceUnitTest 2건(가용/점유), SocialAccountRegistrarTest(항상-꼬리표·재시도·25자 절단), NicknameAvailabilityIntegrationTest 4건(permitAll 200·점유 false·공백 400·초과 400), SocialAccountFindOrCreate 통합 갱신. 경계·예외 충실.
- 프론트: SignupForm.test.tsx 5건(가용/점유/초기화/실패수렴/미입력 disabled). advisory·원문 미노출 검증됨.

### 참고(비판정)
- 선존 실패 테스트 `frontend/.../auth/lib/oauth.test.ts` 3건: 이 워킹트리 diff에 **미포함**(`git status` 무변경)이라 FC-163 변경과 무관 — 마스터 회귀로 별건 확인.
- 회원가입 loginId "중복확인 준비 중" placeholder: 스코프 밖(총괄 별도 판단), 판정 제외.
