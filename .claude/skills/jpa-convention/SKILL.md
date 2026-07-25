---
name: jpa-convention
description: backend-impl이 엔티티·리포지토리·서비스·컨트롤러·DTO·ErrorCode를 작성할 때 참조한다. CLAUDE.md 섹션 5 + notice 참조 구현 패턴.
---

# JPA·도메인 코드 컨벤션

정본: CLAUDE.md 섹션 5. 본보기: `backend/src/main/java/com/finalcall/**/notice/**`.

**물리 배치(feature-first, EPIC-RESTRUCTURE)**: 각 클래스는 `com.finalcall.domain.<feature>.<layer>`에 둔다 — Controller→`controller`, 표현 DTO→`dto`, Service·도메인 VO→`service`, Repository(+Custom/Impl)→`repository`, Entity·귀속 enum→`entity`, ErrorCode·`*Properties`→feature 루트. 공용 커널(`common`·`infra`)은 `domain` 그룹 밖 제자리. 분류표 = `docs/common/proposals/layer-restructure-proposal-v0.1.md`(내용 v0.3) §9. 이전이 끝나지 않은 기존 코드는 구 배치(`api/…`·`domain/…`)일 수 있다(전환 중, 한시적).

- **Entity**: BaseTimeEntity/BaseEntity 상속 · @NoArgsConstructor(PROTECTED) · 생성자 @Builder · @Setter 금지 → 도메인 메서드(update()/delete()) · soft delete(isDeleted).
- **Repository**: `findByIdOrThrow(id, ErrorCode)` default 패턴 · 커스텀 쿼리는 `<Entity>RepositoryCustom` + `<Entity>RepositoryImpl`(QueryDSL).
- **Service**: 클래스 레벨 @Transactional(readOnly=true), 쓰기만 @Transactional 오버라이드 · @ServiceLog · 검증은 Preconditions.validate(condition, ErrorCode).
- **Controller**: 반환 ApiResponse<T>(상태변경·무본문은 204 + void, 섹션 5 예외) · @Valid · try-catch 금지(전역 핸들러).
- **DTO**: record · Response는 @Builder + static from(Entity) · 네이밍 <도메인><목적>Request/Response(Dto 접미사 금지).
- **ErrorCode**: 공통 ErrorCode 구현 도메인 enum · 네이밍 {DOMAIN}_{3자리}.
- **마이그레이션**: Flyway `db/migration`, ddl-auto=validate.

착수 전 notice의 Entity/Repository/Service/Controller/DTO/ErrorCode/마이그레이션 한 벌을 읽고 그 형태를 따른다.
