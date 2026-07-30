# FC-158 리뷰 — 회원가입 화면 소셜 로그인 버튼 제거

- **판정**: PASS (critical 0 / major 0 / minor 0)
- **리뷰어**: reviewer 서브에이전트
- **일자**: 2026-07-30
- **대상 커밋 전 워킹트리**: `frontend/src/features/auth/components/SignupForm.tsx`, `SignupForm.test.tsx`

## 확인 결과 (축별)
1. **정합성/QA — 통과**: `import SocialLoginSection`·`<SocialLoginSection />` 제거, docstring 정확히 갱신. 고아 구분선·빈 여백 없음(뒤 `<p className="mt-6">`가 여백 유지). 공유 컴포넌트(`SocialLoginSection`·`SocialLoginButton`·`oauth.ts`)·`LoginForm` 무수정 확인. 소셜 진입은 이제 로그인 화면 한 곳(티켓 의도 일치).
2. **테스트 — 통과**: `vitest run SignupForm.test.tsx LoginForm.test.tsx` → 17/17 pass. SignupForm 소셜 단언을 `queryByRole(...).toBeNull()`(부재)로 올바르게 재구성, 중복확인 disabled 단언 유지. LoginForm 소셜 단언 6건 무수정 통과.
3. **잔여물 — 없음**.
4. **범위 준수**: 코드 변경 = 지정 2파일뿐. 보드/문서(HANDOVER·FC-158/159)는 메인세션 산출물로 코드 범위 밖(정상).

## 후속 참고 (비차단)
- 커밋 시 코드 2파일과 보드 문서는 별도 커밋으로 분리(atomic 커밋 규율, 섹션 13).

## 백엔드 설계 전달용 보고
해당 없음 — 프론트 UI 제거 단일 건. 백엔드 계약·스키마·인가 표면 무영향.
