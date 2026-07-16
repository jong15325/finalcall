관련 스레드: MEMBER
# [백엔드 → Claude Code] 작업 지시: member 3유닛 — `GET`/`PATCH`/`DELETE /me` + `MemberErrorCode` (한 묶음)

목표

- 계약 v1.4 `[2.5]` 회원 리소스 3종을 구현한다. `MemberErrorCode`를 신설한다.
- **기존 024(잔액 조회)를 이슈1 (b)로 정합**시킨다 — 같은 커밋이다. 아래 [A].
- **`RefreshTokenStore`에 세션 일괄 폐기를 신설**한다 — 지금 없다. 아래 [D].

## 근거(인용)

> **api-contract v1.4 `[2.5]`**(확정 스펙 · `docs/spec/api-contract.md`:104~125):
> *"**GET /api/v1/me** — 응답 200: `{ userPublicId, nickname, isAdmin, createdAt }`. `loginId`·`passwordHash`는
> 응답에 싣지 않는다(열거 리스크 SEC-007). `isAdmin`은 관리자 UI 노출 제어용으로 포함하되 **인가는 서버 권위**다.
> 에러: 401(미인증)"*
>
> *"**PATCH /api/v1/me** — 요청: `{ nickname }` — 수정 가능 필드는 nickname뿐이다. 응답 200: 조회와 동일 스키마.
> 변경 빈도 제한 없음. 에러: `MEMBER_001` 닉네임 중복(409), 검증 400, 401"*
>
> *"**DELETE /api/v1/me** — 요청: `{ balanceForfeitAcknowledged: true }` — 잔존 잔액 소멸·복구 불가에 대한
> **명시 동의**(D-080). 미동의·누락 시 400. **잔액이 0이어도 필드는 필수다**(클라 분기 제거·감사 추적 일관성).
> 응답 204. 동작: soft delete + **refresh 세션 전부 폐기**(SEC-006). 차단 조건: 진행 중 경매(판매자)·홀드 보유
> 입찰·미완료 주문이 하나라도 있으면 `MEMBER_002`(409). **잔액 잔존은 차단 사유가 아니다**(D-080).
> 재가입: login_id·nickname 재사용 허용"*

> **api-contract v1.4 `[5]`**(`:336`~`:337`): *"`MEMBER_001` 닉네임 중복(프로필 수정, §2.5) 409 /
> `MEMBER_002` 진행 중 거래 보유로 탈퇴 불가(§2.5) 409"*

> **B-029**(ACCEPTED, `docs/backend/decision-log.md`): *"`MemberErrorCode`는 프로필·수정·탈퇴 유닛에서
> 계약 [5] 확정 번호(기획 069)로 신설한다."*

> **B-018**(ACCEPTED): *"rotate(Lua CAS 원자)가 신규 refresh를 먼저 저장한 뒤 소유자 `isDeleted`를 판정 →
> 탈퇴 계정의 신규 세션이 생길 수 있다. **후속: member 탈퇴 구현 시 (a) 회전 전 소유자 유효성 선검증 또는
> (b) 탈퇴 시 refresh 세션 일괄 폐기로 해소.**"* → **이번엔 (b)를 한다.** 아래 [D].

> **D-080**(ACCEPTED): *"탈퇴 시 잔존 잔액 소멸 동의. 탈퇴는 잔액 잔존과 무관하게 허용하고 잔액 조건 차단
> 분기를 두지 않는다."*

## [A] 이슈1 (b) 정합 — 기존 024 코드를 고친다. **이게 첫 단계다**

**결정(B-031 예정, 총괄 승인분)**: **컨트롤러가 `Authentication`을 받아 서비스에 `userId`를 인자로 넘긴다.**
서비스는 `SecurityContextHolder`를 만지지 않는다.

- **고칠 것**:
  - `domain/member/MemberService.java` — `private Long currentUserId()` **삭제**, `getMyBalance()` →
    `getMyBalance(Long userId)`. `SecurityContextHolder`·`Authentication` import 제거.
  - `api/member/MemberController.java` — `getBalance(Authentication authentication)`로 받아
    `Long.parseLong(authentication.getName())`을 서비스에 넘긴다.
  - `MemberServiceTest` — SecurityContext 세팅 제거(인자로 넘기면 되므로 훨씬 단순해진다).
    **`MemberControllerTest`는 그대로 통과해야 한다**(외부 계약 무변경).
- **선례가 (b)다** — `api/auth/AuthController.java`:61 `logout(Authentication authentication, …)` →
  `authService.logout(authentication.getName(), …)`. **`AuthService`는 SecurityContext를 안 만진다. 그 형태로 맞춘다.**
