package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.domain.chat.dto.ChatEventResponse;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

class ChatFanoutHydratorTest {

    private static final String EVENT_ID = "01H00000000000000000000000";
    private static final String ROOM_PUBLIC_ID = "01H00000000000000000000001";
    private static final String MESSAGE_PUBLIC_ID = "01H00000000000000000000002";
    private static final Instant OCCURRED_AT = Instant.parse("2026-08-18T00:00:00Z");

    private final ChatRoomRepository roomRepository = org.mockito.Mockito.mock(ChatRoomRepository.class);
    private final ChatMessageRepository messageRepository = org.mockito.Mockito.mock(ChatMessageRepository.class);
    private final UserRepository userRepository = org.mockito.Mockito.mock(UserRepository.class);
    private final ChatFanoutHydrator hydrator = new ChatFanoutHydrator(
        roomRepository, messageRepository, userRepository);

    @Test
    void message_metadata를_DB로_재검증해_recipient_관점으로_fan_out한다() {
        ChatFanoutMetadata metadata = messageMetadata(List.of(1L, 2L));
        ChatRoom room = room();
        ChatMessage message = message();
        User sender = user(1L, "발신자");
        when(roomRepository.findByPublicId(ROOM_PUBLIC_ID)).thenReturn(Optional.of(room));
        when(messageRepository.findByRoomIdAndPublicId(10L, MESSAGE_PUBLIC_ID)).thenReturn(Optional.of(message));
        when(userRepository.findById(1L)).thenReturn(Optional.of(sender));

        List<ChatFanoutDelivery> deliveries = hydrator.hydrate(metadata, Set.of(1L, 2L));

        ChatEventResponse senderEvent = responseFor(deliveries, 1L);
        ChatEventResponse recipientEvent = responseFor(deliveries, 2L);
        assertThat(((ChatEventResponse.MessagePayload)senderEvent.payload()).message().sentByMe()).isTrue();
        assertThat(((ChatEventResponse.MessagePayload)recipientEvent.payload()).message().sentByMe())
            .isFalse();
    }

    @Test
    void Redis_recipient가_DB_참여자와_다르면_전송하지_않는다() {
        when(roomRepository.findByPublicId(ROOM_PUBLIC_ID)).thenReturn(Optional.of(room()));

        List<ChatFanoutDelivery> deliveries = hydrator.hydrate(messageMetadata(List.of(1L, 3L)), Set.of(1L));

        assertThat(deliveries).isEmpty();
    }

    private ChatEventResponse responseFor(List<ChatFanoutDelivery> deliveries, Long recipientId) {
        return deliveries.stream().filter(delivery -> delivery.recipientId().equals(recipientId))
            .findFirst().orElseThrow().response();
    }

    private ChatFanoutMetadata messageMetadata(List<Long> recipients) {
        return new ChatFanoutMetadata(EVENT_ID, ChatEventType.MESSAGE_CREATED,
            ChatEventOutbox.EVENT_VERSION, OCCURRED_AT, ROOM_PUBLIC_ID, recipients,
            MESSAGE_PUBLIC_ID, 1L, 1L, null, null, null, null);
    }

    private ChatRoom room() {
        ChatRoom room = ChatRoom.builder().publicId(ROOM_PUBLIC_ID).memberLowId(1L).memberHighId(2L)
            .lastActivityAt(OCCURRED_AT).build();
        ReflectionTestUtils.setField(room, "id", 10L);
        return room;
    }

    private ChatMessage message() {
        ChatMessage message = ChatMessage.builder().publicId(MESSAGE_PUBLIC_ID).roomId(10L).roomSequence(1L)
            .senderId(1L).senderNicknameSnapshot("발신자")
            .clientMessageId("c96278a5-f102-4b76-a09d-4dfe30caa243").body("안녕하세요").build();
        ReflectionTestUtils.setField(message, "createdAt", OCCURRED_AT);
        return message;
    }

    private User user(Long id, String nickname) {
        User user = User.builder().loginId("chat-user").passwordHash("hash").nickname(nickname).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
