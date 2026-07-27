-- EPIC-EMAIL-TEMPLATE(FC-133): 재사용 메일 템플릿 저장소 email_template + 인증 코드 템플릿 시드(email-template-spec §3·§3.1).
-- append-only 채번 규율(FC-035 m9): V17 다음(V18)으로 이어붙인다. 기존 V1~V17 무편집 → 체크섬 무간섭.
-- email_template 은 개발자 시드 마스터/설정 테이블이다(사용자 생성 행 아님) — V6 item_template 선례를 따른다.
--   soft delete 없음 · D-081 생성 컬럼 UK 패턴 불요. 삭제 대신 is_active 플래그로 비활성화한다.
--   자연키 template_key(= EmailTemplateKey enum name)에 직접 UK(uk_email_template_key) — 마스터라 활성 유니크 불필요.
-- 보안 경계(spec §6): body 엔 {{code}}·{{expiryMinutes}} placeholder 만 저장한다. 실제 인증 코드는 절대 영속되지 않는다
--   (요청 시점 런타임 주입 · Redis 엔 SHA-256 해시로만 잔류). content_type 은 TEXT|HTML(MailContentType) — 인증 메일은 TEXT.
CREATE TABLE email_template
(
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    template_key VARCHAR(50)  NOT NULL,                -- 자연키 = EmailTemplateKey enum name
    subject      VARCHAR(255) NOT NULL,                -- 제목(placeholder 포함 가능)
    body         TEXT         NOT NULL,                -- 본문(placeholder 포함). TEXT = 장문 안내 대비
    content_type VARCHAR(10)  NOT NULL DEFAULT 'TEXT', -- TEXT | HTML (MailContentType)
    description  VARCHAR(500) NULL,                    -- 사람용 설명(용도·변수 목록 메모, 비-계약)
    is_active    BIT          NOT NULL DEFAULT 1,      -- 비활성화용. 삭제 대신 플래그
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_email_template_key (template_key)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 초기 시드(spec §3.1): EMAIL-VERIFY 첫 소비 템플릿. 개행은 실제 개행(텍스트 본문 렌더 정합). 코드 자리는 placeholder 만.
INSERT INTO email_template (template_key, subject, body, content_type, description, is_active, created_at, updated_at)
VALUES ('EMAIL_VERIFICATION',
        '[장터] 이메일 인증 코드',
        '장터 이메일 인증 코드입니다.

인증 코드: {{code}}

위 코드를 {{expiryMinutes}}분 안에 입력해 주세요. 시간이 지나면 코드를 다시 요청해야 합니다.
본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
        'TEXT', '회원가입 이메일 인증 코드. 변수: code, expiryMinutes', 1, NOW(6), NOW(6));