- **principal 해석 규약**: JWT 필터가 subject=userId(내부 PK)로 적재한다(B-009·B-014).
  `Long.parseLong(authentication.getName())` — **이 파싱을 컨트롤러 3~4곳에 복붙하지 말고 `MemberController`
  private 헬퍼 1개로 모아라.** api 계층에 둔다(domain으로 내리지 마라 — 그게 (a)로 되돌아가는 것이다).
- **외부 동작 무변경**: URL·응답·상태코드 전부 그대로다. 순수 리팩터 + 신규 3종이 한 커밋에 붙는다.

## [B] `MemberErrorCode` 신설

- 위치: `domain/member/MemberErrorCode.java`. `common/exception/ErrorCode` **인터페이스 구현 enum**
  (선례: `infra/security/GatewayErrorCode`, `domain/auth/AuthErrorCode`).
- **계약 `[5]` 확정 번호 그대로. 새 코드 만들지 마라**:
  - `MEMBER_001` — 닉네임 중복, **409 CONFLICT**
  - `MEMBER_002` — 진행 중 거래 보유로 탈퇴 불가, **409 CONFLICT**
- **`COMMON_999`(잔액 행 부재, B-029)는 그대로 둔다** — `MemberErrorCode`로 옮기지 마라. 그건 불변식 위반이지
  비즈니스 상태가 아니다.

## [C] `GET /me` · `PATCH /me`

**`MemberProfileResponse`**(record + `@Builder` + `static from(User)`) — 4필드:
`userPublicId`(= `User.publicId`) · `nickname` · `isAdmin` · `createdAt`(`BaseTimeEntity`, `Instant`).
- **`loginId`·`passwordHash`·내부 `id`를 절대 싣지 마라**(계약 [2.5] 명시 · SEC-007).
- `GET`·`PATCH` **응답 스키마가 동일**하다 — DTO 1개를 공유한다.

**`MemberUpdateRequest`**(record) — `{ nickname }`:
- **검증은 signup과 동일하게 건다. 새 규칙을 만들지 마라**:
  `@NotBlank(message = "닉네임은 필수입니다.")` + `@Size(max = 30, message = "닉네임은 30자 이하여야 합니다.")`
- **근거**: `api/auth/SignupRequest.java`의 nickname이 정확히 이 둘이다(실측). **계약이 최소 길이·문자셋·공백
  규칙을 안 준다 — 지금 네가 발명하면 가입과 수정이 갈린다.** 기획 확정이 오면 그때 양쪽을 같이 바꾼다.

**중복 검사(`MEMBER_001`)** — **B-024 선례를 그대로 따른다. 선검사만으로 끝내지 마라**:
1. **선검사**: `userRepository.existsByNicknameAndIsDeletedFalse(nickname)` → true면 `MEMBER_001`.
   **`AndIsDeletedFalse`를 반드시 붙여라**(D-081 재가입 — 탈퇴행과 활성행이 공존한다. 필터 없으면 탈퇴자 닉네임이 영구 점유된다).
2. **★ 자기 자신 제외**: **현재 닉네임과 동일한 값이면 중복이 아니다.** 자기 닉네임은 이미 UK에 있으므로
   **선검사를 그냥 걸면 "내 닉네임으로 수정"이 409가 난다.** 같으면 검사를 건너뛰고 그대로 200을 반환한다(no-op).
3. **제약 위반 매핑**: 동시 요청이 선검사를 함께 통과할 수 있다. `DataIntegrityViolationException`을
   `MEMBER_001`로 매핑한다 — **B-024가 signup에서 한 것과 같은 형태이고, 제약명으로 구분한다.**
   V4 UK명을 **실측해서** 확인해라(`backend/src/main/resources/db/migration/V4__user_natural_key_uk.sql`).
   기존 매핑 코드가 어디서 어떻게 하는지 먼저 읽어라(`AuthService` signup 경로).
- **변경은 도메인 메서드로**: `User.changeNickname(nickname)` **이미 있다.** setter 금지(CLAUDE.md `[5]`).
  쓰기 메서드에만 `@Transactional` 오버라이드.

## [D] `DELETE /me` — 여기가 이번 유닛의 핵심이다

**`MemberWithdrawRequest`**(record) — `{ balanceForfeitAcknowledged }`:
- `@AssertTrue(message = "잔액 소멸에 동의해야 탈퇴할 수 있습니다.")` — **`Boolean` 래퍼로 받고 `@NotNull`도 걸어라.**
  `boolean` primitive면 필드 **누락**이 `false`로 조용히 바뀌어 "미동의 400"과 "누락 400"이 구분되지 않는다.
  계약은 **미동의·누락 둘 다 400**이라 결과는 같지만, **누락을 false로 보는 코드는 다음에 필드가 늘면 틀린다.**
- **잔액이 0이어도 필수다**(계약 [2.5] 명시). **잔액을 보고 분기하지 마라** — D-080이 잔액 조건 차단 분기를 금지한다.

