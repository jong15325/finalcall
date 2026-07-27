# EMAIL-VERIFY-FE 통합 검수 (FC-136~139)

- **일시**: 2026-07-27
- **리뷰어**: reviewer (읽기 전용)
- **대상**: EPIC-EMAIL-VERIFY-FE 미커밋 워킹트리 (F1~F4)
- **검증**: `npm run typecheck` clean · `npm run lint` clean · `vitest run` 관련 40/40 통과 (errorCodes 5·OtpInput 5·ProfileCard 9·SignupForm 10·VerificationCard 11)

## 판정
**critical 0 · major 0 · minor 5.** 네 티켓 모두 **passed**. 재작업 대상 없음.

핵심 보안·계약·타이머 축 견고:
- 원문 미노출(전 뷰 마스킹만, 설정 폼 draft만 예외 — spec §7 허용)·서버 에러 원문 미노출(code 분기)·코드값 미로깅·IDOR/열거 방지(/me 자기리소스, 임의 이메일 파라미터 없음).
- 계약 형상 1:1(PUT /me/email·verification-request 202·verify·GET /me 3상태·EMAIL_001~007 상태코드).
- 정책값(TTL 600·쿨다운 60·시도 5·6자리) 상수 = spec §3 일치. setInterval `[mode]` 의존·언마운트 clearInterval 정리(누수 없음).
- 접근성: OTP role=group·칸별 label·inputmode=numeric·autocomplete=one-time-code·aria-invalid/describedby·터치타깃.

## Minor findings
- **M-1 (UX·상태머신, FIXED)**: 최초 "인증 코드 받기"가 쿨다운(EMAIL_004)에 걸리면 이미 발송된 코드 입력 경로 없음 → EMAIL_004 시에도 코드 입력 화면 진입·남은 쿨다운 표시로 보완.
- **M-2 (엣지, FIXED)**: 만료(ttl=0) 후 OtpInput onComplete 자동제출이 verify 호출(서버 EMAIL_002 거부·무해) → 자동제출 가드에 expired 추가.
- **M-3 (엣지, FIXED, 방어적)**: handleResend onError가 EMAIL_006 미처리(발생 경로 사실상 없음) → 방어 보완.
- **M-4 (노이즈, 유지)**: SignupForm.test.tsx prettier 재정렬로 무관 라인 diff 유입. 동작 무변경 → 유지(비차단).
- **M-5 (문서, FIXED)**: FC-139 artifacts에 `lib/api/session.ts` 오기 — 실제는 `lib/api/auth.ts`(MeResponse). 티켓 정정.

## O-1 (목업 충실도)
목업 primary 버튼은 잉크/블랙(템플릿 로컬 팔레트), impl은 orange CTA로 치환. **오렌지가 앱 전역 표준 primary CTA**(Login·Signup·BidDialog·BidPanel·ProfileCard 동일) → 브랜드 토큰 정합, 회귀 아님. 3상태·OTP·쿨다운·에러 카탈로그(again/reissue/wait/info/setup/field) 구조는 목업 이식.

## review_status
FC-136 passed · FC-137 passed · FC-138 passed · FC-139 passed.
