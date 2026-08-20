package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.zaxxer.hikari.HikariDataSource;

/** 실제 MySQL commit 뒤 Redis fast-path 지연이 HTTP/JDBC 경계를 막지 않는지 검증한다. */
class ChatFastPathHttpIntegrationTest extends IntegrationTest {

    private static final String ROOMS_URL = "/api/v1/me/chat-rooms";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    @MockBean
    private ChatRedisFanoutPublisher fanoutPublisher;

    @Test
    void Redis_publish가_5초_지연돼도_HTTP응답과_DB_connection반환은_기다리지_않는다() throws Exception {
        User sender = persistUser("fast_path_sender", "fast-path-sender");
        User recipient = persistUser("fast_path_recipient", "fast-path-recipient");
        String roomPublicId = createRoom(sender, recipient);
        CountDownLatch publishEntered = new CountDownLatch(1);
        CountDownLatch publishCompleted = new CountDownLatch(1);
        AtomicLong publishDelayMillis = new AtomicLong();
        when(fanoutPublisher.publish(anyString())).thenAnswer(invocation -> {
            long started = System.nanoTime();
            publishEntered.countDown();
            try {
                Thread.sleep(5_000L);
                return true;
            } finally {
                publishDelayMillis.set(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
                publishCompleted.countDown();
            }
        });

        long requestStarted = System.nanoTime();
        mockMvc.perform(post(ROOMS_URL + "/" + roomPublicId + "/messages")
            .with(user(String.valueOf(sender.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"clientMessageId\":\"c96278a5-f102-4b76-a09d-4dfe30caa243\","
                + "\"body\":\"비동기 경계 검증\"}"))
            .andExpect(status().isCreated());
        long requestMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - requestStarted);

        assertThat(publishEntered.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(requestMillis).isLessThan(2_000L);
        assertThat(((HikariDataSource)dataSource).getHikariPoolMXBean().getActiveConnections()).isZero();
        assertThat(publishCompleted.await(6, TimeUnit.SECONDS)).isTrue();
        assertThat(publishDelayMillis.get()).isGreaterThanOrEqualTo(4_900L);
    }

    private String createRoom(User requester, User counterpart) throws Exception {
        String response = mockMvc.perform(post(ROOMS_URL + "/direct")
            .with(user(String.valueOf(requester.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"counterpartNickname\":\"" + counterpart.getNickname() + "\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("data").path("roomPublicId").asText();
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder()
            .loginId(loginId)
            .passwordHash("hash")
            .nickname(nickname)
            .build());
    }
}
