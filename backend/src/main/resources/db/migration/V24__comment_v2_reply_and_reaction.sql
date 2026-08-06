-- EPIC-COMMENT-V2(FC-207): 네이버식 댓글 확장 — comment 대댓글·비정규화 카운트 컬럼 추가 + 인덱스 재편 + comment_reaction 신설.
-- append-only 채번 규율(FC-035 m9): V23 다음(V24)으로 이어붙인다. 기존 V1~V23 무편집 → 체크섬 무간섭.
-- 정본 = board-domain-spec v1.1 §13·§14 · erd v1.9 §4.5·§5·§6(group 7-c) · api-contract §6.3(v1.24).
-- 게이트2 3건 사용자 승인 확정(board-spec §14, 2026-08-06): (a) 답글 1단계 저장·@멘션 (b) comment_reaction 유저당 1행·전환·카운트
--   비정규화 (c) 기존 댓글 API 형상 교체. 기본 정렬 = LATEST.
--
-- 이 티켓(FC-207)은 V24 스키마 전부(comment 확장 + comment_reaction 테이블·인덱스)와 대댓글 threading 코드를 소유한다.
--   반응 값 갱신 로직(like/dislike_count UPDATE·토글)은 FC-208, 정렬(LIKES)·BEST 는 FC-209 가 담당하나, 스키마·인덱스는
--   이번 V24 에서 일괄 생성한다(후속 티켓은 로직만). JPA_DDL_AUTO=validate 는 매핑된 엔티티만 검증하므로 comment_reaction
--   테이블이 엔티티(FC-208 소유) 없이 먼저 있어도 무해하다.
--
-- parent_comment_id 는 V22 에서 이미 존재(예약 컬럼·self-FK)라 DDL 변경 없이 활성화만 한다(코드가 값을 채운다).

-- (1) comment 비정규화 컬럼 추가 — @멘션 스냅샷 + 공감/비공감/답글 카운트. NOT NULL 카운트는 DEFAULT 0(기존 행 백필).
ALTER TABLE comment
    ADD COLUMN mentioned_nickname VARCHAR(30) NULL AFTER parent_comment_id,
    ADD COLUMN like_count         INT NOT NULL DEFAULT 0 AFTER mentioned_nickname,
    ADD COLUMN dislike_count      INT NOT NULL DEFAULT 0 AFTER like_count,
    ADD COLUMN reply_count        INT NOT NULL DEFAULT 0 AFTER dislike_count;

-- (2) comment 인덱스 재편(erd §5, v1.9). 신 인덱스를 먼저 만든 뒤 구 인덱스를 드롭한다 —
--   구 인덱스가 FK(fk_comment_post)의 커버링 인덱스라, 대체 인덱스(선두 컬럼 동일)를 먼저 세워야 FK 제약을 깨지 않고 드롭한다.
-- 루트 목록: post_id=? AND parent_comment_id IS NULL, 최신순 id DESC·과거순 id ASC. fk_comment_post(post_id 선두) 겸함.
CREATE INDEX ix_comment_root_list ON comment (post_id, parent_comment_id, id);
-- 답글 목록: parent_comment_id=? AND is_deleted=false, id asc 시간순 + reply_count 정합.
CREATE INDEX ix_comment_reply_list ON comment (parent_comment_id, is_deleted, id);
-- 순공감순 정렬(ORDER BY like_count DESC)·BEST 상위 스캔(like_count>=임계, FC-209). 정렬 화이트리스트 ↔ 인덱스 1:1(B-006).
CREATE INDEX ix_comment_likes ON comment (post_id, parent_comment_id, like_count);

-- 구 루트 목록 인덱스 드롭(ix_comment_root_list 가 post_id 선두로 fk_comment_post 를 커버하므로 안전).
DROP INDEX ix_comment_post_list ON comment;
-- 주: parent_comment_id FK(fk_comment_parent)의 자동 생성 인덱스는 이제 ix_comment_reply_list 와 중복이나, 자동 인덱스명이
--   MySQL 구현 의존(constraint 명과 불일치 가능)이라 드롭하지 않고 존치한다 — FK 커버는 유지되고 중복 오버헤드는 미미하다.
--   erd §5 의 "구 fk_comment_parent 단일 인덱스 대체"는 질의 커버 관점의 대체이며(신 인덱스가 실사용), 물리 드롭은 강제하지 않는다.

-- (3) comment_reaction 신설 — 댓글 공감/비공감. 유저당 댓글당 1행(UK)·전환은 행 UPDATE·취소는 행 DELETE.
--   카운트는 comment.like_count/dislike_count 에 비정규화(동일 TX 원자 UPDATE, 값 갱신 로직 FC-208). public_id 없음
--   (URL 리소스 아님·대상 댓글 하위 토글). soft delete 없음(취소=물리 DELETE).
CREATE TABLE comment_reaction
(
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    comment_id    BIGINT      NOT NULL,
    user_id       BIGINT      NOT NULL,
    reaction_type VARCHAR(10) NOT NULL,
    created_at    DATETIME(6) NOT NULL,
    updated_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    -- 유저당 댓글당 1행 DB 강제(중복 반응·이중 카운트 차단, money_exchange·charge 멱등 UK 선례) + myReaction 조회
    --   (comment_id IN (…) AND user_id=?) 커버 → 별도 보조 인덱스 불요(erd §5).
    UNIQUE KEY uk_comment_reaction (comment_id, user_id),
    -- 반응 대상 댓글(루트·답글 무관). 겸하는 인덱스는 uk_comment_reaction 이 선두 컬럼(comment_id)으로 제공.
    CONSTRAINT fk_comment_reaction_comment FOREIGN KEY (comment_id) REFERENCES comment (id),
    -- 반응 주체(SecurityContext). 겸하는 인덱스 없어 MySQL 이 FK 인덱스 자동 생성.
    CONSTRAINT fk_comment_reaction_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
