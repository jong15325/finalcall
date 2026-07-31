package com.finalcall.domain.memo.entity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 메모 목록 커서 코덱(memo, 계약 §1.3 cursor 규약). 받은함·보낸함의 안정 정렬 키는 단조 {@code id DESC}(발신 시각 역순)
 * 하나뿐이라(erd §7.2 — 동시각 타이브레이커 제거) 경계 {@code id} 만 opaque 문자열로 인코딩한다(AuctionCursor 선례의 단순화).
 *
 * <p>손상된 커서는 클라이언트 입력 오류이므로 400({@link CommonErrorCode#INVALID_INPUT})으로 막는다.
 *
 * @param id 커서 경계 memo.id({@code null}=첫 페이지)
 */
public record MemoCursor(Long id) {

    /** 첫 페이지 커서(경계 없음). */
    public static MemoCursor first() {
        return new MemoCursor(null);
    }

    /** 첫 페이지 여부(경계 id 부재). */
    public boolean isFirstPage() {
        return id == null;
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 id 를 인코딩). */
    public static String encode(Long id) {
        return Base64.getUrlEncoder().withoutPadding()
            .encodeToString(String.valueOf(id).getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static MemoCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            return new MemoCursor(Long.valueOf(raw));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
