# 도시에: 회원 도메인 (EPIC-MEMBER — 인증·프로필·탈퇴)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> 코드·계약·erd·보드·리뷰에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·테스트)로 뒷받침한다.

- **영역/에픽**: EPIC-MEMBER (회원 프로필 조회·수정·탈퇴, 계약 §2.5)
- **상태**: 완료 · 게이트3 승인 · 원격 push됨
- **기간(커밋 기준)**: `4f0b1a1`(MemberErrorCode·세션 폐기) ~ `cc078e2`(프로필 3종) ~ `ae813fc`(FC-006 위생)
- **관련 티켓**: FC-001(architect)·FC-002·FC-003·FC-004(backend-impl)·FC-005(reviewer)·FC-006(파생 위생)

> **주의(범위 명확화)**: 잔액 데이터(`user_balance`)는 회원과 1:1로 함께 생성되지만, **잔액의 원자적
> 증감·캐시↔게임머니 교환은 화폐 도메인(EPIC-CURRENCY)의 몫이며 이후 완료됐다. 이 도시에는
> 회원 계정 생애주기(프로필·수정·탈퇴)만 완료로 다룬다.

## 1. 개요 (한 문단)

회원 도메인은 계정 생애주기 중 **가입·인증 이후의 나머지** — 내 프로필 조회, 닉네임 수정, 탈퇴 —
를 담당한다(`GET/PATCH/DELETE /me`). 표면은 단순 CRUD처럼 보이지만, 실제 난도는 **보안·정합성**에
있다: 탈퇴(soft delete)한 계정이 만료 전 토큰으로 접근할 때 회원 존재 여부가 새어나가지 않아야 하고
(열거 방지), 탈퇴 시 흩어진 refresh 세션이 전부 폐기되어야 하며, 재가입 시 옛 아이디·닉네임을 다시
쓸 수 있어야 한다. 이 도메인은 오케스트레이션 체계(architect→backend-impl→reviewer)로 완주한
첫 실제 도메인이며, 이후 도메인이 따를 보안·soft delete 패턴의 본보기가 됐다.

## 2. 해결한 기술 도전과 해법

- **회원 열거 방지(SEC-007)**: 탈퇴한 주체가 유효 access로 `/me`를 호출하면, 미인증·만료 토큰과
  **동일한 401 `COMMON_005`·동일 포맷**으로 응답한다 → "탈퇴됨/없음/만료됨"을 응답으로 구별할 수 없어
  회원 존재가 새지 않는다(`MemberService.currentActiveUser()` — 활성 행 부재 시 UNAUTHORIZED).

- **탈퇴 시 refresh 세션 일괄 폐기(SEC-006)와 순서 제약**: `RefreshTokenStore.revokeAll(userId)`이
  `auth:refresh:{userId}:*` 네임스페이스를 SCAN(논블로킹 커서)으로 훑어 단일 `DEL`(원자)로 폐기 →
  SCAN은 스냅숏이 아니므로, 탈퇴 서비스는 **① `user.delete()`로 신규 세션 발급을 먼저 차단**한 뒤
  **② `revokeAll` 호출** 순서를 지킨다. 단일 트랜잭션이라 최종 정합은 커밋 원자성으로 보장되고, 커밋
  직전 좁은 경쟁창은 access 단명(≤30분)·refresh 폐기로 위험이 낮음을 문서화(게이트2 ③ 결정).

- **soft delete 자연키 재사용(D-081)**: 재가입 시 옛 `login_id`·`nickname`을 다시 쓰려면 원본 컬럼에
  UK를 걸 수 없다 → 활성 값만 담는 생성 컬럼(`login_id_active`/`nickname_active` =
  `IF(is_deleted, NULL, 자연키)`)에만 UK를 부여. 탈퇴행은 NULL이 되어 MySQL 다중 NULL 허용으로 재탈퇴·
  재가입이 무제한 가능(`V4__user_natural_key_uk.sql`). 조회는 항상 `...AndIsDeletedFalse` 활성 필터 동반.

- **닉네임 중복 경쟁의 이중 방어**: `existsByNicknameAndIsDeletedFalse` 선검사 + UK 제약 안전망. 선검사를
  통과한 동시 중복은 커밋 전 강제 `flush()`로 `uk_user_nickname_active` 위반을 이 계층에서 잡아
  `MEMBER_001`(409)로 매핑 → 전역 핸들러가 500으로 처리하는 것을 방지(게이트2 ② 결정, signup 패턴 준용).

- **탈퇴 잔액 소멸 명시 동의(D-080)**: `DELETE /me`는 `balanceForfeitAcknowledged: true` 필수 —
  잔액이 0이어도 필드를 요구해 클라 분기를 제거하고 감사 추적을 일관되게 함. 잔액 잔존은 차단 사유가
  아니지만(본인 손실, 동의로 해소), **진행 중 거래는 차단**(거래 상대 피해 — 피해 귀속의 비대칭).

## 3. 핵심 결정과 근거 (트레이드오프)

- **주체 = SecurityContext, 경로에 사용자 식별자 없음**: `/me`만 두고 `/users/{id}`(타인 프로필)를 두지
  않는다 → IDOR 여지 자체를 제거하고, 목록·상세의 소유자·최고입찰자 마스킹 정책과의 상충을 회피.
  JWT가 적재한 userId만 신뢰하고 `X-User-Id` 헤더는 신뢰하지 않음(D-065). (근거: 계약 §2.5, domain-spec §6.1)

- **잔액 잔존 ≠ 탈퇴 차단, 진행 중 거래 = 차단**: 정책이 갈리는 근거는 **피해 귀속의 비대칭**이다.
  잔액 소멸은 본인 손실이라 동의로 해소되지만, 진행 중 거래를 일방 탈퇴로 깨면 거래 상대가 피해를 입는다.
  동의로 처분 가능한 것은 자기 몫뿐. (근거: domain-spec §6.1, D-080)

