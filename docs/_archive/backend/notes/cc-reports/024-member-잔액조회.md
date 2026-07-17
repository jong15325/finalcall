# [Claude Code → 백엔드] 완료 보고: member - 잔액 조회

작업 지시: `docs/backend/outbox/024-member-잔액조회.md` (계약 [4.4])
회신 필요 여부: **회신 필요** — 이슈1(인증 주체 식별 위치 컨벤션) 확정 요망. 나머지는 정보 공유.

## 결과 요약

계약 [4.4] `GET /api/v1/me/balance`(인증 사용자 자기 잔액 조회)를 구현했다.
- `api/member/MemberController`(`/api/v1/me`, B-015) + `MemberBalanceResponse`(record + `from(UserBalance)`).
- `domain/member/MemberService`(readOnly 트랜잭션·`@ServiceLog`) — SecurityContext 주체(userId)로 잔액 조회.
- `UserBalanceRepository.findByUserId` 추가.
- 응답 4필드 = `cashBalance`·`gameMoneyBalance`·`gameMoneyHeld`·`gameMoneyAvailable`(계약 필드명 그대로). `gameMoneyAvailable`은 `UserBalance.getGameMoneyAvailable()`(= 잔액 − 홀드) 파생값 — 컬럼 미신설.
- 잔액 행 부재는 깨진 불변식 → `CommonErrorCode.INTERNAL_ERROR`(`COMMON_999`, 500)(B-029). `MemberErrorCode`·`MEMBER_` 코드 일절 미사용(채번 충돌 표면 0).

## 산출물 (경로)

- 추가(A): `src/main/java/com/finalcall/api/member/MemberController.java`
  — 클래스 레벨 `@RequestMapping("/api/v1/me")`, `@GetMapping("/balance")`, 반환 `ApiResponse<MemberBalanceResponse>`. 다른 핸들러 미포함(프로필·수정·탈퇴는 별도 유닛).
- 추가(A): `src/main/java/com/finalcall/api/member/MemberBalanceResponse.java`
  — record + `@Builder` + `static from(UserBalance)`. 4필드, `gameMoneyAvailable` 파생값.
- 추가(A): `src/main/java/com/finalcall/domain/member/MemberService.java`
  — `@Transactional(readOnly = true)`·`@ServiceLog`. SecurityContext 주체 → `findByUserId` → 부재 시 `COMMON_999`. 엔티티 반환(표현 변환은 api).
- 변경(M): `src/main/java/com/finalcall/domain/member/UserBalanceRepository.java`
  — `Optional<UserBalance> findByUserId(Long userId)` 추가(단순 파생, QueryDSL 불요).
- 추가(A, 테스트): `src/test/java/com/finalcall/domain/member/MemberServiceTest.java`
  — 단위(Mockito). SecurityContext 세팅 후 조회 성공·잔액행 부재(COMMON_999) 2건.
- 추가(A, 테스트): `src/test/java/com/finalcall/api/member/MemberControllerTest.java`
  — 슬라이스(`@WebMvcTest` + 실 SecurityConfig). 인증 성공 4필드·미인증 401(COMMON_005) 2건.

## DoD 대비 충족 (빌드·테스트 결과)

- ✅ **계약 [4.4] 준수**: 200 응답이 정확히 4필드, 필드명 일치, 인증 필수(미인증 401). `MemberControllerTest`가 4필드·값(1000/500/200/300)·401(COMMON_005) 단언 — 통과.
- ✅ **단위·슬라이스 테스트 그린**: `MemberServiceTest` 2/2, `MemberControllerTest` 2/2 (test-results XML failures=0·errors=0 확인).
- ✅ **`./gradlew clean build` 성공(두 모듈)**: BUILD SUCCESSFUL 1m 52s. checkstyle·spotlessCheck·ArchUnit(레이어 규율) 통과. `spotlessApply` 후 재빌드.
- ✅ **CLAUDE.md [5] 컨벤션**: Controller `ApiResponse` 반환·try-catch 없음, Service readOnly·`@ServiceLog`·`Preconditions`류 검증, DTO record + `from`, 엔티티→DTO 변환 api 계층.
- ✅ **`findByUserId` 파생 쿼리 검증**: 별도 통합테스트는 지시 범위 밖이나, Spring Data 가 컨텍스트 부팅 시 파생 쿼리를 파싱·검증하며 전 `@SpringBootTest`(19개 스위트) 그린으로 프로퍼티 경로 해석을 간접 확인(부트 실패 부재 = 검증됨).

