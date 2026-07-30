---
ticket: FC-169
reviewer: reviewer
date: 2026-07-30
verdict: PASS
blocking: []
resolved: [M1]
scope: [SignupForm.tsx, SignupForm.test.tsx]
contract: docs/spec/api-contract.md §2 v1.19
---

# FC-169 리뷰 — 회원가입 중복확인 필수 게이팅

## 판정: PASS (재검증 2026-07-30 · M1 해소)
1차 CHANGES-REQUESTED(MAJOR M1 비동기 경합). frontend-impl 재작업(useRef 현재값 스냅샷 + resolve 시점 검사값==현재값 비교로 stale 응답 폐기, 성공·catch 양쪽·양 필드 대칭 + 경합 회귀 테스트)으로 **해소**. 재검증 결과 stale 부활 경로 차단·값 원복 과잉차단 없음·회귀 테스트 유효 확인 → **PASS**. minor m1~m3 비차단.

## MAJOR — M1: in-flight 조회 중 값 변경 시 stale resolve가 idle→available 부활
- 재현: ①아이디 `player1` 입력→중복확인 클릭(checking, 요청 in-flight) ②응답 전 값을 `admin`으로 변경→`handleLoginIdChange`가 idle 초기화 ③`player1` 응답 available 도착→닫힌 클로저가 `setLoginIdCheck('available')` ④최종 `loginId='admin'` + check='available' ⑤제출 게이트 통과 → 확인 안 된 `admin` 전송.
- 재현 조건: checking 동안 버튼은 비활성이나 **입력 필드는 비활성 아님**(`AuthTextField` disabled 없음) → 조회 중 타이핑 가능. 느린 네트워크/빠른 타이핑에서 도달.
- 심각도: 백엔드 409(AUTH_001/002)·400 최종 방어선이 살아 계정 오생성은 없음 → critical 아닌 **major**(UX 계약·불변식 위반).
- 수정 방향: resolve 시 **검사값 == 현재 입력값** 일치할 때만 상태 반영(값 비교 또는 요청 시퀀스 토큰), 또는 checking 동안 입력 필드 disable. 이 경합 케이스 테스트도 추가(현재 공백).

## MINOR (비차단)
- m1: checking 상태에서 제출 시 게이트는 차단·포커스 이동하나 해당 필드 안내 문구 없음(idle에만 안내). 차단 자체는 정상.
- m2: `invalid`를 `feedback.tone==='bad'`로 확대 → error 상태도 aria-invalid/border-danger(일관성 개선, 회귀 아님).
- m3: 제출 실패 안내가 조회용 `role=status aria-live=polite` 공유(assertive가 더 적합할 수 있으나 DoD 재사용 요구 부합).

## 정상 확인
- 동기 경로 게이트 정확(available&&available만 제출, idle/checking/taken/error 차단), 값변경 idle 초기화(동기), 검증 순서 충돌 없음, 포커스 타깃 id 정확, FC-162/167 동작·소셜 미노출·백엔드 409 보존. 테스트 4시나리오 타당(M1 경합·error·포커스 미커버).
