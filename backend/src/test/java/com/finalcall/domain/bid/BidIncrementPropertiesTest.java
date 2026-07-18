package com.finalcall.domain.bid;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * 최소 증분 구간표 단위 검증(bid-domain-spec §3.3 확정 표).
 *
 * <p>구간 경계는 "이상/초과"를 한 칸 틀리기 쉬운 자리다. 여기서 틀리면 최소 증분이 한 구간 낮게 적용돼
 * 마감 직전 저액 입찰 폭주를 허용하게 되므로 경계값을 명시적으로 고정한다.
 */
class BidIncrementPropertiesTest {

    private final BidIncrementProperties properties = new BidIncrementProperties(List.of(
        new BidIncrementProperties.Tier(0L, 100L),
        new BidIncrementProperties.Tier(10_000L, 1_000L),
        new BidIncrementProperties.Tier(100_000L, 5_000L),
        new BidIncrementProperties.Tier(1_000_000L, 10_000L),
        new BidIncrementProperties.Tier(10_000_000L, 100_000L),
        new BidIncrementProperties.Tier(100_000_000L, 1_000_000L)));

    @Test
    void 구간별_증분이_확정표와_일치한다() {
        assertThat(properties.incrementFor(0L)).isEqualTo(100L);
        assertThat(properties.incrementFor(9_999L)).isEqualTo(100L);
        assertThat(properties.incrementFor(10_000L)).isEqualTo(1_000L);
        assertThat(properties.incrementFor(99_999L)).isEqualTo(1_000L);
        assertThat(properties.incrementFor(100_000L)).isEqualTo(5_000L);
        assertThat(properties.incrementFor(999_999L)).isEqualTo(5_000L);
        assertThat(properties.incrementFor(1_000_000L)).isEqualTo(10_000L);
        assertThat(properties.incrementFor(9_999_999L)).isEqualTo(10_000L);
        assertThat(properties.incrementFor(10_000_000L)).isEqualTo(100_000L);
        assertThat(properties.incrementFor(99_999_999L)).isEqualTo(100_000L);
        assertThat(properties.incrementFor(100_000_000L)).isEqualTo(1_000_000L);
        assertThat(properties.incrementFor(9_999_999_999L)).isEqualTo(1_000_000L);
    }

    @Test
    void 설정_작성_순서가_뒤바뀌어도_판정이_같다() {
        BidIncrementProperties shuffled = new BidIncrementProperties(List.of(
            new BidIncrementProperties.Tier(100_000L, 5_000L),
            new BidIncrementProperties.Tier(0L, 100L),
            new BidIncrementProperties.Tier(10_000L, 1_000L)));

        assertThat(shuffled.incrementFor(0L)).isEqualTo(100L);
        assertThat(shuffled.incrementFor(50_000L)).isEqualTo(1_000L);
        assertThat(shuffled.incrementFor(500_000L)).isEqualTo(5_000L);
    }
}
