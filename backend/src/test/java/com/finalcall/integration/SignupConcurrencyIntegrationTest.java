package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 회원가입 동시성 검증(auth, M1) — 실제 MySQL(Testcontainers).
 *
 * <p>같은 loginId 로 동시 가입 시 UK 제약이 단일 성공을 보장하고, 나머지는 <b>500 이 아닌 409 AUTH_001</b>로
 * 응답하는지 확인한다(선검사 우회 경쟁이 제약 안전망으로 매핑됨, B-024).
 * ★ 실제 커밋이 필요해 @Transactional 을 걸지 않고, 생성 데이터는 @BeforeEach/@AfterEach 로 정리한다.
 */
class SignupConcurrencyIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @BeforeEach
    @AfterEach
    void cleanUsers() {
        userBalanceRepository.deleteAllInBatch(); // FK: 잔액 먼저
        userRepository.deleteAllInBatch();
    }

    @Test
    void 동일_loginId_동시가입은_하나만_201이고_나머지는_409_AUTH_001() throws Exception {
        int threads = 6;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger created = new AtomicInteger();
        AtomicInteger conflict = new AtomicInteger();
        List<Integer> unexpectedStatuses = new CopyOnWriteArrayList<>();

        try {
            for (int i = 0; i < threads; i++) {
                int idx = i;
                pool.submit(() -> {
                    try {
                        ready.await();
                        // 같은 loginId, 닉네임만 유니크 → 충돌은 uk_user_login_id_active 로 한정.
                        int status = mockMvc.perform(post(SIGNUP_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("racer", "pw12345678", "nick_" + idx)))
                            .andReturn().getResponse().getStatus();
                        if (status == 201) {
                            created.incrementAndGet();
                        } else if (status == 409) {
                            conflict.incrementAndGet();
                        } else {
                            unexpectedStatuses.add(status);
                        }
                    } catch (Exception ex) {
                        unexpectedStatuses.add(-1);
                    } finally {
                        done.countDown();
                    }
                });
            }
            ready.countDown();
            assertThat(done.await(20, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(created.get()).isEqualTo(1); // 정확히 하나만 성공
        assertThat(conflict.get()).isEqualTo(threads - 1); // 나머지는 409(500 아님)
        assertThat(unexpectedStatuses).isEmpty(); // 500 등 미발생
    }

    private static String body(String loginId, String password, String nickname) {
        return """
            {"loginId":"%s","password":"%s","nickname":"%s"}
            """.formatted(loginId, password, nickname);
    }
}
