-- 홈 최신/GENERAL 추천 후보를 status 고정 + created_at/id 역순으로 LIMIT 탐색한다.
-- end_at 적격 여부는 인덱스 탐색 중 필터하며, 정렬·전체 테이블 스캔을 피하는 것이 목적이다.
ALTER TABLE shop
    ADD INDEX ix_shop_status_created_at_id (status, created_at, id),
    ALGORITHM = INPLACE,
    LOCK = NONE;
