-- EPIC-OAUTH(FC-153): 소셜 로그인(방식 B) 계정 모델 — user_social_account 신설 + user 자연키 컬럼 nullable화.
-- append-only 채번 규율(FC-035 m9): V18 다음(V19)으로 이어붙인다. 기존 V1~V18 무편집 → 체크섬 무간섭.
-- 정본 = erd v1.5 §4.1·§5·§6(group1 1-b), api-contract §2 소셜 로그인.

-- 1) user_social_account — 소셜 신원 연결(erd §4.1). 신원 키 = (provider, provider_user_id), 이메일은 신원 아님(결정 2).
--    한 user 가 provider 별 소셜 신원을 갖는다(user_id FK, ManyToOne). public_id 없음(외부 미노출 내부 연결 테이블).
--    updated_at 없음 — 생성 후 갱신 생애주기가 없는 불변 연결 행(erd "갱신 대상만 updated_at", platform_revenue_ledger 선례).
CREATE TABLE user_social_account
(
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    user_id          BIGINT       NOT NULL,
    provider         VARCHAR(20)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- (provider, provider_user_id) 복합 UK: 하나의 소셜 신원이 정확히 한 user 에 매핑(find-or-create 앵커·중복가입 차단, erd §5).
    UNIQUE KEY uk_user_social_account_provider_puid (provider, provider_user_id),
    -- user_id FK 인덱스: 한 user 의 연결 목록 역참조.
    KEY idx_user_social_account_user_id (user_id),
    CONSTRAINT fk_user_social_account_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 2) user.login_id·password_hash NOT NULL 해제(erd §4.1, EPIC-OAUTH v1.5).
--    소셜 전용 계정은 loginId·비밀번호가 없다(신원 = user_social_account). 원본 컬럼 nullable화만 — 생성 컬럼
--    login_id_active(IF(is_deleted, NULL, login_id))·UK 는 그대로다(NULL 은 활성 UK 에서 제외되므로 재정의 불요).
ALTER TABLE user
    MODIFY COLUMN login_id      VARCHAR(50)  NULL,
    MODIFY COLUMN password_hash VARCHAR(100) NULL;
