-- EPIC-BOARD(FC-201): 공지(notice) 흡수 — 활성 공지를 '공지' 게시판(slug=notice) post 로 이관.
-- append-only 채번 규율(FC-035 m9): V22 다음(V23)으로 이어붙인다. 기존 V1~V22 무편집 → 체크섬 무간섭.
-- 정본 = board-domain-spec v1.0 §8·§11(b) · 게이트2(b) 사용자 승인(2026-08-06).
--
-- 이 마이그레이션은 데이터 이관만 수행한다. notice 테이블 DROP 은 하지 않는다 —
--   1버전 유예(롤백 안전) 후 후속 마이그레이션(V24 예정)에서 DROP 한다(board-spec §8.2 확정).
--
-- 매핑(board-spec §8.1):
--   활성 판정  = notice.is_deleted = FALSE (삭제 공지는 이관 제외).
--   board_id   = 공지 게시판(slug='notice', V22 시드) id.
--   author_id  = NULL (원 작성자 미상 · 공지 board 는 ADMIN_ONLY 라 author 기반 인가 불의존).
--   author_nickname = '공지사항' 스냅샷(시스템 글 표시명).
--   title/content   = 원본 이관(notice.content VARCHAR(2000) ⊂ post.content TEXT 무손실).
--   is_pinned  = (notice.type = 'URGENT') → TRUE, 그 외(GENERAL/EVENT) → FALSE. NoticeType 축은 소멸.
--   view_count = 0, comment_count = 0.
--   created_at/updated_at = 원본 시각 보존.
--   public_id  = CHAR(26) 신규 생성. 기존 마이그레이션 관행(고정 접두 + zero-pad 식별자, V13 SEED* 선례)을 따라
--                'MIGRATEDNOTICE'(14) + LPAD(notice.id, 12, '0') = 26자로 결정론적·추적가능하게 부여(id 유일 → 충돌 없음).
INSERT INTO post (public_id, board_id, author_id, author_nickname, title, content,
                  view_count, comment_count, is_pinned, is_deleted, deleted_at,
                  created_at, updated_at)
SELECT CONCAT('MIGRATEDNOTICE', LPAD(n.id, 12, '0')),
       (SELECT id FROM board WHERE slug = 'notice'),
       NULL,
       '공지사항',
       n.title,
       n.content,
       0,
       0,
       (n.type = 'URGENT'),
       FALSE,
       NULL,
       n.created_at,
       n.updated_at
FROM notice n
WHERE n.is_deleted = FALSE;
