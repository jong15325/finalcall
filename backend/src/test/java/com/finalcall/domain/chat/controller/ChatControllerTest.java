package com.finalcall.domain.chat.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.chat.dto.ChatMessageSendRequest;
import com.finalcall.domain.chat.dto.ChatMessageSendResponse;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.service.ChatCommandService;
import com.finalcall.domain.chat.service.ChatMessagePersistence;
import com.finalcall.domain.chat.service.ChatQueryService;
import com.finalcall.domain.chat.service.ChatRateLimitService;

class ChatControllerTest {

    @Test
    void sendMessage는_persistence_result로_응답하고_queryService를_호출하지_않는다() {
        ChatCommandService commandService = mock(ChatCommandService.class);
        ChatQueryService queryService = mock(ChatQueryService.class);
        ChatRateLimitService rateLimitService = mock(ChatRateLimitService.class);
        ChatController controller = new ChatController(commandService, queryService, rateLimitService);
        ChatMessage message = ChatMessage.builder()
            .publicId("01JCHATCONTROLLERTEST001")
            .roomId(1L)
            .roomSequence(2L)
            .senderId(3L)
            .senderNicknameSnapshot("발신자")
            .clientMessageId("c0958907-9820-4d63-bc9e-19521a210c2d")
            .body("본문")
            .build();
        ChatMessageSendRequest request = new ChatMessageSendRequest(message.getClientMessageId(), message.getBody());
        when(commandService.sendMessage("room-public-id", request.clientMessageId(), request.body()))
            .thenReturn(new ChatMessagePersistence(message, "sender-public-id", false));

        ResponseEntity<ApiResponse<ChatMessageSendResponse>> response = controller.sendMessage("room-public-id",
            request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData().message().sender().memberPublicId())
            .isEqualTo("sender-public-id");
        assertThat(response.getBody().getData().message().sentByMe()).isTrue();
        assertThat(response.getBody().getData().deduplicated()).isFalse();
        verifyNoInteractions(queryService);
    }
}
