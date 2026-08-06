package com.finalcall.domain.board.entity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 게시글 목록 커서 코덱(EPIC-BOARD, 계약 §1.3 cursor · board-spec §6.3). 정렬은 <b>{@code is_pinned DESC, id DESC}</b>
 * (고정 글 최상단·그 외 최신순)라 안정 정렬 키가 (pinned, id) 2축이다 — 경계도 두 값을 함께 인코딩해야 keyset
 * 페이지네이션이 정확하다(고정↔일반 경계를 넘는 페이지에서 id 단독 경계는 누락·중복을 낸다).
 *
 * <p>손상된 커서는 클라이언트 입력 오류이므로 400({@link CommonErrorCode#INVALID_INPUT})으로 막는다.
 *
 * @param pinned 경계 글의 상단 고정 여부({@code null}=첫 페이지)
 * @param id     경계 글의 post.id({@code null}=첫 페이지)
 */
public record PostCursor(Boolean pinned, Long id) {

    /** 첫 페이지 커서(경계 없음). */
    public static PostCursor first() {
        return new PostCursor(null, null);
    }

    /** 첫 페이지 여부(경계 부재). */
    public boolean isFirstPage() {
        return id == null;
    }

    /** 다음 페이지 커서 문자열을 만든다(마지막 항목의 pinned·id 를 {@code "{0|1}:{id}"} 로 인코딩). */
    public static String encode(boolean pinned, Long id) {
        String raw = (pinned ? "1" : "0") + ":" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 커서 문자열을 해석한다. null/빈 문자열은 첫 페이지, 손상은 {@link CommonErrorCode#INVALID_INPUT}(400). */
    public static PostCursor decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return first();
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int sep = raw.indexOf(':');
            if (sep < 0) {
                throw new IllegalArgumentException("커서 형식 오류");
            }
            boolean pinned = "1".equals(raw.substring(0, sep));
            Long id = Long.valueOf(raw.substring(sep + 1));
            return new PostCursor(pinned, id);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
