-- EPIC-MEMO(FC-171): 회원 간 메모(쪽지) — user_memo 신규 테이블(게임 원본 new_sp.user_memo 계승 네이티브 도메인).
-- append-only 채번 규율(FC-035 m9): V19 다음(V20)으로 이어붙인다. 기존 V1~V19 무편집 → 체크섬 무간섭.
-- 정본 = memo-domain-spec v1.0 §7·erd v1.6 §4.1·§5·§6(group1 1-c), api-contract §2.6(v1.20). 게이트2 4결정 승인(2026-08-01).
--
-- 게임 lineage 로 테이블명 user_memo 를 유지한다(게임 서버가 장차 이 테이블을 그대로 읽음 → boundary 마찰 최소, 게이트2 c).
-- 자유 재구성(finalcall 컨벤션): PK(int AI → BIGINT + public_id ULID), 감사(add_date → created_at), soft delete(int 0/1 → BIT + deleted_at).
-- 클라 고정 계약(보존): memo_type 코드값(5=USER·0/14=SYSTEM)·닉 char(16) 폭·body char(120) 용량·level×100+gender 패킹(게임 boundary 재합성).
-- sender_id·receiver_id 는 nullable — 시스템 메모(게임 발신)·레거시 임포트 미매칭 수용(웹 유저 발신은 항상 채움, §7.4).
CREATE TABLE user_memo
(
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    public_id         CHAR(26)     NOT NULL,
    sender_id         BIGINT       NULL,
    sender_nickname   VARCHAR(16)  NOT NULL,
    sender_level      INT          NULL,
    sender_gender     TINYINT      NULL,
    receiver_id       BIGINT       NULL,
    receiver_nickname VARCHAR(16)  NOT NULL,
    memo_type         INT          NOT NULL,
    body              VARCHAR(120) NOT NULL,
    is_read           BIT          NOT NULL,
    read_at           DATETIME(6)  NULL,
    is_deleted        BIT          NOT NULL,
    deleted_at        DATETIME(6)  NULL,
    created_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- 외부 노출 식별자(B-004). 상세·삭제 경로 리소스. 대리키라 D-081 자연키 UK 패턴 불요.
    UNIQUE KEY uk_user_memo_public_id (public_id),
    -- 받은함 커서 조회(receiver_id=me AND is_deleted=false, id DESC 안정 정렬) + 미열람 개수 집계 커버(erd §5).
    KEY ix_user_memo_receiver (receiver_id, is_deleted, id DESC),
    -- 보낸함 커서 조회(sender_id=me AND is_deleted=false, id DESC).
    KEY ix_user_memo_sender (sender_id, is_deleted, id DESC),
    -- FK→user: 발신·수신 회원(nullable). 인덱스는 위 복합이 선두 컬럼으로 겸한다.
    CONSTRAINT fk_user_memo_sender FOREIGN KEY (sender_id) REFERENCES user (id),
    CONSTRAINT fk_user_memo_receiver FOREIGN KEY (receiver_id) REFERENCES user (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
