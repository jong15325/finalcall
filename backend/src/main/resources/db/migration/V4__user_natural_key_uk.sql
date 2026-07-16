-- member 도메인: user 자연키 UK를 soft delete 정합 패턴으로 재구성(D-081).
-- 배경: V3가 UNIQUE(login_id)·UNIQUE(nickname)으로 걸어 erd [1] 규약("soft delete 자연키 UK는
--       삭제 식별 컬럼을 포함")을 위반 → 계약 [2.5] 재가입(login_id·nickname 재사용) 미동작.
-- 해법: 생성 컬럼(login_id_active/nickname_active = IF(is_deleted, NULL, 자연키))에만 UK를 건다.
--       활성 행만 값을 가져 활성 유일성 보존, 탈퇴행은 NULL → MySQL 다중 NULL 허용으로 재탈퇴 무제한.
-- 주의: 생성 컬럼·문법은 MySQL 8.0 기준. 원본 login_id·nickname 컬럼은 그대로 둔다(UK만 이전).
--       public_id(ULID 대리키)는 재사용되지 않아 삭제행 충돌이 구조적으로 없으므로 이 패턴을 적용하지 않는다(D-081 과적용 배제).

-- 1) 기존 단일 컬럼 UK 제거
ALTER TABLE user DROP INDEX uk_user_login_id;
ALTER TABLE user DROP INDEX uk_user_nickname;

-- 2) 활성 값만 담는 생성 컬럼 추가(타입·길이는 원본과 일치 — login_id VARCHAR(50), nickname VARCHAR(30))
ALTER TABLE user
    ADD COLUMN login_id_active VARCHAR(50) GENERATED ALWAYS AS (IF(is_deleted, NULL, login_id)) STORED,
    ADD COLUMN nickname_active VARCHAR(30) GENERATED ALWAYS AS (IF(is_deleted, NULL, nickname)) STORED;

-- 3) 생성 컬럼에 UK — 활성 행만 유일성 강제, 탈퇴행(NULL)은 제외
ALTER TABLE user
    ADD UNIQUE KEY uk_user_login_id_active (login_id_active),
    ADD UNIQUE KEY uk_user_nickname_active (nickname_active);
