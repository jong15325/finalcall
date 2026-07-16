# Flyway 마이그레이션

- 네이밍: `V{버전}__{설명}.sql` (언더스코어 2개가 구분자). 예: `V1__init_schema.sql`, `V2__add_notice_index.sql`
- 위치: `classpath:db/migration` (전 프로파일 활성화, 부팅 시 자동 적용).
- 부팅 순서: Flyway 가 스키마를 생성/변경 → JPA `ddl-auto: validate` 가 매핑과 일치하는지 검증.

## ★ 핵심 원칙
- **이미 적용된 마이그레이션은 절대 수정하지 않는다.** 변경은 항상 새 버전(V2, V3...)으로 추가한다.
- 적용된 스크립트를 고치면 체크섬 불일치로 부팅이 실패한다(의도된 안전장치).
- 적용 이력은 `flyway_schema_history` 테이블에 기록된다.
