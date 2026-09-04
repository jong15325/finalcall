-- EPIC-DEMO-ACCESS: 일반 인증 신원이 없는 공용 테스트 계정 1개.
ALTER TABLE user
    ADD COLUMN account_type ENUM ('NORMAL', 'DEMO') NOT NULL DEFAULT 'NORMAL' AFTER is_admin;

INSERT INTO user
    (public_id, login_id, password_hash, nickname, primary_character_id, email, email_verified,
     is_admin, account_type, is_deleted, deleted_at, created_at, updated_at)
VALUES
    ('01DEMOACCESS00000000000001', NULL, NULL, 'FinalCall 체험', 1, NULL, 0, 0, 'DEMO', 0, NULL, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE updated_at = updated_at;

INSERT INTO user_balance (user_id, cash_balance, game_money_balance, game_money_held, created_at, updated_at)
SELECT u.id, 100000, 5000000, 0, NOW(6), NOW(6)
FROM user u
LEFT JOIN user_balance b ON b.user_id = u.id
WHERE u.account_type = 'DEMO' AND b.id IS NULL;
