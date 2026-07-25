package com.finalcall.domain.settlement.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.finalcall.domain.settlement.FeePolicyProperties;

/**
 * 수수료 계산기 단위 테스트(settlement, fee-policy-spec v1.0) — 순수 함수라 컨텍스트 없이 검증한다.
 *
 * <p>구간표·최소·cap 을 spec 정본값으로 고정해, 계산 순서(누진→반올림→cap→최소)와 워크드 예시·경계값을 못 박는다.
 * 이 테스트가 통과하지 않으면 정산 금액 전체가 드리프트하므로(I-B), 정산 통합 테스트의 선행 방어선이다.
 */
class FeeCalculatorTest {

    private static FeeCalculator calculator() {
        FeePolicyProperties policy = new FeePolicyProperties("v1.0", 100L, 300_000L, List.of(
            new FeePolicyProperties.Tier(100_000L, 6),
            new FeePolicyProperties.Tier(1_000_000L, 5),
            new FeePolicyProperties.Tier(3_000_000L, 4),
            new FeePolicyProperties.Tier(null, 3)));
        return new FeeCalculator(policy);
    }

    @Test
    void 대표_예시_P_2_480_000의_수수료는_110_200이고_정산액은_2_369_800이다() {
        long price = 2_480_000L;
        long fee = calculator().compute(price);

        // fee-policy-spec §4.1 워크드 예시: 6,000 + 45,000 + 59,200 = 110,200(반올림 무영향·cap/최소 미저촉).
        assertThat(fee).isEqualTo(110_200L);
        assertThat(price - fee).isEqualTo(2_369_800L);
    }

    @ParameterizedTest(name = "P={0} → fee={1}")
    @CsvSource({
        // fee-policy-spec §4.2 경계·클램프 표.
        "1000, 100", // 0.06×1,000=60 → 최소 100 floor
        "100000, 6000", // 1구간 상한 정각
        "1000000, 51000", // 6,000 + 45,000
        "3000000, 131000", // 6,000 + 45,000 + 80,000
        "20000000, 300000", // 641,000 → cap 300,000
        "1666, 100", // 최소 바인딩 상단 근처(0.06×1,666≈99.96 → round 100)
        "1667, 100" // 0.06×1,667=100.02 → round 100(최소와 동일)
    })
    void 경계값_표대로_계산된다(long price, long expectedFee) {
        assertThat(calculator().compute(price)).isEqualTo(expectedFee);
    }

    @Test
    void 누진_합계는_원단위_사사오입한다() {
        // P=100,010: 6,000(1구간) + 0.05×10 = 6,000.5 → round half up → 6,001. cap/최소 미저촉이라 반올림이 드러난다.
        assertThat(calculator().compute(100_010L)).isEqualTo(6_001L);
    }

    @Test
    void cap_바인딩_지점_8_633_333에서_정확히_300_000이다() {
        // fee-policy-spec §4.2: 판매가 ≈ 8,633,333 G 에서 cap(300,000)에 정확히 도달한다.
        assertThat(calculator().compute(8_633_333L)).isEqualTo(300_000L);
    }

    @Test
    void 최소_수수료는_100이다() {
        // 극소 판매가라도 최소 100 을 보장한다(누진 합계 60 < 100).
        assertThat(calculator().compute(1L)).isEqualTo(100L);
    }
}