## 이슈 (백엔드 흡수 요망)

1. **[회신 요망] 인증 주체 식별 위치 — MemberService가 SecurityContext를 직접 읽음(첫 사례)**.
   지시서가 "MemberService … SecurityContext에서 사용자 식별"이라 명시해 그대로 `MemberService`가
   `SecurityContextHolder`에서 userId를 읽게 구현했다. 다만 기존 유일 선례인 로그아웃은 **컨트롤러**가
   `Authentication`을 받아 `authService.logout(authentication.getName(), …)`로 넘기고 `AuthService`는
   SecurityContext를 만지지 않는다(심볼 grep: `SecurityContextHolder` 프로덕션 사용처는 필터·AuditorAware뿐,
   서비스 계층 0건이었음 → 이번이 도메인 서비스 최초 직접 참조). 두 방식이 공존하면 이후 member/인증 서비스
   컨벤션이 갈린다. **(a) 서비스가 읽기(현 구현, 지시서 문언)** vs **(b) 컨트롤러가 추출해 인자로 전달(로그아웃 선례)**
   중 표준을 확정해 주면 정합화하겠다. 현 구현은 (a)이며 두 방식 모두 B-009("SecurityContext 기준") 충족.

2. **[정보] `@WebMvcTest` 슬라이스 첫 도입 — 보안 배선 패턴**. 리포지토리 최초의 `@WebMvcTest`다(기존 슬라이스는
   `@DataJpaTest`만, grep으로 `@WebMvcTest` 0건이었음). 실제 401 경로 검증을 위해 `SecurityConfig` +
   `JwtAuthenticationEntryPoint`·`JwtAccessDeniedHandler`를 임포트하고, `SecurityConfig` 협력자를
   `GatewayInternalProperties(enforced=false)` 실제 빈 + `@MockBean TokenProvider`로 채웠다. 인증 주입은
   `spring-security-test`의 `.with(user("42"))`. 향후 인증 컨트롤러 슬라이스의 재사용 템플릿으로 참고.

3. **[정보] 빌드 1회 일시 실패(플레이크) 후 재실행 그린**. 첫 `clean build`에서 전 `@SpringBootTest`가 동시
   `initializationError`(공유 Testcontainers 초기화 레이스 시그니처)로 33건 실패했으나, 코드 변경 없이 재실행 시
   전량 그린. 코드 결함 아님. 동일 증상 목격 시 재실행으로 판별 요망.

## 다음 단계 제안

- 프로필 조회(029)·수정·탈퇴(후속 유닛) — 계약 v1.4 [2.5] 해금분. 착수 시 이슈1 확정 컨벤션으로 `MemberController` 확장.
- 잔액 원자적 갱신·홀드/차감(화폐·bid 도메인, D-008).
- 이슈1 표준 확정 후 필요 시 `MemberService`/컨트롤러 정합(two-way door, 소폭).

## 회신 필요/불요
- **회신 필요**: 이슈1(인증 주체 식별 위치 표준).
- **정보 공유(조치 불요)**: 이슈2·3.

## 신규 발번 ID
- 없음.

## 커밋 제안 (실행은 사용자)
```
feat(member): 잔액 조회 API 추가 (GET /api/v1/me/balance)

목적
- 계약 [4.4] 내 잔액 조회를 구현한다. 인증 사용자의 캐시·게임머니·홀드·가용 잔액을 반환.

세부 내용 (영역별)
- api: MemberController(/api/v1/me, B-015) + MemberBalanceResponse(record, from(UserBalance))
- domain: MemberService(readOnly 트랜잭션·@ServiceLog) — SecurityContext 주체로 잔액 조회
- domain: UserBalanceRepository.findByUserId 추가
- 잔액 행 부재는 불변식 위반 → COMMON_999(500). MEMBER_ 코드 미사용(B-029)
- gameMoneyAvailable 은 balance − held 파생값(컬럼 미신설)

수정 파일
  변경(M): domain/member/UserBalanceRepository.java
  추가(A): api/member/MemberController.java, api/member/MemberBalanceResponse.java,
           domain/member/MemberService.java,
           test/domain/member/MemberServiceTest.java, test/api/member/MemberControllerTest.java

검증
- 단위·슬라이스 테스트 그린, ./gradlew clean build 성공(두 모듈). 계약 [4.4] 필드 4종 일치.

범위 밖(다음 단계)
- 프로필 조회(029)·수정·탈퇴(후속 유닛), 잔액 원자적 갱신·홀드(화폐·bid 도메인)
```
