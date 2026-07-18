package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.member.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 소프트클로즈 연장 경합 검증(bid, FC-034) — bid-domain-spec §10 시나리오 2, 불변식 <b>I7·I8</b>.
 *
 * <p>여기서 지키려는 것은 두 가지다. (1) 마감 직전에 입찰이 몰려도 마감이 <b>선형 누적</b>으로 밀려나지 않고
 * {@code max_end_at} 을 절대 넘지 않는다. (2) 마감 경계가 새지 않는다 — 마감 후 입찰은 부작용 0으로 거부되고,
 * 연장이 커밋된 뒤의 입찰은 <b>새 {@code end_at}</b> 기준으로 판정된다.
 *
 * <p>연장 <b>식 자체</b>의 경계값(윈도우 정각·클램프·단조 비감소)은 {@code SoftCloseDecisionTest} 가 결정적으로
 * 고정한다. 이 테스트는 그 식이 <b>동시 입찰 아래에서도 같은 결론을 유지하는지</b>만 본다 — 역할을 나누지 않으면
 * 타이밍에 묻혀 경계 오류가 드러나지 않는다.
 */
class BidSoftCloseConcurrencyIntegrationTest extends BidConcurrencyTestBase {

    private static final int THREADS = 16;
    private static final int WINDOW_SEC = 30;
    private static final int EXTEND_SEC = 30;

