상태: 완료 — Claude Code 실행·백엔드 흡수 → 총괄 보고 backend/outbox/031
# [백엔드 → Claude Code] 작업 지시: member - 계정·잔액 엔티티 도메인 재배치 (B-028)

주(실행 후 정정): 아래 "참조자 실측 5파일"은 **부정확했다**. 실제 7파일 — `LoginResponse`·`RefreshResponse`는
  `TokenBundle`(auth 존치)만 참조해 변경 불요였고, 반대로 동일 패키지라 import 없이 쓰던
  `UserRepository`·`AuthServiceUnitTest`·`UserRepositorySliceTest`가 누락됐다(원인: import 문 기준 grep이
  동일 패키지 사용처를 못 봄). DoD의 grep 패턴도 이스케이프 누락으로 `domain.auth.UserRepository` 오탐.
  상세·정정은 031 참조. B-028 결론은 불변(7파일도 이동 비용 최소 구간).

대상: `User`·`UserBalance`·`UserBalanceRepository`를 `domain/auth` → `domain/member`로 이동.
  **기능 무변경 순수 리팩터** — 로직·시그니처·테이블·API 일절 건드리지 않는다.

참조: B-028(결정·이유), CLAUDE.md §4(의존 방향)·§5(도메인 컨벤션)·§7(스타일), erd §4.1(user·user_balance)

## 범위
1. `src/main/java/com/finalcall/domain/auth/` → `domain/member/` 이동 3파일:
   `User.java`, `UserBalance.java`, `UserBalanceRepository.java` (package 선언 변경)
2. 참조자 import 갱신 (실측 5파일 — 이동 후 컴파일 에러로 재확인할 것):
   - `api/auth/AuthController.java`, `api/auth/LoginResponse.java`, `api/auth/RefreshResponse.java`,
     `api/auth/SignupResponse.java`
   - `src/test/java/com/finalcall/integration/SignupConcurrencyIntegrationTest.java`
   - `domain/auth/AuthService.java`(동일 패키지였으므로 import 신규 추가 필요)
3. Javadoc 문구 정정: `UserBalance`·`UserBalanceRepository` 클래스 주석의 "(auth)" 표기 → "(member)".
   `UserBalanceRepository` 주석 "가입 시 User 와 1:1 잔액 행을 함께 생성한다"는 사실이므로 유지.
4. ArchUnit 규칙이 패키지 경계를 검사하면 통과 확인(의존 방향 `api → domain` 불변이라 위반 없어야 정상).

## 하지 말 것
- 로직·메서드 시그니처·필드 변경. 잔액 증감 메서드(`addCash`/`addGameMoney`/`hold`/`release`)는 **시그니처만
  있는 현 상태 유지** — 원자적 갱신(D-008) 구현은 화폐 도메인 후속.
- `AuthService`·`AuthErrorCode`·`TokenBundle` 이동(auth 존치). Flyway 마이그레이션 추가·테이블명 변경.
- 잔액 조회 API 추가(별도 단위 024). member 프로필·탈퇴(계약 미확정, 착수 금지 — 068).
- 이 커밋에 다른 변경 혼입.

## 구현 지침
- CLAUDE.md §5 컨벤션 준수(엔티티 현행이 이미 정합 — `@NoArgsConstructor(PROTECTED)`·`@Builder`·`@Setter` 금지).
- 이동은 IDE refactor 수준의 기계적 변경. **의미 변경 0**이어야 한다.
- `./gradlew spotlessApply` 후 checkstyle 통과(CLAUDE.md §7 의무).

## DoD
- `./gradlew clean build` 그린(두 모듈 전체 테스트) — 기능 무변경의 증거.
- `grep -r "domain.auth.User\|domain.auth.UserBalance" src/` 결과 0건.
- `domain/member/`에 3파일 실재, `domain/auth/`에 잔존 0건.

## 커밋 제안 (실행은 사용자)
```
refactor(member): 계정·잔액 엔티티를 auth에서 member 도메인으로 이동

목적
- 계정 마스터·잔액의 소유를 member 로 정정. auth 는 인증 로직만 소유하고 member.User 를 참조한다(B-028).

세부 내용 (영역별)
- domain: User·UserBalance·UserBalanceRepository 를 domain/auth → domain/member 이동(package 선언 변경)
- api/domain 참조자: import 경로 갱신(api/auth 4파일, AuthService, 통합테스트 1파일)
- 문서: 클래스 Javadoc 의 도메인 표기 (auth) → (member) 정정

수정 파일
  변경(M): api/auth/AuthController.java, api/auth/LoginResponse.java, api/auth/RefreshResponse.java,
           api/auth/SignupResponse.java, domain/auth/AuthService.java,
           test/integration/SignupConcurrencyIntegrationTest.java
  추가(A): domain/member/User.java, domain/member/UserBalance.java, domain/member/UserBalanceRepository.java
  삭제(D): domain/auth/User.java, domain/auth/UserBalance.java, domain/auth/UserBalanceRepository.java

검증
- ./gradlew clean build 그린. 기능·시그니처·스키마 무변경(순수 이동).

범위 밖(다음 단계)
- 잔액 조회 API(024), member 프로필·탈퇴(계약 확정 후), 잔액 원자적 갱신(화폐 도메인)
```
