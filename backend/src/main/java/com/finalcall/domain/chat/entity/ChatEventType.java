package com.finalcall.domain.chat.entity;

/** 채팅 outbox 사건 종류. */
public enum ChatEventType {
    MESSAGE_CREATED,
    READ_UPDATED,
    BLOCK_CHANGED
}