**응답**: 204. **`ApiResponse`로 감싸지 마라** — `void` + `@ResponseStatus(HttpStatus.NO_CONTENT)`
(B-019·D-076 · CLAUDE.md `[5]` 204 예외). **선례: `AuthController.logout`.**

**차단 조건(`MEMBER_002`) — 구조만 만든다. 지금 검사 대상이 공집합이다**:
- 계약은 3종을 막는다: 진행 중 경매(판매자) · 홀드 보유 입찰 · 미완료 주문.
- **bid·auction·order 도메인이 미구현이라 조회할 테이블이 없다**(총괄 072 승인분).
- **방식(지시)**: `MemberService`에 **private 메서드 1개**를 두고 그 안에서 **지금은 `false`를 반환**한다.
  ```java
  /**
   * 탈퇴 차단 조건(계약 [2.5]) — 진행 중 경매·홀드 보유 입찰·미완료 주문.
   * TODO(MEMBER_002): auction·bid·order 도메인 구현 시 각 리포지토리 조회로 채운다.
   * 현재는 대상 테이블이 없어 항상 false 다(총괄 072 승인 — 구조만 두고 도메인 완성 시 채운다).
   */
  private boolean hasBlockingTransactions(Long userId) { return false; }
  ```
  호출부는 지금 넣어라: `if (hasBlockingTransactions(userId)) throw new BusinessException(MemberErrorCode.MEMBER_002);`
- **★ 검사가 항상 통과한다는 걸 숨기지 마라.** 주석에 명시하고 **완료 보고에도 방식을 명시해라**(총괄 072 의무).
- **`blockedBy` 응답 필드는 넣지 마라** — 총괄 계약 판정 대기 중이다(`outbox/MEMBER/002`). envelope에 자리가 없다.

**★ refresh 세션 전부 폐기 — API가 없다. 신설해라**:
- **실측**: `infra/security/RefreshTokenStore`에 `revoke(presentedToken, ownerUserId)` **단일 세션 폐기만 있다.**
  계약 [2.5]는 *"refresh 세션 **전부** 폐기"*를 요구한다. **없는 API다.**
- **키 구조**: `auth:refresh:{userId}:{sessionId}` (`KEY_PREFIX = "auth:refresh:"`, `key(userId, sessionId)`).
- **신설**: `RefreshTokenStore.revokeAll(String userId)` — `auth:refresh:{userId}:*` 패턴의 키를 전부 지운다.
- **★ `KEYS` 명령을 쓰지 마라. `SCAN`으로 해라.** `KEYS`는 Redis 단일 스레드를 키 전체 순회 동안 블로킹한다 —
  운영에서 전 요청이 멈춘다. `RedisTemplate.scan(ScanOptions.scanOptions().match(pattern).count(N).build())`
  또는 `execute(RedisConnection…)`. **커서 기반이라 원자적이지 않다** — 그건 아래 순서로 다룬다.
- **`RefreshTokenStore`는 infra다. `MemberService`(domain)가 직접 주입해 쓴다** — `api → domain → infra` 정합이다
  (CLAUDE.md `[4]`). **`AuthService`를 거치지 마라** — domain→domain 교차 의존은 B-028이 차단한 형태다.

**★ 순서(중요 — B-018)**:
1. 차단 조건 검사 → 2. `user.delete()`(soft delete) → 3. **트랜잭션 커밋** → 4. `revokeAll(userId)`
- **폐기를 커밋 뒤에 둬라.** 커밋 전에 지우면 롤백 시 세션만 날아간다.
- **잔여 레이스가 있다. 없앨 수 있다고 쓰지 마라**: 3↔4 사이에 `rotate`가 신규 세션을 만들면 `revokeAll`이
  못 지운다(B-018 본체 — rotate가 저장 뒤에 `isDeleted`를 본다). **(b)로 창을 좁히는 것이지 닫는 게 아니다.**
  **완료 보고에 이 한계를 명시해라**(D-086). B-018 완결(= rotate 선검증)은 **이번 범위 밖이다.**

## 범위

- **파일**: `backend/src/main/java/com/finalcall/api/member/**` · `backend/src/main/java/com/finalcall/domain/member/**` ·
  `backend/src/main/java/com/finalcall/infra/security/RefreshTokenStore.java`(**`revokeAll` 추가만**) ·
  대응 테스트(`backend/src/test/java/com/finalcall/{api,domain}/member/**`).
