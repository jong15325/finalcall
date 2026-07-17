상태: SENT
# [백엔드 → Claude Code] 작업 지시: member - 잔액 조회 API (GET /api/v1/me/balance)

대상: 계약 §4.4 `GET /api/v1/me/balance` 구현. 인증된 사용자의 자기 잔액 조회.

참조: api-contract §4.4(`/me/balance`)·§1.2(인증)·§1.4(응답 envelope), erd §4.1(user_balance),
  B-028(member 소유·라우팅), B-009(SecurityContext 사용자 식별), B-015(클래스 레벨 경로), notice 참조 구현

의존: **023(도메인 재배치)·030(V4 UK 재구성) 완료됨 — 착수 가능.**

주(v1.4·V4 이후 갱신): 아래 "하지 말 것"의 프로필·수정·탈퇴 금지 사유가 **계약 미확정 → 별도 단위**로 바뀌었다
  (계약 v1.4 [2.5]로 확정·해금, 072). 금지 자체는 유지 — 이 유닛은 잔액 조회만 한다.
  `UserRepository`는 030(B-030)에서 `domain/member`로 이동 완료. 파생 쿼리는 `...AndIsDeletedFalse` 형태다(D-081).

## 계약 (정본 인용, §4.4)
```
GET /api/v1/me/balance — 내 잔액
- 인증: 필요
- 응답 200: { cashBalance, gameMoneyBalance, gameMoneyHeld, gameMoneyAvailable }
```

## 범위
1. `api/member/MemberController` 신설 — 클래스 레벨 `@RequestMapping("/api/v1/me")`(B-015),
   메서드 `@GetMapping("/balance")`. 반환 `ApiResponse<MemberBalanceResponse>`(CLAUDE.md §5).
2. `api/member/MemberBalanceResponse` — Java `record` + `@Builder` + `static from(UserBalance)`(§5 DTO 규약).
   4필드 전부 계약 필드명 그대로. `gameMoneyAvailable`은 **파생값** — `UserBalance.getGameMoneyAvailable()`
   (= balance − held) 사용, 컬럼 신설 금지.
3. `domain/member/MemberService` 신설 — 클래스 레벨 `@Transactional(readOnly = true)`, `@ServiceLog` 부착.
   SecurityContext에서 사용자 식별(B-009) → 잔액 조회. 비즈니스 검증은 `Preconditions.validate(...)`.
4. **`MemberErrorCode`를 신설하지 않는다**(B-029). 잔액 행 부재는 `CommonErrorCode.INTERNAL_ERROR`
   (`COMMON_999`, 500)로 처리한다.
   - 근거: signup이 `user`와 `user_balance`를 1:1로 함께 생성하므로(V3 UK+FK) 잔액 행 부재는 비즈니스
     상태가 아니라 **깨진 불변식**이다. 404 도메인 에러로 두면 "잔액 없는 회원"이 정상 상태인 것처럼
     계약에 드러나는데 설계상 그런 상태는 없다.
   - `MEMBER_NNN` 채번 권한은 기획(계약 §5 정본)에 있고 069에서 확정 중이다. 이번 유닛은 `MEMBER_` 코드를
     일절 쓰지 않아 채번 충돌 표면이 없다. `MemberErrorCode`는 프로필·수정·탈퇴 유닛에서 계약 확정 번호로 신설.
5. `UserBalanceRepository`에 조회 메서드 추가(`findByUser` 또는 `findByUserId`). QueryDSL 불요(단순 조회).
6. 테스트: 서비스 단위 테스트 + 컨트롤러 슬라이스 테스트(`@WebMvcTest`). 인증 필요(401) 경로 포함.
   테스트 메서드명 한국어(B-023 suppress 적용됨).

## 하지 말 것
- member 프로필 조회·수정·탈퇴(`GET/PATCH/DELETE /api/v1/me`) — **별도 단위다**(조회=029, 수정·탈퇴=후속).
  계약 v1.4 [2.5]로 확정·해금됐으나 유닛이 분리돼 있다. 이 유닛은 `GET /me/balance` 하나만 구현한다.
  `MemberController`에 다른 핸들러를 미리 넣지 마라.
- 잔액 증감·홀드·차감 로직 구현. `UserBalance`의 증감 메서드는 시그니처 유지(원자적 갱신 D-008은 화폐 도메인).
- 충전·교환(`/charges`·`/exchanges`) — 화폐 도메인(교환비율 ON-HOLD).
- `money_hold` 테이블·엔티티 — `bid_id FK→bid` 의존이라 bid 도메인 소관(068 확정).
- Flyway 마이그레이션 추가(user_balance 는 V3에 이미 존재). 계약 변경(발견 시 백엔드 대화로 보고 → 6절 절차).

## 구현 지침
- CLAUDE.md §5 컨벤션 전면 준수. notice 참조 구현의 Controller/Service/DTO 형태를 본보기로.
- 사용자 식별은 SecurityContext(B-009) — `X-User-Id` 헤더 미도입(D-065).
- 타인 잔액 조회 불가(`/me` 고정). 경로에 사용자 식별자를 받지 않는다.
- `./gradlew spotlessApply` 후 checkstyle 통과(§7 의무).

## DoD
- 계약 §4.4 준수: 200 응답이 정확히 4필드, 필드명 일치, 인증 필수.
- CLAUDE.md §5 컨벤션 + §7 스타일 통과.
- 단위·슬라이스 테스트 그린, `./gradlew clean build` 성공.

## 커밋 제안 (실행은 사용자)
```
feat(member): 잔액 조회 API 추가 (GET /api/v1/me/balance)

목적
- 계약 §4.4 내 잔액 조회를 구현한다. 인증 사용자의 캐시·게임머니·홀드·가용 잔액을 반환.

세부 내용 (영역별)
- api: MemberController(/api/v1/me, B-015) + MemberBalanceResponse(record, from(UserBalance))
- domain: MemberService(readOnly 트랜잭션·@ServiceLog)
- domain: UserBalanceRepository 조회 메서드 추가
- 잔액 행 부재는 불변식 위반 → COMMON_999(500). MEMBER_ 코드 미사용(B-029)
- gameMoneyAvailable 은 balance − held 파생값(컬럼 미신설)

수정 파일
  변경(M): domain/member/UserBalanceRepository.java
  추가(A): api/member/MemberController.java, api/member/MemberBalanceResponse.java,
           domain/member/MemberService.java
           (테스트) MemberServiceTest.java, MemberControllerTest.java

검증
- 단위·슬라이스 테스트 그린, ./gradlew clean build 성공. 계약 §4.4 필드 4종 일치.

범위 밖(다음 단계)
- 프로필 조회(029)·수정·탈퇴(후속 유닛), 잔액 원자적 갱신·홀드(화폐·bid 도메인)
```
