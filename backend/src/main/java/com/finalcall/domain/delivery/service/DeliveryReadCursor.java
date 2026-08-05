package com.finalcall.domain.delivery.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 배송 조회 커서 코덱(delivery, FC-192 — 계약 §1.3 cursor 규약 · delivery-domain-spec §10.1). 안정 정렬 키
 * {@code (created_at, id)} 를 opaque 문자열로 인코딩한다 — id 를 최종 tiebreaker 로 둬 동일 생성 시각에서도 결정적
 * 순서를 보장한다(keyset 페이지네이션, {@link com.finalcall.domain.settlement.entity.SaleOrderCursor} 선례).
 * 정렬은 {@code created_at desc} 고정(§4.6.1).
 *
 * <p>커서는 <b>read 서비스 소유</b>다 — 서비스가 디코딩해 리포지토리에는 경계 원시값(created_at, id)만 넘기므로
 * repository→service 역참조가 생기지 않는다({@link com.finalcall.domain.item.service.TempStorageCursor} 선례).
 *
 * @param createdAt 커서 경계 created_at(null=첫 페이지)
 * @param id        커서 경계 item_delivery.id(null=첫 페이지)
 */
public record DeliveryReadCursor(Instant createdAt, Long id) {

    private static final String DELIMITER = "|";

    /** 첫 페이지 커서(경계 없음). */
    public static DeliveryReadCursor first() {
        return new DeliveryReadCursor(null, null);
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 정렬 키를 인코딩). */
    public static String encode(Instant createdAt, Long id) {
        String raw = createdAt.toString() + DELIMITER + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static DeliveryReadCursor decode(String cursor) {
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
            return new DeliveryReadCursor(createdAt, id);
        } catch (IllegalArgumentException | java.time.format.DateTimeParseException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
