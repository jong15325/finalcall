package com.finalcall.domain.bid;

import java.time.Instant;

/**
 * 소프트클로즈 연장 판정 결과(bid-domain-spec §6 · 게이트2 c 확정).
 *
 * <p>순수 함수로 분리한 이유: 연장 규칙은 경계(윈도우 진입 직전/직후, 상한 클램프)에서 틀리기 쉬운데 그 오류가
 * 동시성 테스트에서는 잘 드러나지 않는다. 부수효과 없는 값 계산으로 떼어내면 경계를 단위 테스트로 촘촘히 고정할 수 있다.
 *
 * @param endAt    연장 판정 후 마감 시각(연장이 없으면 기존 값과 같다)
 * @param extended 실제로 마감이 밀렸는지 — {@code extension_count} 증가 여부와 동일하다
 */
public record SoftCloseDecision(Instant endAt, boolean extended) {

    /**
     * 확정 식: {@code new_end = max(end_at, min(now + extend, max_end_at))}, 트리거는
     * {@code now >= end_at - window}.
     *
     * <p><b>기준점이 {@code now + extend} 인 것이 핵심이다</b>({@code end_at + extend} 가 아니다). 소프트클로즈의
     * 의미는 "입찰 시점부터 extend 초를 보장"이며, {@code end_at} 기준으로 더하면 윈도우 안에 몰린 다발 입찰이
     * 마감을 <b>선형 누적</b>으로 밀어낸다(동시 10건 → +300초). 마감 자원이 무한히 고이는 것을 막자는 D-004
     * 취지와 정반대가 된다.
     *
     * <p>{@code max(end_at, ...)} 로 단조 비감소를 강제한다 — 어떤 입력에도 마감이 <b>앞당겨지지 않는다</b>(I7).
     * {@code max_end_at} 에 클램프돼 마감이 더 밀리지 않으면 {@code extended=false} 이므로 카운트도 증가하지
     * 않는다. 다만 <b>입찰 자체는 정상 성립한다</b> — 연장 가능 여부는 입찰자가 통제할 수 없으므로 거부 사유가
     * 될 수 없고, 계약 §5 에 대응 에러코드도 없다.
     *
     * @param now       입찰 성립 시각
     * @param endAt     현재 마감 시각
     * @param maxEndAt  연장 상한 시각
     * @param windowSec 연장 트리거 윈도우(초)
     * @param extendSec 연장 폭(초)
     * @return 연장 판정 결과
     */
    public static SoftCloseDecision decide(
        Instant now, Instant endAt, Instant maxEndAt, int windowSec, int extendSec) {
        // 윈도우 밖이면 마감을 건드리지 않는다. (now < endAt 은 입찰 가능 판정에서 이미 보장된다.)
        if (now.isBefore(endAt.minusSeconds(windowSec))) {
            return new SoftCloseDecision(endAt, false);
        }
        Instant candidate = now.plusSeconds(extendSec);
        Instant clamped = candidate.isAfter(maxEndAt) ? maxEndAt : candidate;
        if (clamped.isAfter(endAt)) {
            return new SoftCloseDecision(clamped, true);
        }
        return new SoftCloseDecision(endAt, false);
    }
}
