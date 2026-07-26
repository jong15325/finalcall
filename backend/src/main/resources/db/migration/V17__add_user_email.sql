-- EPIC-EMAIL-VERIFY(FC-117): user 테이블 이메일 인증용 컬럼 3종 추가(email-verify-spec §2.1·§2.2).
-- append-only 채번 규율(FC-035 m9): V16 다음(V17)으로 이어붙인다. 기존 V1~V16 무편집 → 체크섬 무간섭.
-- 컬럼: email(정규화 저장 lowercase+trim, 미설정이면 NULL) · email_verified(인증 플래그, 항상 0 초기화)
--       · email_active(생성 컬럼, 활성 회원 유니크 강제용 — V4 login_id_active/nickname_active 패턴 동형).
-- soft delete 정합(D-081): 원본 email 엔 UK 를 걸지 않고 생성 컬럼 email_active(IF(is_deleted, NULL, email))에만 UK.
--   활성 & 이메일 설정 회원 사이에서만 유일성 강제 — NULL(미설정·탈퇴행)은 MySQL 유니크에서 제외되어 무제한 공존.
-- 기존 행 backfill: email=NULL·email_verified=0(이메일 없음·미인증). email nullable → 충돌 없음.
-- 제약명 uk_user_email_active: AuthService.toDuplicateException 이 제약명으로 위반 UK 를 EMAIL_007 로 분기(spec §2.2).
ALTER TABLE user
    ADD COLUMN email          VARCHAR(255) NULL             AFTER nickname,
    ADD COLUMN email_verified BIT          NOT NULL DEFAULT 0 AFTER email,
    ADD COLUMN email_active   VARCHAR(255) GENERATED ALWAYS AS (IF(is_deleted, NULL, email)) STORED AFTER email_verified;

ALTER TABLE user
    ADD UNIQUE KEY uk_user_email_active (email_active);