- **MEMBER_002 = (A) 확장 지점**: 탈퇴 차단은 현재 `gameMoneyHeld > 0`(홀드 보유)만 검사하고, 진행 중
  경매(판매자)·미완료 주문 체크는 해당 도메인(auction/bid/order) 착수 시 확장하도록 코드에 TODO로 명시.
  계약을 더 좁게(관대하게) 이행할 뿐 모순 없음(auction/bid/order 부재로 false-allow 여지 없음). (근거: 게이트1 승인, FC-001 검증)

- **refresh는 서버 저장·회전(SEC-006, 스켈레톤 F1 계승)**: opaque 난수(≥256bit)의 SHA-256 해시만 저장,
  재발급 시 회전(1회성), 옛 토큰 재사용 탐지 시 세션 무효화. 회전은 Lua CAS(단일 EVAL)로 원자 처리해
  동시 회전 시 두 번째를 REUSE로 차단(`RefreshTokenStore.rotate()`). 무상태 JWT 대비 저장 비용을
  치르는 대신 즉시 폐기·재사용 탐지를 얻음.

- **닉네임 변경 빈도 무제한**: 표시명은 목록·상세에서 마스킹되어 사칭·평판 세탁 리스크가 낮고, 빈도
  제한은 변경 시각 보존(스키마 추가)을 요구해 이번 범위 대비 이득이 작다. 필요 관측 시 후속 확장. (근거: domain-spec §6.1)

## 4. 아키텍처

```
api/member/                         domain/member/                infra/security/
  MemberController                    MemberService                 RefreshTokenStore (Redis)
   · GET  /me   → getMyProfile        · @Transactional(readOnly)     · revokeAll(userId): SCAN + 단일 DEL
   · PATCH /me  → updateNickname      · updateNickname: 선검사+flush   · rotate(): Lua CAS 원자 회전
   · DELETE /me → withdraw (204)      · withdraw: delete→revokeAll     · SHA-256 해시만 저장
  MemberProfileResponse                · currentActiveUser: 401 열거방지
  MemberProfileUpdateRequest         domain/member/User (soft delete, changeNickname/delete)
  MemberWithdrawRequest              domain/member/UserBalance (1:1, 잔액 증감은 화폐 도메인)
  (MemberBalanceResponse: §4.4)      MemberErrorCode(MEMBER_001/002)

DB: V3(user·user_balance) → V4(login_id_active/nickname_active 생성 컬럼 UK, D-081)
인증 주체: JWT subject=userId → SecurityContext (X-User-Id 미신뢰, D-065)
```

## 5. 증거

- **엔드포인트/기능**: 계약 §2.5 — `GET /api/v1/me`(200 `{userPublicId,nickname,isAdmin,createdAt}`) ·
  `PATCH /api/v1/me`(nickname, 중복 시 MEMBER_001/409) · `DELETE /api/v1/me`(204, soft delete + 세션 폐기).
  탈퇴 주체 만료 전 호출 → 401 COMMON_005(§2.5 v1.5 게이트2 정정).
- **핵심 파일**:
  - `backend/src/main/java/com/finalcall/domain/member/MemberService.java` — 프로필·수정·탈퇴 로직, 열거 방지·폐기 순서
  - `backend/src/main/java/com/finalcall/domain/member/MemberErrorCode.java` — MEMBER_001(중복)·MEMBER_002(탈퇴 차단)
  - `backend/src/main/java/com/finalcall/domain/member/User.java` — soft delete·changeNickname·delete
  - `backend/src/main/java/com/finalcall/api/member/MemberController.java` + `MemberProfileResponse`·`MemberProfileUpdateRequest`·`MemberWithdrawRequest`
  - `backend/src/main/java/com/finalcall/infra/security/RefreshTokenStore.java` — revokeAll(SEC-006)·rotate(CAS)·재사용 탐지
  - `backend/src/main/resources/db/migration/V4__user_natural_key_uk.sql` — D-081 생성 컬럼 UK
- **테스트**:
  - `backend/src/test/java/com/finalcall/integration/RefreshTokenStoreIntegrationTest.java` — 세션 발급·폐기·일괄 폐기(revokeAll)
  - `backend/src/test/java/com/finalcall/integration/ReSignupIntegrationTest.java` — 재가입 자연키 재사용(D-081)
  - `backend/src/test/java/com/finalcall/domain/member/MemberServiceTest.java` · `api/member/MemberControllerTest.java` — 프로필/수정/탈퇴
  - `backend/src/test/java/com/finalcall/domain/member/UserRepositorySliceTest.java` — 활성 필터 조회
- **리뷰**: `docs/board/reviews/FC-005-review.md` — review_status **passed** (critical 0 · major 0 · minor 3).
  확인 정합: IDOR/인가·mass-assignment 차단·폐기 순서·재가입 UK·탈퇴 동의·열거 방지(401 COMMON_005).
- **커밋**:
  - `4f0b1a1` feat(member): MemberErrorCode + RefreshTokenStore 사용자 세션 일괄 폐기
  - `cc078e2` feat(member): 프로필 3종 GET/PATCH/DELETE /me + 게이트2 보정 (FC-004)
  - `1fbaceb` docs(contract): v1.5 — 탈퇴 주체 401 COMMON_005 명세 (게이트2)
  - `1fac4cc` chore(board): EPIC-MEMBER 완료(게이트3 승인) + FC-006 위생 티켓 등록
  - `ae813fc` fix(member): User.java 원본 컬럼 unique=true 제거 — D-081 정합 (FC-006)
