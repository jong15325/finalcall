package com.finalcall.domain.chat.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/** 방 목록의 {@code (lastActivityAt DESC, id DESC)} keyset을 감추는 versioned opaque 커서. */
public record ChatRoomCursor(Instant lastActivityAt, Long id) {

    private static final String VERSION = "v1";

    public static ChatRoomCursor first() {
        return new ChatRoomCursor(null, null);
    }

    public boolean isFirstPage() {
        return lastActivityAt == null && id == null;
    }

    public static String encode(Instant lastActivityAt, Long id) {
        String raw = VERSION + "|" + lastActivityAt + "|" + id;
        return Base64.getUrlEncoder().withoutPadding()
            .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static ChatRoomCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] fields = raw.split("\\|", -1);
            if (fields.length != 3 || !VERSION.equals(fields[0])) {
                throw new IllegalArgumentException("지원하지 않는 채팅방 커서입니다.");
            }
            Instant activityAt = Instant.parse(fields[1]);
            Long id = Long.valueOf(fields[2]);
            if (id <= 0L) {
                throw new IllegalArgumentException("채팅방 커서 ID는 양수여야 합니다.");
            }
            return new ChatRoomCursor(activityAt, id);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
