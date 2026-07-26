package com.finalcall.domain.settlement.config;

import java.util.Comparator;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 플랫폼 중계 수수료 정책 구간표(fee-policy-spec v1.0 §2·§3).
 *
 * <p>구간별 누진(marginal) 요율·최소·상한(cap)은 컴파일 상수가 아니라 <b>운영 정책</b>이다. 시장 앵커에 따라
 * 조정될 값이라 프로파일 설정으로 빼고 {@code @ConfigurationProperties} + {@code @Validated} 로 바인딩한다
 * (CLAUDE.md §4 — 산발적 {@code @Value} 금지, {@code BidIncrementProperties} 선례). 설정이 비었거나 요율이 음수면
 * <b>부팅이 실패</b>한다(조용한 기본값 대체 금지).
 *
 * <p>{@code version} 은 정산 시 {@code sale_order.fee_policy_version}·{@code platform_revenue_ledger.fee_policy_version}
 * 에 스탬프되어, 정산 후 환불 비례 크레딧(fee-policy-spec §5)이 "당시 정책" 을 재현할 근거가 된다.
 *
 * <p>계산 순서·클램프는 {@link com.finalcall.domain.settlement.service.FeeCalculator} 가 단독 책임진다
 * (fee-policy-spec §7 — 계산기 내부에서 cap·최소 적용). 이 클래스는 파라미터 보유·정렬만 담당한다.
 */
@Validated
@ConfigurationProperties(prefix = "fee.policy")
public record FeePolicyProperties(

    /** 정책 버전 문자열(예: {@code v1.0}). sale_order·ledger 에 스탬프된다. */
    @NotBlank String version,

    /** 최소 수수료(fee-policy-spec §2, 100 G). 누진 합계가 이보다 작으면 이 값으로 상향한다. */
    @Positive long minFee,

    /** 수수료 상한(cap, fee-policy-spec §2, 300,000 G). 누진 합계가 이보다 크면 이 값으로 클램프한다. */
    @Positive long cap,

    /** 구간 목록(누진 요율). 판매가를 구간으로 쪼개 각 구간 부분에만 해당 요율을 적용한다. */
    @NotEmpty @Valid List<Tier> tiers) {

    /**
     * 정렬을 설정 작성 순서에 의존하지 않도록 바인딩 시점에 상한 오름차순으로 고정한다(상한 없는 최상위 구간은 맨
     * 뒤). yml 순서가 뒤바뀌어도 누진 계산이 달라지지 않아야 한다.
     */
    public FeePolicyProperties {
        if (tiers != null) {
            tiers = tiers.stream()
                .sorted(Comparator.comparing(Tier::upTo, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        }
    }

    /**
     * 누진 구간 하나.
     *
     * @param upTo        구간 상한(이하, G). {@code null} 이면 상한 없는 최상위 구간이다(정확히 1건이어야 정상)
     * @param ratePercent 해당 구간 부분에 적용할 요율(퍼센트, 0 이상). 예: 6 = 6%
     */
    public record Tier(Long upTo, @PositiveOrZero int ratePercent) {
    }
}
