ALTER TABLE user
    ADD COLUMN primary_character_id TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER nickname,
    ADD CONSTRAINT chk_user_primary_character
        CHECK (primary_character_id BETWEEN 1 AND 12 OR primary_character_id BETWEEN 25 AND 28);
