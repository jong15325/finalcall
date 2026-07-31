package com.finalcall.domain.memo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 메모 발신 요청(memo, 계약 §2.6 POST /me/memos). 발신자·type 은 요청에 없다(서버가 주체·5 로 고정 — I-1·I-2).
 *
 * <p>{@code body} 는 자유 텍스트 단일 필드다(수동 개행 없음, 게이트2 d). {@code @Size(max = 120)} 는 DB 용량
 * 안전망이고, 실제 입력폭 상한(게임 팝업 용량) 검증은 서비스에서 {@code getStringByte ≤ 112}(=4×28)로 수행한다(§8.3).
 */
public record MemoSendRequest(
    @NotBlank(message = "수신자 닉네임은 필수입니다.") @Size(max = 16, message = "수신자 닉네임은 16자 이하여야 합니다.") String receiverNickname,

    @NotBlank(message = "본문은 필수입니다.") @Size(max = 120, message = "본문은 120자 이하여야 합니다.") String body) {
}
