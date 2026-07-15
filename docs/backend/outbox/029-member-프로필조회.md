상태: SENT
# [백엔드 → Claude Code] 작업 지시: member - 프로필 조회 (GET /api/v1/me)

대상: 계약 **v1.4 §2.5** `GET /api/v1/me` 구현. 인증된 사용자의 자기 프로필 조회.

참조: api-contract v1.4 §2.5(정본 인용 아래)·§1.2(인증)·§1.4(envelope), domain-spec v0.5 §6.1(회원 계정 관리),
  erd §4.1(user), B-028(member 소유)·B-009(SecurityContext)·B-015(클래스 레벨 경로), notice 참조 구현

의존: **023(재배치) → 024(잔액 조회) 선행 완료 후.** `api/member/MemberController`·`domain/member/MemberService`가
  024에서 생성되므로 그 위에 메서드를 추가하는 형태다. 024 미완이면 대기.

## 계약 정본 (v1.4 §2.5 인용)
```
GET /api/v1/me — 내 프로필 조회
- 인증: 필요
- 응답 200: { userPublicId, nickname, isAdmin, createdAt }
- 노출 범위: loginId·passwordHash 는 응답에 싣지 않는다(노출 이득 없음, 열거 리스크 SEC-007).
  isAdmin 은 관리자 UI 노출 제어용으로 포함하되 인가는 서버 권위다(§1.2 — 클라 플래그는 표시 제어일 뿐).
- 타인 프로필 조회(/users/{publicId})는 범위 밖이다.
- 에러: 401(미인증)
```

## 범위
1. `MemberController`에 `@GetMapping` 추가(클래스 레벨 `/api/v1/me`, 메서드 경로 없음 → `GET /api/v1/me`).
   반환 `ApiResponse<MemberProfileResponse>`.
2. `api/member/MemberProfileResponse` 신설 — Java `record` + `@Builder` + `static from(User)`(§5 DTO 규약).
   **정확히 4필드**: `userPublicId`, `nickname`, `isAdmin`, `createdAt`.
   - `userPublicId` ← `User.publicId`(ULID). **내부 `id` 노출 금지**(B-004).
   - `createdAt` ← `BaseTimeEntity.createdAt`(Instant, ISO-8601 UTC 직렬화).
   - **`loginId`·`passwordHash`를 절대 포함하지 않는다**(SEC-007). 테스트로 부재를 검증할 것.
3. `MemberService`에 프로필 조회 메서드 추가 — `@Transactional(readOnly = true)` 상속, SecurityContext로
   사용자 식별(B-009).
4. 테스트: 서비스 단위 + 컨트롤러 슬라이스(`@WebMvcTest`).
   **필수 케이스**: (a) 200 응답 4필드 정확 일치, (b) **응답 본문에 `loginId`·`passwordHash` 부재 검증**
   (QA 시나리오 대상 — 072), (c) 미인증 401.

## 하지 말 것
- `PATCH /me`(수정)·`DELETE /me`(탈퇴) — **결정 요청 028(재가입 UK 구현 공백) 회신 전 착수 금지**.
  둘 다 중복 검사 경로(`existsByNickname`)를 공유해 선행 수정에 걸린다.
- 타인 프로필 조회(`/users/{publicId}`) — 계약 범위 밖(SEC-007·§3.3 마스킹 상충).
- `isAdmin` 기반 인가 로직 추가 — 응답 필드로만 싣는다. 인가는 서버 권위(§1.2), 이번 범위 아님.
- `User` 엔티티 필드·V3 스키마 변경. Flyway 마이그레이션 추가.
- 계약 변경(발견 시 백엔드 대화 보고 → 6절 절차).

## 구현 지침
- CLAUDE.md §5 컨벤션 준수. notice 참조 구현의 Controller/DTO 형태를 본보기로.
- `/me` 고정 — 경로에 사용자 식별자를 받지 않는다.
- `./gradlew spotlessApply` 후 checkstyle 통과(§7 의무).

## DoD
- 계약 v1.4 §2.5 준수: 200 응답이 정확히 4필드, 필드명 일치, 인증 필수, `loginId`·`passwordHash` 부재.
- CLAUDE.md §5 + §7 통과. 단위·슬라이스 테스트 그린, `./gradlew clean build` 성공.

## 커밋 제안 (실행은 사용자)
```
feat(member): 프로필 조회 API 추가 (GET /api/v1/me)

목적
- 계약 v1.4 §2.5 내 프로필 조회를 구현한다. 인증 사용자의 공개 식별자·표시명·권한 플래그·가입 시각 반환.

세부 내용 (영역별)
- api: MemberController 에 GET 핸들러 + MemberProfileResponse(record, from(User))
- domain: MemberService 프로필 조회 메서드(readOnly)
- 노출 범위: loginId·passwordHash 미포함(SEC-007), userPublicId 는 ULID(내부 id 미노출)

수정 파일
  변경(M): api/member/MemberController.java, domain/member/MemberService.java
  추가(A): api/member/MemberProfileResponse.java
           (테스트) MemberControllerTest·MemberServiceTest 케이스 추가

검증
- 단위·슬라이스 테스트 그린, ./gradlew clean build 성공.
- 응답 4필드 일치 + loginId·passwordHash 부재 검증 케이스 포함.

범위 밖(다음 단계)
- PATCH /me·DELETE /me(재가입 UK 선행 028 회신 대기), 타인 프로필 조회(계약 범위 밖)
```
