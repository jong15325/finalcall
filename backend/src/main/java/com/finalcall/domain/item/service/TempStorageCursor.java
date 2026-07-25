package com.finalcall.domain.item.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 임시보관 커서 코덱(item, FC-022) — 안정 정렬 키 {@code (stored_at, instance_id)}를 opaque 문자열로 인코딩한다.
 *
 * <p>계약 §1.3 cursor 규약(불투명 토큰)을 지키기 위해 내부 정렬 키를 base64(url-safe)로 감싼다. 첫 페이지는
 * 키가 없다({@code storedAt}/{@code instanceId} null). 손상된 커서는 클라이언트 입력 오류이므로 400(COMMON_001)으로 막는다.
 *
 * @param storedAt   커서 저장 시각(null = 첫 페이지)
 * @param instanceId 커서 인스턴스 PK(null = 첫 페이지)
 */
public record TempStorageCursor(Instant storedAt, Long instanceId) {

    private static final String DELIMITER = "|";

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 정렬 키를 인코딩). */
    public static String encode(Instant storedAt, Long instanceId) {
        String raw = storedAt.toString() + DELIMITER + instanceId;
        return Base64.getUrlEncoder().withoutPadding()
            .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static TempStorageCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return new TempStorageCursor(null, null);
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int delimiterIndex = raw.lastIndexOf(DELIMITER);
            if (delimiterIndex < 0) {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT);
            }
            Instant storedAt = Instant.parse(raw.substring(0, delimiterIndex));
            Long instanceId = Long.valueOf(raw.substring(delimiterIndex + DELIMITER.length()));
            return new TempStorageCursor(storedAt, instanceId);
        } catch (IllegalArgumentException | java.time.format.DateTimeParseException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
