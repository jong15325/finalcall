상태: SENT (Claude Code 대상, 총괄 검토 후 착수)
# [백엔드 → Claude Code] 작업 지시: auth - 도메인 기반(엔티티·리포지토리·에러코드·마이그레이션)

대상: auth 도메인 기반 — User·UserBalance 엔티티, UserRepository, AuthErrorCode, Flyway V1 정합. (구현 순서 1/A, 선행 루트)
참조: api-contract §2, erd.md §4(user line141~, user_balance line153~, V1 매핑 line360), CLAUDE.md §5, B-001~004·B-009~010, D-002.
범위(포함):
- domain/auth: `User` 엔티티 — id BIGINT PK(B-002), public_id ULID UK(B-004), login_id UK, password_hash, nickname UK, is_admin(기본 false), soft delete(is_deleted/deleted_at, B-003). BaseTimeEntity 상속.
- `UserBalance` 엔티티 — user_id 1:1 FK→user, cash_balance/game_money_balance/game_money_held(BIGINT, 0 초기화). 잔액 증감 도메인 메서드 시그니처만(실제 원자성·홀드 로직은 화폐 도메인 후속).
- `UserRepository` — existsByLoginId, existsByNickname, findByLoginId(Optional), findByIdOrThrow(id, ErrorCode) default.
- `AuthErrorCode`(ErrorCode 구현 enum) — AUTH_001 중복 loginId(409), AUTH_002 중복 nickname(409), AUTH_003 자격 불일치(401), AUTH_004 refresh 만료·무효(401).
- Flyway `V1__user_and_money.sql`의 user·user_balance DDL 정합 확인/작성 — ULID는 CHAR(26), snake_case, DATETIME(6), login_id/nickname/public_id 유니크 인덱스.
하지 말 것: signup/login 등 서비스·컨트롤러 로직(후속 단위), 화폐 충전·홀드·정산 로직, user 프로필 조회 API, charge/money_exchange/money_hold 엔티티(V1엔 있으나 auth 범위 밖).
구현 지침: CLAUDE.md §5 — Entity(@NoArgsConstructor(PROTECTED)·@Builder 생성자·@Setter 금지·도메인 메서드·soft delete), Repository(findByIdOrThrow default), ErrorCode 도메인 enum({DOMAIN}_{3자리}). ULID 생성 유틸은 common/util에 배치.
DoD: erd·계약 정합 + CLAUDE.md 컨벤션 + 슬라이스 테스트(@DataJpaTest: 유니크·조회) + 빌드 성공.
커밋 제안: feat(auth): auth 도메인 기반 엔티티·리포지토리·에러코드
