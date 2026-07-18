-- item 도메인(FC-020): 마스터 계층 — item_template, skill_definition.
-- erd §4.3·§5 정합. append-only 원칙상 V5(money_exchange) 다음(V6)로 이어붙인다. V3~V5 스타일을 그대로 따른다.
-- 등급 축 없음(D-073) — 유니크는 (main_category, sub_group, element, kind) 조합 + type_code 단독.
-- soft delete 없음(마스터·불변 시드, spec §2.1·§2.2) → D-081 생성 컬럼 UK 패턴 불요.
-- public_id 없음 — item_template 외부 식별자는 type_code(035), skill_definition 은 skill_code.
CREATE TABLE item_template
(
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    main_category INT          NOT NULL,
    sub_group     INT          NOT NULL,
    element       INT          NOT NULL,
    kind          INT          NOT NULL,
    type_code     INT          NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_item_template_type_code (type_code),
    UNIQUE KEY uk_item_template_axes (main_category, sub_group, element, kind)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 속성·종류 부분 필터 검색(erd §5). 대분류·중분류와 조합. 카탈로그는 소규모라 나머지 축은 풀스캔 허용(G1).
CREATE INDEX ix_item_template_element_kind ON item_template (element, kind);

CREATE TABLE skill_definition
(
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    skill_code  INT          NOT NULL,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(255) NULL,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skill_definition_skill_code (skill_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
