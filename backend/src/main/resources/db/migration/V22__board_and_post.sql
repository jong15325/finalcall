-- EPIC-BOARD(FC-197): 커스텀 게시판 시스템 — board·post·comment·post_image 4테이블 일괄 생성 + 인덱스 5종 + board 시드 3건.
-- append-only 채번 규율(FC-035 m9): V21 다음(V22)으로 이어붙인다. 기존 V1~V21 무편집 → 체크섬 무간섭.
-- 정본 = board-domain-spec v1.0 §2·§9 · erd v1.8 §4.5·§5·§6(group 7-a) · api-contract §6.
--
-- 이 티켓(FC-197)은 스키마 DDL 전부 + Board 도메인 코드만 소유한다. post·comment·post_image 의 엔티티·서비스·API 는
--   후속 티켓(FC-198·199·200)이 담당한다 — 스키마를 지금 전부 심어 후속 마이그레이션 채번 충돌을 피한다.
--   JPA_DDL_AUTO=validate 는 매핑된 엔티티만 검증하므로 엔티티 없는 테이블(post·comment·post_image)이 먼저 있어도 무해하다.
--
-- FK 선행·순서: board → post(board_id FK) → comment(post_id FK)·post_image(post_id FK). user(V3, author_id·uploader_id FK) 선행.
-- 이미지 파일 실체는 오브젝트 스토리지(MinIO 로컬·S3 운영) — DB 밖. 이 표는 메타·object key(storage_key)만 보유(게이트2 (a)).

