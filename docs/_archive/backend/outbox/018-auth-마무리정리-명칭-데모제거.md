상태: DONE (2026-07-14 TokenBundle 명칭 통일 + 데모 제거 완료. clean build 그린, 잔재 grep 0. 데모 테스트 삭제·401 회귀 LogoutIntegrationTest 이관. 실 로직·계약 무변경)
# [백엔드 → Claude Code] 작업 지시: auth 마무리 정리 (LoginResult 명칭 통일 + 데모 컨트롤러 제거)

대상: auth 도메인 내부 정리(계약·외부 무영향). 리팩터 2건.
참조: 010 흡수(LoginResult login/refresh 공용), 011 보고(데모 컨트롤러 정리 대기), CLAUDE.md §5·§7.

## 범위(포함)

1. LoginResult 중립 명칭 통일
   - login·refresh가 공용하는 도메인 발급 결과 `LoginResult`(access·refresh·accessExpiresAt 묶음)를 의미 중립 명칭으로 리네임.
     추천: `TokenBundle`(발급된 토큰 묶음). 사용처(AuthService login/refresh, 응답 DTO 매핑) 전부 갱신.
   - 내부 record라 계약·외부 무영향(two-way door). IDE 안전 리팩터 수준으로 전 참조 일괄 갱신.

2. 데모 AuthDemoController 제거
   - F1 데모 엔드포인트(`/auth/token`·`/auth/me`)를 담은 `AuthDemoController` 제거. 실 엔드포인트(signup·login·refresh·logout)로 대체됨.
   - 데모 전용 테스트·참조·설정(SecurityConfig permit 등)이 있으면 함께 정리. 제거 후 컴파일·테스트 깨짐 없게 확인.

## 하지 말 것
- 실 `AuthController`/`AuthService` 로직 변경, 계약 변경, 다른 도메인.
- 토큰 발급/검증 로직 자체 변경(명칭만).

## 구현 지침
- 리네임은 전 참조 갱신(누락 시 컴파일 에러). 데모 제거로 인한 보안 설정·라우팅 잔재 없게.
- CLAUDE.md §5 컨벤션 + §7 스타일: 수정 후 `./gradlew spotlessApply` 실행, checkstyle·spotlessCheck 통과 필수.

## DoD
- `./gradlew clean build` 완전 그린(checkstyle·spotless·test).
- 데모 엔드포인트(/auth/token·/auth/me) 부재 확인. `TokenBundle` 명칭 통일, 잔여 LoginResult 참조 0.

## 커밋 제안(분리)
- `refactor(auth): 토큰 발급 결과 중립 명칭(TokenBundle) 통일`
- `chore(auth): F1 데모 컨트롤러 제거 — 실 엔드포인트로 대체`
