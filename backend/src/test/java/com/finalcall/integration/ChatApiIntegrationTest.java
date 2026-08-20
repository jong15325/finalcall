package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.service.ChatRateLimitService;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/** 채팅 REST 10종의 계약·replay·IDOR·사용자 rate limit을 실제 MySQL/Redis로 검증한다. */
@Transactional
class ChatApiIntegrationTest extends IntegrationTest {

    private static final String ROOMS_URL = "/api/v1/me/chat-rooms";
    private static final String FIRST_MESSAGE_ID = "c96278a5-f102-4b76-a09d-4dfe30caa243";
    private static final String SECOND_MESSAGE_ID = "0b7a4c6f-7cee-4e6d-8e98-30aab78bf851";
    private static final String THIRD_MESSAGE_ID = "b4306a06-cb44-417f-9fea-1c78c9064e78";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChatMessageRepository messageRepository;

    @Autowired
    private ChatRateLimitService rateLimitService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void REST_10종은_방생성부터_replay_읽음_차단_신고까지_계약대로_동작한다() throws Exception {
        User alice = persistUser("flow_alice", "채팅앨리스");
        User bob = persistUser("flow_bob", "채팅밥");

        String roomPublicId = createRoom(alice, bob, status().isCreated());
        assertThat(createRoom(alice, bob, status().isOk())).isEqualTo(roomPublicId);

        send(bob, roomPublicId, FIRST_MESSAGE_ID, "e\u0301 첫 메시지")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.message.roomSequence").value(1))
            .andExpect(jsonPath("$.data.message.body").value("é 첫 메시지"))
            .andExpect(jsonPath("$.data.message.sentByMe").value(true))
            .andExpect(jsonPath("$.data.deduplicated").value(false));
        send(bob, roomPublicId, FIRST_MESSAGE_ID, "é 첫 메시지")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deduplicated").value(true));
        send(bob, roomPublicId, FIRST_MESSAGE_ID, "다른 본문")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CHAT_004"));
        send(bob, roomPublicId, SECOND_MESSAGE_ID, "둘째")
            .andExpect(status().isCreated());
        send(bob, roomPublicId, THIRD_MESSAGE_ID, "셋째")
            .andExpect(status().isCreated());

        mockMvc.perform(get(ROOMS_URL).with(userId(alice)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].counterpart.memberPublicId").value(bob.getPublicId()))
            .andExpect(jsonPath("$.data.content[0].lastMessage.bodyPreview").value("셋째"))
            .andExpect(jsonPath("$.data.content[0].unreadCount").value(3));
        mockMvc.perform(get(ROOMS_URL + "/unread-count").with(userId(alice)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.count").value(3));
        mockMvc.perform(get(ROOMS_URL + "/" + roomPublicId).with(userId(alice)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.lastSequence").value(3))
            .andExpect(jsonPath("$.data.canSend").value(true));

        mockMvc.perform(get(ROOMS_URL + "/" + roomPublicId + "/messages")
            .with(userId(alice)).param("size", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].roomSequence").value(2))
            .andExpect(jsonPath("$.data.content[1].roomSequence").value(3))
            .andExpect(jsonPath("$.data.content[0].sentByMe").value(false))
            .andExpect(jsonPath("$.data.nextCursor").value(2))
            .andExpect(jsonPath("$.data.hasNext").value(true));
        mockMvc.perform(get(ROOMS_URL + "/" + roomPublicId + "/messages")
            .with(userId(alice)).param("beforeSequence", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].roomSequence").value(1));
        mockMvc.perform(get(ROOMS_URL + "/" + roomPublicId + "/messages")
            .with(userId(alice)).param("afterSequence", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].roomSequence").value(2))
            .andExpect(jsonPath("$.data.content[1].roomSequence").value(3))
            .andExpect(jsonPath("$.data.nextCursor").value(3));
        mockMvc.perform(get(ROOMS_URL + "/" + roomPublicId + "/messages")
            .with(userId(alice)).param("beforeSequence", "3").param("afterSequence", "1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        mockMvc.perform(put(ROOMS_URL + "/" + roomPublicId + "/read")
            .with(userId(alice)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"throughSequence\":3}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.lastReadSequence").value(3))
            .andExpect(jsonPath("$.data.readAt").isNotEmpty());
        mockMvc.perform(get(ROOMS_URL + "/unread-count").with(userId(alice)))
            .andExpect(jsonPath("$.data.count").value(0));

        mockMvc.perform(put(ROOMS_URL + "/" + roomPublicId + "/block").with(userId(alice)))
            .andExpect(status().isNoContent());
        send(bob, roomPublicId, "5ca39552-8e82-42c4-87b5-46e94e96558c", "차단 뒤")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CHAT_005"));
        mockMvc.perform(delete(ROOMS_URL + "/" + roomPublicId + "/block").with(userId(alice)))
            .andExpect(status().isNoContent());

        String messagePublicId = messageRepository.findByRoomIdOrderByRoomSequenceAsc(
            messageRepository.findAll().getFirst().getRoomId()).getFirst().getPublicId();
        String reportBody = "{\"messagePublicId\":\"" + messagePublicId
            + "\",\"reason\":\"FRAUD\",\"detail\":\"외부 송금 요구\"}";
        mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/reports")
            .with(userId(alice)).contentType(MediaType.APPLICATION_JSON).content(reportBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.reportPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.createdAt").isNotEmpty());
        mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/reports")
            .with(userId(alice)).contentType(MediaType.APPLICATION_JSON).content(reportBody))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CHAT_008"));
    }

    @Test
    void 방목록_cursor는_opaque_keyset이고_손상값은_COMMON_001이다() throws Exception {
        User owner = persistUser("cursor_owner", "커서주인");
        createRoom(owner, persistUser("cursor_one", "커서상대1"), status().isCreated());
        createRoom(owner, persistUser("cursor_two", "커서상대2"), status().isCreated());
        createRoom(owner, persistUser("cursor_three", "커서상대3"), status().isCreated());

        String body = mockMvc.perform(get(ROOMS_URL).with(userId(owner)).param("size", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(2))
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andReturn().getResponse().getContentAsString();
        String cursor = objectMapper.readTree(body).path("data").path("nextCursor").asText();
        assertThat(cursor).doesNotContain("|");

        mockMvc.perform(get(ROOMS_URL).with(userId(owner)).param("size", "2").param("cursor", cursor))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.hasNext").value(false));
        mockMvc.perform(get(ROOMS_URL).with(userId(owner)).param("cursor", "손상된커서"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));
    }

    @Test
    void 비참여자는_방과_하위리소스_전경로에서_CHAT_001로_통일된다() throws Exception {
        User alice = persistUser("idor_alice", "IDOR앨리스");
        User bob = persistUser("idor_bob", "IDOR밥");
        User outsider = persistUser("idor_outsider", "IDOR외부인");
        String roomPublicId = createRoom(alice, bob, status().isCreated());
        String base = ROOMS_URL + "/" + roomPublicId;

        expectChatNotFound(mockMvc.perform(get(base).with(userId(outsider))));
        expectChatNotFound(mockMvc.perform(get(base + "/messages").with(userId(outsider))));
        expectChatNotFound(mockMvc.perform(post(base + "/messages").with(userId(outsider))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"clientMessageId\":\"" + FIRST_MESSAGE_ID + "\",\"body\":\"침입\"}")));
        expectChatNotFound(mockMvc.perform(put(base + "/read").with(userId(outsider))
            .contentType(MediaType.APPLICATION_JSON).content("{\"throughSequence\":0}")));
        expectChatNotFound(mockMvc.perform(put(base + "/block").with(userId(outsider))));
        expectChatNotFound(mockMvc.perform(delete(base + "/block").with(userId(outsider))));
        expectChatNotFound(mockMvc.perform(post(base + "/reports").with(userId(outsider))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"messagePublicId\":\"01K00000000000000000000000\",\"reason\":\"SPAM\"}")));
    }

    @Test
    void CHAT_002_003_006_007과_인증_검증오류를_계약코드로_반환한다() throws Exception {
        User alice = persistUser("errors_alice", "오류앨리스");
        User bob = persistUser("errors_bob", "오류밥");

        mockMvc.perform(post(ROOMS_URL + "/direct").with(userId(alice))
            .contentType(MediaType.APPLICATION_JSON).content("{\"counterpartNickname\":\"없는상대\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_002"));
        mockMvc.perform(post(ROOMS_URL + "/direct").with(userId(alice))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"counterpartNickname\":\"" + alice.getNickname() + "\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("CHAT_003"));

        String roomPublicId = createRoom(alice, bob, status().isCreated());
        send(alice, roomPublicId, FIRST_MESSAGE_ID, "내 메시지").andExpect(status().isCreated());
        mockMvc.perform(put(ROOMS_URL + "/" + roomPublicId + "/read").with(userId(bob))
            .contentType(MediaType.APPLICATION_JSON).content("{\"throughSequence\":2}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("CHAT_006"));

        String ownMessageId = messageRepository.findAll().getFirst().getPublicId();
        mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/reports").with(userId(alice))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"messagePublicId\":\"" + ownMessageId + "\",\"reason\":\"SPAM\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("CHAT_007"));

        mockMvc.perform(get(ROOMS_URL)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/messages").with(userId(alice))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"clientMessageId\":\"not-a-uuid\",\"body\":\"본문\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_001"));
    }

    @Test
    void 사용자_메시지_burst_초과는_CHAT_009와_Retry_After를_반환한다() throws Exception {
        User alice = persistUser("rate_alice", "제한앨리스");
        User bob = persistUser("rate_bob", "제한밥");
        String roomPublicId = createRoom(alice, bob, status().isCreated());

        authenticate(alice);
        try {
            for (int request = 0; request < 10; request++) {
                rateLimitService.checkMessageSend();
            }
        } finally {
            SecurityContextHolder.clearContext();
        }

        send(alice, roomPublicId, FIRST_MESSAGE_ID, "한도 초과")
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "1"))
            .andExpect(jsonPath("$.code").value("CHAT_009"));
    }

    @Test
    void 본문경계와_제어문자를_검증하고_HTML은_해석없이_원문으로_반환한다() throws Exception {
        User alice = persistUser("body_alice", "본문앨리스");
        User bob = persistUser("body_bob", "본문밥");
        String roomPublicId = createRoom(alice, bob, status().isCreated());

        String html = "<script>alert('xss')</script>";
        send(alice, roomPublicId, FIRST_MESSAGE_ID, html)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.message.body").value(html));
        send(alice, roomPublicId, SECOND_MESSAGE_ID, "🙂".repeat(1_000))
            .andExpect(status().isCreated());
        send(alice, roomPublicId, THIRD_MESSAGE_ID, "가".repeat(1_001))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));
        send(alice, roomPublicId, "5ca39552-8e82-42c4-87b5-46e94e96558c", "금지\u0001문자")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));
    }

    private String createRoom(User requester, User counterpart,
        org.springframework.test.web.servlet.ResultMatcher expectedStatus) throws Exception {
        String body = mockMvc.perform(post(ROOMS_URL + "/direct").with(userId(requester))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"counterpartNickname\":\"" + counterpart.getNickname() + "\"}"))
            .andExpect(expectedStatus)
            .andExpect(jsonPath("$.data.counterpart.memberPublicId").value(counterpart.getPublicId()))
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("roomPublicId").asText();
    }

    private ResultActions send(User sender, String roomPublicId, String clientMessageId, String body)
        throws Exception {
        return mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/messages").with(userId(sender))
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(MapBody.message(clientMessageId, body))));
    }

    private void expectChatNotFound(ResultActions action) throws Exception {
        action.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CHAT_001"));
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder()
            .loginId("chat319_" + loginId)
            .passwordHash("hash")
            .nickname(nickname)
            .build());
    }

    private RequestPostProcessor userId(User user) {
        return user(String.valueOf(user.getId()));
    }

    private void authenticate(User user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
            new UsernamePasswordAuthenticationToken(String.valueOf(user.getId()), null, List.of()));
        SecurityContextHolder.setContext(context);
    }

    private record MapBody(String clientMessageId, String body) {

        private static MapBody message(String clientMessageId, String body) {
            return new MapBody(clientMessageId, body);
        }
    }
}
