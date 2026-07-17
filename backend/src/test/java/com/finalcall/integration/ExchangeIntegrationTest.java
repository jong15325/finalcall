package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.currency.MoneyExchangeRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.infra.config.ExchangeProperties;
import com.finalcall.support.IntegrationTest;

/**
 * 캐시→게임머니 교환 통합 검증(currency, FC-009) — 실제 MySQL/Redis(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §4.4: 성공 201 {@code {gameMoneyAmount, appliedRate}}, EXC_001(캐시부족·422)·EXC_002(역방향·422),
 * {@code Idempotency-Key} 누락 400. 멱등 재요청은 1회만 처리(재차감 없음)한다(SEC-004).
 *
 * <p>★ 실제 커밋을 검증해야 하므로(멱등·미persist) {@code @Transactional} 을 걸지 않고, 데이터는 수동 정리한다.
 */
class ExchangeIntegrationTest extends IntegrationTest {

    private static final String URL = "/api/v1/exchanges";

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private MoneyExchangeRepository moneyExchangeRepository;

    @Autowired
    private ExchangeProperties exchangeProperties;

    @BeforeEach
    @AfterEach
    void clean() {
        moneyExchangeRepository.deleteAllInBatch();
        userBalanceRepository.deleteAllInBatch(); // FK: 잔액 먼저
        userRepository.deleteAllInBatch();
    }

    @Test
    void 정상_교환은_201과_지급액을_반환하고_잔액을_이동한다() throws Exception {
        long rate = exchangeProperties.rate();
        Long userId = seedCash(5L);

        String body = mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "key-1")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 5)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.gameMoneyAmount").value(5 * rate))
            .andReturn().getResponse().getContentAsString();

        JsonNode data = objectMapper.readTree(body).get("data");
        assertThat(data.get("appliedRate").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(rate));

        // 잔액 이동: 캐시 5→0, 게임머니 0→5*rate. 원장 1건 기록.
        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isZero();
        assertThat(balance.getGameMoneyBalance()).isEqualTo(5 * rate);
        assertThat(moneyExchangeRepository.count()).isEqualTo(1);
    }

    @Test
    void 같은_멱등키_재요청은_1회만_처리하고_재차감하지_않는다() throws Exception {
        long rate = exchangeProperties.rate();
        Long userId = seedCash(5L);

        // 1차 — 실제 커밋.
        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "same-key")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 5)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.gameMoneyAmount").value(5 * rate));

        // 2차(replay) — 같은 key. 재차감 없이 최초 결과를 그대로 반환한다.
        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "same-key")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 5)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.gameMoneyAmount").value(5 * rate));

        // 재차감 없음: 캐시는 한 번만 빠지고(0), 게임머니도 한 번만 지급, 원장은 1건뿐.
        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isZero();
        assertThat(balance.getGameMoneyBalance()).isEqualTo(5 * rate);
        assertThat(moneyExchangeRepository.count()).isEqualTo(1);
    }

    @Test
    void 캐시부족은_422_EXC_001이고_원장에_남지_않는다() throws Exception {
        Long userId = seedCash(1L); // 보유 1, 요청 2 → 부족

        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "key-insufficient")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 2)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("EXC_001"));

        // 미persist + 잔액 불변(멱등키 미소비).
        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isEqualTo(1L);
        assertThat(balance.getGameMoneyBalance()).isZero();
        assertThat(moneyExchangeRepository.count()).isZero();
    }

    @Test
    void 역방향은_422_EXC_002이고_원장에_남지_않는다() throws Exception {
        Long userId = seedCash(5L);

        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "key-reverse")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("GAME_TO_CASH", 5)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("EXC_002"));

        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isEqualTo(5L); // 차감 없음
        assertThat(moneyExchangeRepository.count()).isZero();
    }

    @Test
    void 캐시금액_상한초과는_400이고_부수효과가_없다() throws Exception {
        Long userId = seedCash(5L);
        // 기본 rate(1,000,000) 역산 상한 초과 → cashAmount × rate 가 long 을 넘겨 오버플로 위생 대상(FC-011).
        long overLimit = Long.MAX_VALUE / 1_000_000L + 1;

        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .header("Idempotency-Key", "key-overflow")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", overLimit)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_001"))
            .andExpect(jsonPath("$.errors[0].field").value("cashAmount"));

        // 부수효과 없음: 잔액 불변·원장 미persist(멱등키 미소비).
        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isEqualTo(5L);
        assertThat(balance.getGameMoneyBalance()).isZero();
        assertThat(moneyExchangeRepository.count()).isZero();
    }

    @Test
    void 멱등키_누락은_400이다() throws Exception {
        Long userId = seedCash(5L);

        mockMvc.perform(post(URL).with(user(String.valueOf(userId)))
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 5)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        assertThat(moneyExchangeRepository.count()).isZero();
    }

    @Test
    void 미인증_요청은_401이다() throws Exception {
        mockMvc.perform(post(URL)
            .header("Idempotency-Key", "key-anon")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody("CASH_TO_GAME", 5)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("COMMON_005"));
    }

    /** 캐시만 보유한 사용자와 잔액 행을 생성한다. 잔액 증감은 원자 UPDATE 경로라 세터가 없어 리플렉션으로 세팅한다. */
    private Long seedCash(long cash) {
        User user = userRepository.save(
            User.builder().loginId("exchanger").passwordHash("hash").nickname("교환자").build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "cashBalance", cash);
        userBalanceRepository.save(balance);
        return user.getId();
    }

    private static String requestBody(String direction, long cashAmount) {
        return """
            {"direction":"%s","cashAmount":%d}
            """.formatted(direction, cashAmount);
    }
}
