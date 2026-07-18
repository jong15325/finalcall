package com.finalcall.domain.bid;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

/**
 * 소프트클로즈 연장 판정 단위 검증(bid-domain-spec §6 · 게이트2 c).
 *
 * <p>연장 규칙의 오류는 동시성 테스트에서 잘 드러나지 않는다(마감이 몇 초 밀렸는지는 타이밍에 묻힌다).
 * 그래서 경계값을 여기서 결정적으로 고정한다 — 특히 <b>기준점이 {@code now + extend} 라는 점</b>과
 * <b>상한 클램프 시 카운트가 늘지 않는다는 점</b>이 회귀 방어 대상이다.
 */
class SoftCloseDecisionTest {

    private static final Instant NOW = Instant.parse("2026-07-18T12:00:00Z");
    private static final int WINDOW = 30;
    private static final int EXTEND = 30;

    @Test
    void 윈도우_밖_입찰은_마감을_건드리지_않는다() {
        Instant endAt = NOW.plusSeconds(31); // 잔여 31초 > window 30초

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), WINDOW, EXTEND);

        assertThat(decision.endAt()).isEqualTo(endAt);
        assertThat(decision.extended()).isFalse();
    }

    @Test
    void 윈도우_경계_정각은_트리거되지만_실제_연장은_없다() {
        // now == end_at - window 정각. 트리거 조건(now >= end_at - window)은 만족하지만 확정 식이
        //   new_end = max(end_at, now + extend) = max(end_at, end_at) = end_at 이라 마감이 밀리지 않는다.
        //   즉 window == extend 인 기본 설정에서 실제 연장은 윈도우 "안쪽"에서만 일어난다 — 이는 식에서
        //   자연히 따라오는 성질이며, 여기서 고정해 두지 않으면 나중에 off-by-one 수정으로 오인되기 쉽다.
        Instant endAt = NOW.plusSeconds(WINDOW);

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), WINDOW, EXTEND);

        assertThat(decision.endAt()).isEqualTo(endAt);
        assertThat(decision.extended()).isFalse();
    }

    @Test
    void 윈도우_안쪽_1초에서는_실제로_연장된다() {
        Instant endAt = NOW.plusSeconds(WINDOW - 1);

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), WINDOW, EXTEND);

        assertThat(decision.extended()).isTrue();
        assertThat(decision.endAt()).isEqualTo(NOW.plusSeconds(EXTEND));
    }

    @Test
    void 연장_기준점은_end_at이_아니라_now다() {
        // 잔여 5초 남은 상태. end_at + extend 라면 35초 뒤가 되지만, 확정 식은 now + extend = 30초 뒤다.
        Instant endAt = NOW.plusSeconds(5);

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), WINDOW, EXTEND);

        assertThat(decision.endAt()).isEqualTo(NOW.plusSeconds(30));
        assertThat(decision.endAt()).isNotEqualTo(endAt.plusSeconds(EXTEND));
    }

    @Test
    void 동일_시각_다발_입찰은_마감을_선형_누적으로_밀지_않는다() {
        // 같은 순간에 10건이 들어와도 각각의 결과가 동일하게 now+30 으로 수렴한다(누적 +300 아님).
        Instant endAt = NOW.plusSeconds(5);

        Instant first = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), WINDOW, EXTEND).endAt();
        Instant tenth = first;
        for (int i = 0; i < 9; i++) {
            tenth = SoftCloseDecision.decide(NOW, tenth, endAt.plusSeconds(3600), WINDOW, EXTEND).endAt();
        }

        assertThat(tenth).isEqualTo(first).isEqualTo(NOW.plusSeconds(EXTEND));
    }

    @Test
    void max_end_at에_클램프되면_연장으로_치지_않는다() {
        Instant endAt = NOW.plusSeconds(5);
        Instant maxEndAt = endAt; // 이미 상한 도달

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, maxEndAt, WINDOW, EXTEND);

        // 입찰 자체는 성립하고(호출 측이 거부하지 않는다) 마감만 더 밀리지 않는다.
        assertThat(decision.endAt()).isEqualTo(endAt);
        assertThat(decision.extended()).isFalse();
    }

    @Test
    void 상한_직전이면_상한까지만_밀린다() {
        Instant endAt = NOW.plusSeconds(5);
        Instant maxEndAt = NOW.plusSeconds(10); // now+extend(30) 보다 앞

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, maxEndAt, WINDOW, EXTEND);

        assertThat(decision.endAt()).isEqualTo(maxEndAt);
        assertThat(decision.extended()).isTrue();
    }

    @Test
    void 마감은_어떤_경우에도_앞당겨지지_않는다() {
        // 이미 크게 연장돼 end_at 이 now+extend 보다 뒤인 상태에서 다시 입찰이 들어온 경우(I7 단조 비감소).
        Instant endAt = NOW.plusSeconds(20);

        SoftCloseDecision decision = SoftCloseDecision.decide(NOW, endAt, endAt.plusSeconds(3600), 600, 5);

        assertThat(decision.endAt()).isEqualTo(endAt);
        assertThat(decision.extended()).isFalse();
    }
}
