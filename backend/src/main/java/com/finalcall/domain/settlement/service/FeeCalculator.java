package com.finalcall.domain.settlement.service;

import org.springframework.stereotype.Component;

import com.finalcall.domain.settlement.config.FeePolicyProperties;

import lombok.RequiredArgsConstructor;

/**
 * 플랫폼 중계 수수료 계산기(settlement, fee-policy-spec v1.0 §3) — <b>순수 함수</b> 단일 책임 계산기.
 *
 * <p>입력 최종 판매가({@code finalPrice}), 출력 수수료({@code feeAmount}). 계산 순서를 <b>엄수</b>한다(§3 순서 정본):
 * <ol>
 *   <li><b>구간별 누진 raw_fee</b> — 판매가를 구간으로 쪼개 각 구간에 속한 부분에만 요율을 적용한다(marginal,
 *       전체 일괄율이 아니다). 구간 경계에서 수수료가 역전(cliff)되는 것을 막는다.</li>
 *   <li><b>원(=G) 단위 사사오입</b>(round half up) — 누진 합계 산출 직후 한 번만.</li>
 *   <li><b>상한(cap) 클램프</b> — {@code min(rounded, cap)}.</li>
 *   <li><b>최소 클램프</b> — {@code max(capped, minFee)}.</li>
 *   <li><b>판매가 클램프</b> — {@code min(fee, finalPrice)}. 수수료가 판매가를 넘지 못하게 상한을 씌워
 *       {@code settle = finalPrice − fee ≥ 0} 을 보장한다(FC-176, fee-policy-spec §3 5단계). {@code minFee} floor
 *       로 인해 {@code finalPrice < minFee} 인 소액 구간에서만 바인딩되어, 판매가 전액이 수수료·정산 0이 된다.</li>
 * </ol>
 * cap·최소·판매가 상한은 <b>계산기 내부</b>에서 클램프한다(fee-policy-spec §7 — 호출부가 아니라 계산기가 단일 책임).
 * cap·최소는 값이 겹치지 않아 3·4 순서를 바꿔도 결과가 같으나, 명세 순서를 정본으로 인코딩한다. 판매가 클램프는
 * 반드시 최소 클램프 <b>뒤</b>에 와야 한다(순서 유의) — {@code minFee} floor 로 부풀려진 소액 수수료를 판매가로 되눌러야
 * settle 음수를 막는다.
 *
 * <p>검산(fee-policy-spec §4.1): {@code compute(2_480_000) = 110_200}. 정산액 {@code settle = P − fee} 는 호출부
 * (SOLD TX)가 계산하며, 그 값이 {@code sale_order.settle_amount} 이자 {@code final_price = settle + fee}(I-B)다.
 */
@Component
@RequiredArgsConstructor
public class FeeCalculator {

    /** 요율 퍼센트의 분모. 요율은 정수 퍼센트(6·5·4·3%)라 누진 합계를 100 으로 나눠 G 단위로 환산한다. */
    private static final long PERCENT_DENOMINATOR = 100L;

    private final FeePolicyProperties policy;

    /**
     * 최종 판매가에 대한 플랫폼 수수료를 계산한다(누진 → 반올림 → cap → 최소 → 판매가 클램프).
     *
     * @param finalPrice 최종 확정가(= 낙찰가, 양수)
     * @return 수수료(G, {@code min(cap, finalPrice) 이하} · {@code fee ≤ finalPrice} 보장 ⟹ {@code settle ≥ 0})
     */
    public long compute(long finalPrice) {
        long rounded = roundHalfUp(rawFeeNumerator(finalPrice));
        long capped = Math.min(rounded, policy.cap());
        long floored = Math.max(capped, policy.minFee());
        return Math.min(floored, finalPrice);
    }

    /**
     * 구간별 누진 합계의 <b>퍼센트 단위 분자</b>(= {@code raw_fee × 100})를 정수로 누적한다. 정수 누적 후 마지막에
     * 한 번만 100 으로 나눠 반올림하므로(2단계), 구간마다 나눠 반올림하며 누적하는 것보다 정확하다.
     *
     * <p>각 구간의 적용 폭(portion)은 판매가에서 그 구간에 속하는 부분이다: {@code clamp(P − prevBound, 0, 구간폭)}.
     * 상한 없는 최상위 구간은 {@code max(P − prevBound, 0)} 전부를 적용한다.
     */
    private long rawFeeNumerator(long finalPrice) {
        long numerator = 0L;
        long prevBound = 0L;
        for (FeePolicyProperties.Tier tier : policy.tiers()) {
            long portion;
            if (tier.upTo() == null) {
                portion = Math.max(finalPrice - prevBound, 0L);
            } else {
                long bandWidth = tier.upTo() - prevBound;
                portion = Math.max(0L, Math.min(finalPrice - prevBound, bandWidth));
                prevBound = tier.upTo();
            }
            numerator += portion * tier.ratePercent();
        }
        return numerator;
    }

    /** 퍼센트 분자를 G 단위로 사사오입(round half up)한다. 분자·분모 모두 음이 아니므로 {@code (x + 분모/2) / 분모}. */
    private long roundHalfUp(long numerator) {
        return (numerator + PERCENT_DENOMINATOR / 2) / PERCENT_DENOMINATOR;
    }
}
