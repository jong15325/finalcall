package com.finalcall.domain.search.entity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 검색 결과 커서 코덱(search, 계약 C2 · search-spec §12.7). relevance 정렬의 안정 타이브레이커
 * {@code search_after(_score desc, publicId asc)} 경계를 opaque 문자열로 인코딩한다 — {@code _score} 동점에서도
 * {@code publicId} 로 결정적 순서를 보장한다(keyset, offset 페이지네이션의 흔들림·중복 회피).
 *
 * <p>손상된 커서는 클라이언트 입력 오류이므로 400({@code COMMON_001})으로 막는다(AuctionCursor 선례).
 *
 * @param score    직전 페이지 마지막 히트의 {@code _score}(null=첫 페이지)
 * @param publicId 직전 페이지 마지막 히트의 리스팅 public_id(null=첫 페이지)
 */
public record SearchCursor(Double score, String publicId) {

    private static final String DELIMITER = "|";

    /** 첫 페이지 커서(경계 없음). */
    public static SearchCursor first() {
        return new SearchCursor(null, null);
    }

    /** 첫 페이지 여부(경계 부재). */
    public boolean isFirstPage() {
        return publicId == null;
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 히트의 score·publicId 를 인코딩). */
    public static String encode(double score, String publicId) {
        String raw = Double.toString(score) + DELIMITER + publicId;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static SearchCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int delimiterIndex = raw.indexOf(DELIMITER);
            if (delimiterIndex < 0) {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT);
            }
            double score = Double.parseDouble(raw.substring(0, delimiterIndex));
            String publicId = raw.substring(delimiterIndex + DELIMITER.length());
            if (publicId.isEmpty()) {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT);
            }
            return new SearchCursor(score, publicId);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
