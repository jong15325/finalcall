package com.finalcall.domain.shop.entity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 고정가 목록 커서 코덱(shop, 계약 §1.3 cursor 규약, {@code AuctionCursor} 선례). 안정 정렬 키 {@code (정렬필드 값,
 * id)} 를 opaque 문자열로 인코딩한다 — id 를 최종 tiebreaker 로 둬 동일 정렬값에서도 결정적 순서를 보장한다.
 *
 * <p>정렬 필드(createdAt·price·endAt)는 이 에픽에서 전부 NOT NULL 이라 sortValue 는 항상 존재한다. 손상된 커서는
 * 클라이언트 입력 오류이므로 400(COMMON_001)으로 막는다.
 *
 * @param sortValue 정렬 필드 값 문자열(null=첫 페이지)
 * @param id        커서 경계 shop.id(null=첫 페이지)
 */
public record ShopCursor(String sortValue, Long id) {

    private static final String DELIMITER = "|";

    /** 첫 페이지 커서(경계 없음). */
    public static ShopCursor first() {
        return new ShopCursor(null, null);
    }

    /** 첫 페이지 여부(경계 id 부재). */
    public boolean isFirstPage() {
        return id == null;
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 정렬 키를 인코딩). */
    public static String encode(String sortValue, Long id) {
        String raw = (sortValue == null ? "" : sortValue) + DELIMITER + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static ShopCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int delimiterIndex = raw.lastIndexOf(DELIMITER);
            if (delimiterIndex < 0) {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT);
            }
            String sortValue = raw.substring(0, delimiterIndex);
            Long id = Long.valueOf(raw.substring(delimiterIndex + DELIMITER.length()));
            return new ShopCursor(sortValue.isEmpty() ? null : sortValue, id);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
