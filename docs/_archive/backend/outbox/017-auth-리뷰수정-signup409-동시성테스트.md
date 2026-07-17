상태: DONE (2026-07-14 M1·m2·n1 반영 완료. clean build 그린, 500 미발생 409 정합. B-024 반영. UK 제약명 V3 기존 확인. m1/m3/B-017/B-018 미변경 준수)
# [백엔드 → Claude Code] 작업 지시: auth 코드리뷰 수정 (M1 signup 409 + m2 동시성 테스트 + n1)

대상: auth 수직 코드리뷰 지적 반영. 병합 차단 M1 해소 + 테스트/문서 보강.
참조: 코드리뷰 M1·m2·n1, api-contract §2 signup(AUTH_001/002), B-024·B-025(m1 이월), B-011, CLAUDE.md §5·§7.

## 범위(포함)

1. M1 (병합 차단) — signup 중복 경쟁 시 409 정합 (B-024)
   - `AuthService.signup`: 기존 `existsBy` 선검사는 UX용 빠른 실패로 유지. 추가로 save 시
     `DataIntegrityViolationException`을 서비스에서 catch → 위반된 UK를 구분해 AUTH_001(loginId)/AUTH_002(nickname)로 재던짐.
   - UK 제약을 구분 가능하도록 명명 확인/정정(예: `uk_user_login_id`, `uk_user_nickname`). 제약명 기반으로 어느 UK인지 판정.
   - 이중 방어: 선검사(일반 케이스) + 제약 안전망(경쟁·더블클릭).
   - 테스트: 경쟁/제약 위반 유발 시 500이 아닌 409 AUTH_001/002 반환 확인(통합).

2. m2 — rotate 단일 승자 동시성 테스트
   - `RefreshTokenStore` 통합 테스트에 `CountDownLatch`로 동일 refresh를 N스레드 동시 rotate → 정확히 1개만 OK(Rotation),
     나머지는 empty + 해당 세션 무효화(재사용 탐지) 확인. Lua CAS 회귀 방지용.

3. n1 — validate() 용도 명시
   - `RefreshTokenStore.validate()`가 프로덕션 미참조(rotate가 원자 검증+회전을 대체)임을 Javadoc에 "테스트 지원(프로덕션은 rotate 사용)"로 명시. 제거하지 말 것(테스트가 저장 확인에 사용).

## 하지 말 것
- refresh 만료 정책 변경(m1 → B-025 보안 게이트2 이월, 슬라이딩 현행 유지).
- BCrypt 바이트 검증(m3 → B-016 보안 게이트2), 타이밍(B-017)·refresh-탈퇴(B-018) 손대지 말 것.
- 계약 변경, 다른 도메인.

## 구현 지침
- `DataIntegrityViolationException`은 서비스 계층에서 catch(전역 핸들러는 어느 UK인지 구분 불가). 도메인 예외(AuthErrorCode)로 변환.
- CLAUDE.md §5 컨벤션 + §7 스타일: 수정 후 `./gradlew spotlessApply` 실행, checkstyle·spotlessCheck 통과 필수.

## DoD
- M1: 중복 경쟁 시 409 AUTH_001/002 반환 테스트 통과(500 미발생).
- m2: 동시 rotate 단일 승자 테스트 통과.
- `./gradlew clean build` 완전 그린(checkstyle main·test·spotless·test 전부).

## 커밋 제안(분리)
- `fix(auth): 회원가입 중복 경쟁 시 409 정합 — 제약 위반 AUTH_001/002 매핑`
- `test(auth): rotate 단일 승자 동시성 테스트 + validate 용도 명시`
