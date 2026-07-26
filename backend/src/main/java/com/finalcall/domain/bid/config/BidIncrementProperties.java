package com.finalcall.domain.bid.config;

import java.util.Comparator;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

/**
 * 최소 입찰 증분 구간표(bid-domain-spec §3.3, domain-spec §4 D-004).
 *
 * <p>구간표는 컴파일 상수가 아니라 <b>운영 정책</b>이다. 시장 상황에 따라 조정될 값이므로 프로파일 설정으로
 * 빼고 {@code @ConfigurationProperties} + {@code @Validated} 로 바인딩한다(CLAUDE.md §4 — 산발적
 * {@code @Value} 금지). 설정이 비었거나 음수 step 이면 <b>부팅이 실패</b>한다 — 증분 0은 최소 증분 검증을
 * 무력화해 1원 단위 입찰 폭주를 허용하므로, 런타임에 조용히 기본값으로 흘러가게 두면 안 된다.
 *
 * <p>장래에 DB 정책 테이블로 승격될 수 있으나(domain-spec §4 명시 경로), 그 전까지 이 클래스가 단일 진실원이다.
 * 프론트가 구간표를 복제하지 않도록 상세 응답에 {@code minNextBidAmount} 파생값을 실어 보낸다(계약 v1.8 F3).
 */
@Validated
@ConfigurationProperties(prefix = "bid.increment")
public record BidIncrementProperties(

    /** 구간 목록. 최고가가 속한 구간의 step 이 최소 증분이 된다. */
    @NotEmpty @Valid List<Tier> tiers) {

    /**
     * 정렬을 설정 작성 순서에 의존하지 않도록 바인딩 시점에 threshold 오름차순으로 고정한다.
     * yml 순서가 뒤바뀌어도 판정이 달라지지 않아야 한다.
     */
    public BidIncrementProperties {
        if (tiers != null) {
            tiers = tiers.stream().sorted(Comparator.comparingLong(Tier::threshold)).toList();
        }
    }

    /**
     * 주어진 현재 최고가에 적용할 최소 증분을 구한다.
     *
     * @param highestBidAmount 현재 최고가(0 이상)
     * @return 해당 구간의 증분. 어떤 구간에도 걸리지 않으면 최저 구간의 step(설정상 threshold 0 구간)
     */
    public long incrementFor(long highestBidAmount) {
        long step = tiers.get(0).step();
        for (Tier tier : tiers) {
            if (highestBidAmount >= tier.threshold()) {
                step = tier.step();
            } else {
                break;
            }
        }
        return step;
    }

    /**
     * ★ 다음 입찰이 충족해야 할 최소 금액(bid-domain-spec §3.3, 계약 v1.8 F3) — <b>이 프로젝트의 단일 진실원</b>이다.
     *
     * <p>같은 규칙을 두 곳에서 쓴다: 입찰 검증({@code BidService.place} 의 {@code BID_001} 판정)과 경매 상세 응답의
     * {@code minNextBidAmount} 파생값이다. 두 곳이 각자 구현하면 "화면이 안내한 금액으로 입찰했는데 거부되는"
     * 드리프트가 생기므로, 양쪽 모두 이 메서드만 호출한다.
     *
     * @param startPrice       경매 시작가(첫 입찰의 하한, F5)
     * @param highestBidAmount 현재 최고가. null 이면 입찰이 없다는 뜻이다
     * @return 첫 입찰이면 시작가, 후속이면 최고가 + 해당 구간 증분
     */
    public long minNextBidAmount(long startPrice, Long highestBidAmount) {
        if (highestBidAmount == null) {
            return startPrice;
        }
        return highestBidAmount + incrementFor(highestBidAmount);
    }

    /**
     * 증분 구간 하나.
     *
     * @param threshold 구간 하한(이상). 최저 구간은 0
     * @param step      해당 구간의 최소 증분(양수)
     */
    public record Tier(@Min(0) long threshold, @Positive long step) {
    }
}