-- 게시판 레지스트리. slug=URL 키·외부 식별자(사람이 읽는 well-known 키, public_id 미부여 — category 성격).
--   soft delete 미도입(is_active 토글로 "삭제") → slug 재사용 충돌 없음 → D-081 자연키 UK 패턴 불요(원본 slug UK 로 충분).
CREATE TABLE board
(
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    slug           VARCHAR(50)  NOT NULL,
    name           VARCHAR(50)  NOT NULL,
    description    VARCHAR(200) NULL,
    sort_order     INT          NOT NULL,
    is_active      BIT          NOT NULL,
    write_policy   VARCHAR(20)  NOT NULL,
    allow_comments BIT          NOT NULL,
    board_type     VARCHAR(20)  NOT NULL,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- 불변 자연키(^[a-z0-9-]{2,50}$). 비활성 토글 삭제라 원본 UK 로 충분(D-081 불요).
    UNIQUE KEY uk_board_slug (slug)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 게시글. board 귀속·작성자 귀속·soft delete. 조회수/댓글수 비정규화·상단 고정. 기존 notice 를 흡수(V23 이관, FC-201).
CREATE TABLE post
(
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    public_id       CHAR(26)     NOT NULL,
    board_id        BIGINT       NOT NULL,
    author_id       BIGINT       NULL,
    author_nickname VARCHAR(30)  NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT         NOT NULL,
    view_count      INT          NOT NULL,
    comment_count   INT          NOT NULL,
    is_pinned       BIT          NOT NULL,
    is_deleted      BIT          NOT NULL,
    deleted_at      DATETIME(6)  NULL,
    created_at      DATETIME(6)  NOT NULL,
    updated_at      DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- 외부 노출 식별자(B-004). 상세·수정·삭제 경로 리소스. 대리키라 D-081 불요.
    UNIQUE KEY uk_post_public_id (public_id),
    -- 게시판별 글 목록 커서 조회(board_id=? AND is_deleted=false, 정렬 is_pinned DESC·id DESC — 고정 우선·최신순, erd §5).
    --   fk_post_board 의 FK 인덱스도 이 복합이 선두 컬럼(board_id)으로 겸한다.
    KEY ix_post_board_list (board_id, is_deleted, is_pinned, id),
    -- 작성자 글 역참조(내 글·인가 검증). fk_post_author 의 FK 인덱스도 겸한다.
    KEY ix_post_author (author_id),
    CONSTRAINT fk_post_board FOREIGN KEY (board_id) REFERENCES board (id),
    -- author_id nullable — 흡수 공지·시스템 글은 NULL(memo sender_id 선례). 웹 작성은 항상 값(인가 주체).
    CONSTRAINT fk_post_author FOREIGN KEY (author_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 게시글 댓글. post 귀속·작성자 귀속·soft delete. parent_comment_id 는 대댓글 앵커(이번 에픽 컬럼만 예약·평면 서빙).
CREATE TABLE comment
(
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    public_id         CHAR(26)      NOT NULL,
    post_id           BIGINT        NOT NULL,
    author_id         BIGINT        NULL,
    author_nickname   VARCHAR(30)   NOT NULL,
    content           VARCHAR(1000) NOT NULL,
    parent_comment_id BIGINT        NULL,
    is_deleted        BIT           NOT NULL,
    deleted_at        DATETIME(6)   NULL,
    created_at        DATETIME(6)   NOT NULL,
    updated_at        DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    -- 외부 노출 식별자. 수정·삭제 경로 리소스. 대리키라 D-081 불요.
    UNIQUE KEY uk_comment_public_id (public_id),
    -- 게시글 댓글 목록(post_id=? AND is_deleted=false, id asc 시간순) + comment_count 정합(erd §5).
    --   fk_comment_post 의 FK 인덱스도 이 복합이 선두 컬럼(post_id)으로 겸한다.
    KEY ix_comment_post_list (post_id, is_deleted, id),
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES post (id),
    -- author_id nullable — 시스템 댓글 대비(웹 작성 항상 값·인가 주체). 겸하는 인덱스 없어 MySQL 이 FK 인덱스 자동 생성.
    CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES user (id),
    -- self-FK: 대댓글 앵커(nullable). 겸하는 인덱스 없어 MySQL 이 FK 인덱스 자동 생성(reply UI 다음 에픽).
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES comment (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 게시글 이미지 첨부. 2단계 업로드(업로드=고아 post_id NULL → 게시글 저장 시 바인딩). 파일 실체는 오브젝트 스토리지(게이트2 (a)),
--   이 표는 메타·object key(storage_key)만 보유. append 원장(created_at 만 — updated_at 미도입, item_ownership_history 선례).
--   soft delete 없음(게시글 삭제 시 함께 정리·고아는 sweeper).
CREATE TABLE post_image
(
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    public_id         CHAR(26)     NOT NULL,
    post_id           BIGINT       NULL,
    uploader_id       BIGINT       NOT NULL,
    storage_key       VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NULL,
    content_type      VARCHAR(100) NOT NULL,
    file_size         BIGINT       NOT NULL,
    sort_order        INT          NOT NULL,
    created_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- 외부 노출 식별자·raw 서빙 경로 키. 대리키라 D-081 불요.
    UNIQUE KEY uk_post_image_public_id (public_id),
    -- 게시글 이미지 갤러리 순서 조회(erd §5). fk_post_image_post 의 FK 인덱스도 선두 컬럼(post_id)으로 겸한다.
    KEY ix_post_image_post (post_id, sort_order),
    -- 고아 이미지 정리 sweeper(바인딩 안 된 오래된 업로드) + 내 업로드 조회(erd §5). fk_post_image_uploader 의 FK 인덱스도 겸한다.
    KEY ix_post_image_uploader (uploader_id, created_at),
    -- post_id nullable — 업로드 시점 NULL(고아), 게시글 저장 시 바인딩(재귀속 금지).
    CONSTRAINT fk_post_image_post FOREIGN KEY (post_id) REFERENCES post (id),
    -- 업로더. 고아 정리·바인딩 인가(업로더==작성자만 귀속).
    CONSTRAINT fk_post_image_uploader FOREIGN KEY (uploader_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- board 시드 3건(board-spec §9 · erd §4.5). slug·유형·정책 형상은 스펙 정본 준수.
--   notice(공지사항·NOTICE·ADMIN_ONLY·댓글off·sort 0) — 공지 흡수 대상(V23 이관, FC-201).
--   community(커뮤니티·GENERAL·AUTHENTICATED·댓글on·sort 1) — 회원 자유 게시판.
--   event(이벤트·EVENT·ADMIN_ONLY·댓글on·sort 2) — 관리자 작성·회원 댓글.
INSERT INTO board (slug, name, description, sort_order, is_active, write_policy, allow_comments, board_type,
                   created_at, updated_at)
VALUES ('notice', '공지사항', '서비스 운영 공지', 0, TRUE, 'ADMIN_ONLY', FALSE, 'NOTICE', NOW(6), NOW(6)),
       ('community', '커뮤니티', '회원 자유 게시판', 1, TRUE, 'AUTHENTICATED', TRUE, 'GENERAL', NOW(6), NOW(6)),
       ('event', '이벤트', '진행 중인 이벤트 안내', 2, TRUE, 'ADMIN_ONLY', TRUE, 'EVENT', NOW(6), NOW(6));
