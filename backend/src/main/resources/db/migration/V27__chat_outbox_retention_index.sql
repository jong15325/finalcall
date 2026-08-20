-- FC-333: outbox purge 조건과 정렬에 맞춘 (created_at, id) retention index를 가법 추가한다.
-- 기존 (occurred_at, id)는 pipeline head 관측용이므로 유지한다.
ALTER TABLE chat_event_outbox
    ADD KEY ix_chat_event_outbox_retention (created_at, id),
    ALGORITHM = INPLACE,
    LOCK = NONE;
