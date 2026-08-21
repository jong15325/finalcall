package com.finalcall.domain.chat.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.member.entity.User;

class ChatMessageResponseTest {

    @Test
    void senderPublicId_factory는_기존_User_factory와_동일한_내_메시지_응답을_만든다() {
        User sender = User.builder().loginId("sender").passwordHash("hash").nickname("발신자").build();
        ReflectionTestUtils.setField(sender, "id", 1L);
        ChatMessage message = ChatMessage.builder()
            .publicId("01JCHATMESSAGERESPONSE001")
            .roomId(2L)
            .roomSequence(3L)
            .senderId(1L)
            .senderNicknameSnapshot("발신자 스냅샷")
            .clientMessageId("0e02ee1e-06a9-4dba-86aa-98a7ac58d450")
            .body("응답 본문")
            .build();
        ReflectionTestUtils.setField(message, "createdAt", Instant.parse("2026-08-22T00:00:00Z"));

        ChatMessageResponse fromPublicId = ChatMessageResponse.from(message, sender.getPublicId());
        ChatMessageResponse fromUser = ChatMessageResponse.from(message, sender, sender.getId());

        assertThat(fromPublicId).isEqualTo(fromUser);
        assertThat(fromPublicId.sentByMe()).isTrue();
        assertThat(fromPublicId.sender().nickname()).isEqualTo("발신자 스냅샷");
    }
}
