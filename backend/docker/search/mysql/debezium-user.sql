-- EPIC-SEARCH(FC-107): Debezium 캡처 계정(search-spec §12.1).
--   fresh volume은 docker-entrypoint-initdb.d에서 자동 실행된다. 기존 MySQL 볼륨은 initdb가 재실행되지 않으므로,
--   계정이 없다면 이 스크립트를 root 로 수동 적용한다(런북 참조):
--     docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql
-- ★ 계정/비밀번호는 로컬 전용 일회성 값이다(운영은 시크릿 매니저).
CREATE USER IF NOT EXISTS 'debezium'@'%' IDENTIFIED BY 'dbz';

-- Debezium 이 binlog 를 replica 로 읽는 데 필요한 최소 권한.
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'debezium'@'%';

FLUSH PRIVILEGES;