- **하지 말 것**:
  - **`spec/` 3종·`CLAUDE.md`·`docs/**` 수정 금지**(D-093 동결 · 확정 스펙은 기획만).
  - **Flyway 마이그레이션 금지** — 이번 유닛은 **스키마 변경이 없다**(User 엔티티에 필드 추가 없음).
    V5를 만들지 마라.
  - **`AuthService`·`AuthController`·`SignupRequest` 수정 금지**(`revokeAll` 신설 외 auth 무접촉).
    **rotate에 손대지 마라** — B-018 본체는 범위 밖이다.
  - **비밀번호 변경 금지**(계약 [2.5] 명시 범위 밖 · 068 · B-016 보안 게이트2).
  - **타인 프로필 조회(`/users/{publicId}`) 금지**(계약 [2.5] 범위 밖 · SEC-007).
  - `blockedBy`·`details` 응답 필드 금지(총괄 판정 대기).
  - `CommonErrorCode`·`ErrorResponse` envelope 수정 금지.
  - nickname 검증 규칙 발명 금지(signup과 동일하게만).

## DoD

- **계약 준수**: `[2.5]` 3종 전부 — `GET` 4필드·`loginId`/`passwordHash` 미노출 / `PATCH` nickname 한정·
  중복 409 `MEMBER_001`·검증 400 / `DELETE` 204·동의 누락 400·soft delete·세션 폐기. `[5]` 코드 번호 일치.
- **컨벤션**: `CLAUDE.md [5]`(Entity 도메인 메서드·`@Setter` 금지 / Service readOnly + 쓰기 오버라이드 ·
  `@ServiceLog` / Controller `ApiResponse`·try-catch 금지·204 예외 / DTO record + `from`) · `[4]` 의존 방향 ·
  `[7]` 스타일(커밋 전 `./gradlew spotlessApply` → checkstyle·spotlessCheck 통과, maxWarnings 0).
- **테스트 — 아래는 개별 명시해라(각각 실재 경로 + 통과 여부)**:
  1. `GET /me` 200 4필드 · **`loginId`/`passwordHash`가 응답에 없음을 단언**(SEC-007 회귀 방지)
  2. `PATCH /me` 200 · **자기 닉네임 그대로 → 409가 아니라 200**(위 [C]-2. **이거 빠지면 유닛이 틀린 채 그린이다**)
  3. `PATCH /me` 중복 → 409 `MEMBER_001` · **탈퇴자 닉네임으로 수정 → 200**(D-081 재가입 정합)
  4. `DELETE /me` 204 + `isDeleted=true`·`deletedAt` 기록
  5. `DELETE /me` 동의 누락/false → 400 · **잔액 0이어도 필드 필수**
  6. `DELETE /me` 후 **`revokeAll`로 해당 userId 세션이 전부 사라짐** — **Testcontainers Redis로 실제 검증해라.**
     mock으로 "호출됐다"만 단언하면 `SCAN` 패턴 오타를 못 잡는다(**B-024 선검사 함정과 같은 형태 —
     API 경유 테스트가 DB를 안 타서 초록불이었던 그 건**). 세션 2개를 만들고 둘 다 사라지는지 봐라.
  7. 전 엔드포인트 미인증 401(`COMMON_005`)
  - `@WebMvcTest` 슬라이스 템플릿은 **`MemberControllerTest`에 이미 있다**(SecurityConfig +
    `JwtAuthenticationEntryPoint`·`JwtAccessDeniedHandler` 임포트 + `GatewayInternalProperties(enforced=false)`
    실빈 + `@MockBean TokenProvider` + `.with(user("42"))`). **재사용해라.**
- **빌드**: `./gradlew build` 두 모듈 그린. **`clean build`가 QueryDSL 레이스·`build/` 점유로 실패하면
  증분 `build`로 완주하고 그 사실을 보고에 적어라**(꾸미지 마라).

## 주의 — 킥오프에 함정이 하나 있다 (아직 미승인 정정)

`docs/backend/references/claude-code-kickoff.md`:26 *"계약 임의 변경 금지**(6절)**"* — 이 `(6절)`은
**`CLAUDE.md` 6절(커밋 컨벤션)이 아니라 `rules [6]`(확정 스펙 변경 절차)**이다. 같은 파일이 :16·:25·:29에서
CLAUDE.md를 "N절"로 부르고 있어 오독되기 쉽다. **뜻은 "계약(`spec/`)을 네가 고치지 마라"다.**

반환

- `docs/backend/notes/cc-reports/034-member-3유닛-프로필-수정-탈퇴.md` 에 완료 보고를 파일로 쓴다.
- **보고에 반드시 명시할 것 4건**:
  1. **`MEMBER_002` 구조만 둔 방식**(총괄 072 의무) — 어떤 메서드가 항상 `false`인지, TODO가 어디 붙었는지
  2. **`revokeAll` 잔여 레이스**(B-018) — 커밋↔폐기 사이 창이 남는다는 것
  3. **nickname 검증 = signup과 동일**(최소길이·문자셋·공백 규칙 없음)
  4. **검증 방식의 한계**(`clean build` 완주 여부 · 6번 테스트를 실제 Redis로 했는지)
