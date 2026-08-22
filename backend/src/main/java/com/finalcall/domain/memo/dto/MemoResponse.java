package com.finalcall.domain.memo.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.domain.memo.entity.Memo;

import lombok.Builder;

/**
 * 메모 상세 응답(memo, 계약 §2.6 GET /me/memos/{id}). 당사자만 조회하므로 상대 닉을 마스킹하지 않고 원문 노출한다.
 *
 * <p>{@code senderLevel}/{@code senderGender} 는 <b>분해된 값</b>으로 노출한다(게임 {@code 레벨×100+성별} 패킹 int 는
 * boundary 전용 — 웹 API 미노출, §8.1). {@code readAt} 은 미열람 시 {@code null} → {@link JsonInclude} {@code NON_NULL}
 * 로 필드 자체가 부재한다(계약의 {@code readAt?} 형상).
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MemoResponse(
    String memoPublicId,
    int type,
    String senderNickname,
    @JsonInclude(JsonInclude.Include.ALWAYS) Integer senderPrimaryCharacterId,
    Integer senderLevel,
    Integer senderGender,
    String receiverNickname,
    @JsonInclude(JsonInclude.Include.ALWAYS) Integer receiverPrimaryCharacterId,
    String body,
    boolean isRead,
    Instant readAt,
    Instant createdAt) {

    public static MemoResponse from(Memo memo) {
        return from(memo, null, null);
    }

    public static MemoResponse from(Memo memo, Integer senderPrimaryCharacterId,
        Integer receiverPrimaryCharacterId) {
        return MemoResponse.builder()
            .memoPublicId(memo.getPublicId())
            .type(memo.getMemoType())
            .senderNickname(memo.getSenderNickname())
            .senderPrimaryCharacterId(senderPrimaryCharacterId)
            .senderLevel(memo.getSenderLevel())
            .senderGender(memo.getSenderGender())
            .receiverNickname(memo.getReceiverNickname())
            .receiverPrimaryCharacterId(receiverPrimaryCharacterId)
            .body(memo.getBody())
            .isRead(memo.isRead())
            .readAt(memo.getReadAt())
            .createdAt(memo.getCreatedAt())
            .build();
    }
}
