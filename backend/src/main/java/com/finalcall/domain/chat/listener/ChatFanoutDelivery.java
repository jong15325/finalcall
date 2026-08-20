package com.finalcall.domain.chat.listener;

import com.finalcall.domain.chat.dto.ChatEventResponse;

/** DB hydration transaction이 구성하고 transaction 밖의 dispatcher가 전송하는 불변 전달 단위. */
public record ChatFanoutDelivery(Long recipientId, ChatEventResponse response) {
}
