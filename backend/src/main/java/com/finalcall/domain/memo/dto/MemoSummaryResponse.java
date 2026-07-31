package com.finalcall.domain.memo.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.domain.memo.entity.Memo;

import lombok.Builder;

/**
 * 메모 목록 항목 응답(memo, 계약 §2.6 받은함·보낸함 {@code CursorResponse} content — {@code MemoSummary} 형상).
 *
 * <p><b>역할 인지 응답</b>이다: 받은함은 상대가 발신자라 {@code senderNickname} 을, 보낸함은 상대가 수신자라
 * {@code receiverNickname} 을 싣는다(계약 "sender 필드 자리에 receiver 노출"). 싣지 않는 쪽은 {@code null} →
 * {@link JsonInclude} {@code NON_NULL} 로 <b>필드 자체가 부재</b>한다(OrderSummaryResponse 역할별 필드 선례). 두 박스
 * 모두 {@code senderLevel}/{@code senderGender}(발신자 스냅샷)를 분해 노출하고, 본문은 미리보기({@code bodyPreview})만 싣는다.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MemoSummaryResponse(
    String memoPublicId,
    int type,
    String senderNickname,
    String receiverNickname,
    Integer senderLevel,
    Integer senderGender,
    String bodyPreview,
    boolean isRead,
    Instant createdAt) {

    /** 목록 본문 미리보기 최대 길이(문자). 초과분은 말줄임(…)으로 대체한다 — 상세는 전체 body 노출. */
    private static final int PREVIEW_MAX_LENGTH = 30;

    /** 받은함 항목 — 상대(발신자) 닉을 싣는다({@code receiverNickname} 은 null 로 응답에서 제외). */
    public static MemoSummaryResponse received(Memo memo) {
        return base(memo)
            .senderNickname(memo.getSenderNickname())
            .build();
    }

    /** 보낸함 항목 — 상대(수신자) 닉을 싣는다({@code senderNickname} 은 null 로 응답에서 제외). */
    public static MemoSummaryResponse sent(Memo memo) {
        return base(memo)
            .receiverNickname(memo.getReceiverNickname())
            .build();
    }

    private static MemoSummaryResponseBuilder base(Memo memo) {
        return MemoSummaryResponse.builder()
            .memoPublicId(memo.getPublicId())
            .type(memo.getMemoType())
            .senderLevel(memo.getSenderLevel())
            .senderGender(memo.getSenderGender())
            .bodyPreview(preview(memo.getBody()))
            .isRead(memo.isRead())
            .createdAt(memo.getCreatedAt());
    }

    private static String preview(String body) {
        if (body == null || body.length() <= PREVIEW_MAX_LENGTH) {
            return body;
        }
        return body.substring(0, PREVIEW_MAX_LENGTH) + "…";
    }
}
