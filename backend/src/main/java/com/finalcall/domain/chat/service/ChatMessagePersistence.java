package com.finalcall.domain.chat.service;

import com.finalcall.domain.chat.entity.ChatMessage;

/** 메시지 영속 결과. 기존 멱등 요청이면 {@code deduplicated=true}다. */
public record ChatMessagePersistence(ChatMessage message, boolean deduplicated) {
}