    /**
     * ★ 핵심 단언 — 연장 상한에 도달하면 입찰이 아무리 몰려도 {@code extension_count} 가 <b>1에서 멈춘다</b>.
     *
     * <p>상한을 마감 +10초로 좁혀 첫 입찰이 곧바로 클램프에 걸리게 만든다. 이후 입찰은 매번
     * {@code min(now+extend, max_end_at) = max_end_at} 를 계산하는데 이는 이미 반영된 {@code end_at} 과 같아
     * "실제 연장"이 아니다 → 카운트가 늘지 않는다. <b>입찰 자체는 전부 정상 성립한다</b>(연장 불가는 거부 사유가
     * 아니다 — 기각안 C3).
     */
    @Test
    void 연장_상한에_도달하면_동시_입찰이_몰려도_extension_count는_1에서_멈춘다() throws Exception {
        User seller = persistUser("sc_cap_seller", "상한판매자", 0L);
        Instant endAt = secondsLater(3);
        Instant maxEndAt = endAt.plusSeconds(10); // extend(30초)보다 훨씬 좁은 상한
        Auction auction = persistAuction(seller, 8301, endAt, maxEndAt, WINDOW_SEC, EXTEND_SEC);
        List<User> bidders = bidders("sc_cap_", THREADS);

        AtomicInteger success = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            String code = placeAndCaptureCode(
                bidders.get(index), auction.getPublicId(), START_PRICE + (long)index * STEP);
            if (code == null) {
                success.incrementAndGet();
            } else if (!"BID_001".equals(code)) {
                unexpected.add(code);
            }
        });

        assertThat(unexpected).isEmpty();
        assertThat(success.get()).isPositive();

        Auction finalAuction = reload(auction);
        // I7: 마감은 상한을 절대 넘지 않는다. 여기서는 정확히 상한에 붙는다.
        assertThat(finalAuction.getEndAt()).isEqualTo(maxEndAt);
        // I7: extension_count 는 "실제로 end_at 이 밀린 횟수"다. 상한 클램프 이후 입찰은 마감을 밀지 못하므로
        //     입찰이 몇 건이든 1 이다 — 입찰 수만큼 무분별하게 늘지 않는다.
        assertThat(finalAuction.getExtensionCount()).isEqualTo(1);
        assertEndAtInvariants(auction.getId(), endAt);
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 상한에 여유가 있어도 마감이 <b>입찰 수에 비례해 밀리지 않는다</b>(기준점 = {@code now + extend}).
     *
     * <p>{@code end_at + extend} 기준이었다면 성공 N건이 마감을 N×30초 밀어냈을 것이다(동시 16건 → +480초).
     * 확정 식은 입찰 시점 기준이라 총 연장이 ~30초로 수렴한다. 그 차이를 여기서 못 박는다.
     */
    @Test
    void 윈도우_안_동시_입찰은_마감을_선형_누적으로_밀지_않는다() throws Exception {
        User seller = persistUser("sc_lin_seller", "누적판매자", 0L);
        Instant endAt = secondsLater(3);
        Auction auction = persistAuction(
            seller, 8302, endAt, endAt.plus(1, ChronoUnit.HOURS), WINDOW_SEC, EXTEND_SEC);
        List<User> bidders = bidders("sc_lin_", THREADS);

        AtomicInteger success = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        Instant raceStart = Instant.now();
        runConcurrently(THREADS, index -> {
            String code = placeAndCaptureCode(
                bidders.get(index), auction.getPublicId(), START_PRICE + (long)index * STEP);
            if (code == null) {
                success.incrementAndGet();
            } else if (!"BID_001".equals(code)) {
                unexpected.add(code);
            }
        });

        assertThat(unexpected).isEmpty();
        assertThat(success.get()).isPositive();

        Auction finalAuction = reload(auction);
        // 총 연장은 "마지막 입찰 시점 + extend" 언저리에 수렴한다. 경합 전체가 걸린 시간(넉넉히 30초)을 더해도
        //   선형 누적(success × 30초)에는 한참 못 미친다 — 그 간극이 곧 기준점 결정(게이트2 c)의 효과다.
        assertThat(finalAuction.getEndAt()).isBefore(raceStart.plusSeconds(EXTEND_SEC + 30L));
        assertThat(finalAuction.getEndAt()).isAfter(endAt); // 실제로 연장은 됐다
        // extension_count 는 성공 입찰 수를 넘지 않는다(연장은 성립 입찰에만 뒤따른다).
        assertThat(finalAuction.getExtensionCount()).isPositive().isLessThanOrEqualTo(success.get());
        assertEndAtInvariants(auction.getId(), endAt);
        assertAuctionAnchorInvariants(auction.getId());
    }

    /** 윈도우 밖(잔여 1시간) 입찰은 마감을 건드리지 않는다 — 동시 입찰이라도 마찬가지다(I7). */
    @Test
    void 윈도우_밖_동시_입찰은_마감을_전혀_건드리지_않는다() throws Exception {
        User seller = persistUser("sc_out_seller", "윈도우밖판매자", 0L);
        Instant endAt = secondsLater(3600);
        Auction auction = persistAuction(
            seller, 8303, endAt, endAt.plus(1, ChronoUnit.HOURS), WINDOW_SEC, EXTEND_SEC);
        List<User> bidders = bidders("sc_out_", THREADS);

        runConcurrently(THREADS,
            index -> placeAndCaptureCode(bidders.get(index), auction.getPublicId(), START_PRICE + (long)index * STEP));

        Auction finalAuction = reload(auction);
        assertThat(finalAuction.getEndAt()).isEqualTo(endAt);
        assertThat(finalAuction.getExtensionCount()).isZero();
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * I8 — 마감 경계 누수 없음. {@code now >= end_at} 이후의 동시 입찰은 <b>전부</b> BID_006 이고 부작용이 0이다.
     *
     * <p>영속 status 는 ACTIVE 로 고여 있다(마감 워커는 EPIC-CLOSING 소유). 판정이 status 가 아니라 시각 기준이라
     * 워커 부재와 무관하게 정확히 거부된다는 것이 요점이다.
     */
    @Test
    void 마감_시각이_지난_경매는_동시_입찰_전건이_BID_006이고_흔적을_남기지_않는다() throws Exception {
        User seller = persistUser("sc_end_seller", "마감판매자", 0L);
        Instant endAt = secondsLater(-1);
        Auction auction = persistAuction(
            seller, 8304, endAt, endAt.plus(1, ChronoUnit.HOURS), WINDOW_SEC, EXTEND_SEC);
        List<User> bidders = bidders("sc_end_", THREADS);

        List<String> codes = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            String code = placeAndCaptureCode(
                bidders.get(index), auction.getPublicId(), START_PRICE + (long)index * STEP);
            codes.add(code == null ? "성공" : code);
        });

        assertThat(codes).hasSize(THREADS).containsOnly("BID_006");
        assertThat(bidCount(auction.getId())).isZero();
        assertThat(moneyHoldRepository.count()).isZero();
        for (User bidder : bidders) {
            assertMoneyConservation(bidder, BALANCE);
        }
        Auction finalAuction = reload(auction);
        assertThat(finalAuction.getEndAt()).isEqualTo(endAt); // 거부된 입찰은 연장도 일으키지 않는다
        assertThat(finalAuction.getExtensionCount()).isZero();
    }

    /**
     * I8 후반 — 연장이 커밋된 뒤의 입찰은 <b>새 {@code end_at}</b> 기준으로 판정된다.
     *
     * <p>원래 마감을 지난 시점에 입찰하는데도 성립해야 한다. 판정이 최초 마감(또는 {@code base_end_at})에
     * 묶여 있으면 여기서 BID_006 으로 잘못 거부된다 — 연장이 "표시만 되고 효력이 없는" 결함이다.
     */
    @Test
    void 연장이_커밋된_뒤의_입찰은_원래_마감을_지나도_새_마감_기준으로_수용된다() throws Exception {
        User seller = persistUser("sc_ext_seller", "연장판매자", 0L);
        User first = persistUser("sc_ext_a", "선입찰자", BALANCE);
        User second = persistUser("sc_ext_b", "후입찰자", BALANCE);
        Instant endAt = secondsLater(2);
        Auction auction = persistAuction(
            seller, 8305, endAt, endAt.plus(1, ChronoUnit.HOURS), WINDOW_SEC, EXTEND_SEC);

        placeInTransaction(first, auction.getPublicId(), START_PRICE);
        Instant extendedEndAt = reload(auction).getEndAt();
        assertThat(extendedEndAt).isAfter(endAt);

        // 원래 마감을 확실히 넘긴다. 연장이 효력을 가지면 아직 입찰 가능한 상태다.
        Thread.sleep(2_500L);
        assertThat(Instant.now()).isAfter(endAt);

        assertThat(placeAndCaptureCode(second, auction.getPublicId(), START_PRICE + STEP)).isNull();

        Auction finalAuction = reload(auction);
        assertThat(finalAuction.getHighestBidder().getId()).isEqualTo(second.getId());
        assertThat(finalAuction.getEndAt()).isAfterOrEqualTo(extendedEndAt); // 마감은 앞당겨지지 않는다(I7)
        assertEndAtInvariants(auction.getId(), endAt);
        assertAuctionAnchorInvariants(auction.getId());
        assertMoneyConservation(first, BALANCE);
        assertMoneyConservation(second, BALANCE);
    }

    private List<User> bidders(String prefix, int count) {
        List<User> users = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            users.add(persistUser(prefix + i, "입찰자" + i, BALANCE));
        }
        return users;
    }
}
