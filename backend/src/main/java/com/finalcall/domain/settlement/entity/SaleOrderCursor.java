package com.finalcall.domain.settlement.entity;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 거래내역 커서 코덱(settlement, 계약 §1.3 cursor 규약 · purchase-spec §5.1). 안정 정렬 키 {@code (created_at, id)}
 * 를 opaque 문자열로 인코딩한다 — id 를 최종 tiebreaker 로 둬 동일 생성 시각에서도 결정적 순서를 보장한다(keyset
 * 페이지네이션, {@link com.finalcall.domain.auction.entity.AuctionCursor} 선례). 정렬은 {@code created_at desc} 고정.
 *
 * @param createdAt 커서 경계 created_at(null=첫 페이지)
 * @param id        커서 경계 sale_order.id(null=첫 페이지)
 */
public record SaleOrderCursor(Instant createdAt, Long id) {

    private static final String DELIMITER = "|";

    /** 첫 페이지 커서(경계 없음). */
    public static SaleOrderCursor first() {
        return new SaleOrderCursor(null, null);
    }

    /** 첫 페이지 여부(경계 id 부재). */
    public boolean isFirstPage() {
        return id == null;
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 정렬 키를 인코딩). */
    public static String encode(Instant createdAt, Long id) {
        String raw = createdAt.toString() + DELIMITER + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static SaleOrderCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int delimiterIndex = raw.lastIndexOf(DELIMITER);
            if (delimiterIndex < 0) {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT);
            }
            Instant createdAt = Instant.parse(raw.substring(0, delimiterIndex));
            Long id = Long.valueOf(raw.substring(delimiterIndex + DELIMITER.length()));
            return new SaleOrderCursor(createdAt, id);
        } catch (IllegalArgumentException | java.time.format.DateTimeParseException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
