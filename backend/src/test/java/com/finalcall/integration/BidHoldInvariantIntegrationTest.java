package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.currency.entity.MoneyHoldStatus;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 홀드 원장 불변식 검증(bid, FC-034) — bid-domain-spec §10 시나리오 3·4, 불변식 <b>I3·I4·I5</b>.
 *
 * <p>이 도메인의 최악 시나리오는 <b>홀드 미해제(자금 동결)</b>와 <b>이중 해제(무자본 입찰)</b>다(§9). 둘 다 조용히
 * 누적되는 성질이라 응답만 보면 절대 드러나지 않는다 — 그래서 매 시나리오 끝에서 원장({@code money_hold})과
 * 잔액({@code user_balance.game_money_held})을 <b>따로 계산해 맞대본다</b>. 두 수가 갈라지는 순간이 결함이다.
 */
class BidHoldInvariantIntegrationTest extends BidConcurrencyTestBase {

    private static final int ROUNDS = 20;
    private static final int THREADS = 24;

    /**
     * 시나리오 3 — A·B 교대 입찰 {@value #ROUNDS} 회. 홀드는 <b>즉시</b> 해제되므로(P-008) 아무리 반복해도
     * HELD 는 1건이고 나머지는 전부 RELEASED 다.
     *
     * <p>즉시 해제가 누락되면 밀린 입찰의 홀드가 누적돼 사용자 잔액이 장시간 묶인다. 회차를 20회로 잡은 이유는
     * 1~2회에서는 누적 버그가 "우연히 맞는" 값과 구분되지 않기 때문이다.
     */
    @Test
    void 교대_입찰_20회_후에도_HELD는_1건이고_나머지는_전부_RELEASED다() throws Exception {
        User seller = persistUser("hold_alt_seller", "교대판매자", 0L);
        User alice = persistUser("hold_alt_a", "앨리스", BALANCE);
        User bob = persistUser("hold_alt_b", "밥", BALANCE);
        Auction auction = persistAuction(seller, 8401, secondsLater(3600));

        long amount = START_PRICE;
        for (int round = 0; round < ROUNDS; round++) {
            placeInTransaction(round % 2 == 0 ? alice : bob, auction.getPublicId(), amount);
            amount += STEP;
        }
        long lastAmount = amount - STEP;
        User winner = ROUNDS % 2 == 0 ? bob : alice; // 마지막 round = ROUNDS-1

        // I3: 활성 홀드는 경매당 1건뿐이고 그 보유자가 현재 최고입찰자다.
        assertThat(heldCount()).isEqualTo(1);
        assertThat(heldSum(winner)).isEqualTo(lastAmount);
        assertThat(ledgerCount(MoneyHoldStatus.HELD)).isEqualTo(1);
        assertThat(ledgerCount(MoneyHoldStatus.RELEASED)).isEqualTo(ROUNDS - 1L);
        // 원장은 지워지지 않는다 — 입찰 1건당 홀드 1건이 남는다(1:1, bid_id UK).
        assertThat(moneyHoldRepository.count()).isEqualTo(ROUNDS);
        assertThat(bidCount(auction.getId())).isEqualTo(ROUNDS);
        // I4·I5: 금전 총량 보존. 밀려난 쪽은 한 푼도 묶여 있지 않다.
        assertMoneyConservation(alice, BALANCE);
        assertMoneyConservation(bob, BALANCE);
        assertThat(heldSum(winner == alice ? bob : alice)).isZero();
        assertAuctionAnchorInvariants(auction.getId());
    }

    /** 같은 두 사용자가 <b>동시에</b> 들이받아도 홀드 원장과 잔액은 갈라지지 않는다(I3·I4). */
    @Test
    void 두_사용자의_동시_교대_입찰에도_원장과_잔액이_갈라지지_않는다() throws Exception {
        User seller = persistUser("hold_cc_seller", "동시교대판매자", 0L);
        User alice = persistUser("hold_cc_a", "앨리스", BALANCE);
        User bob = persistUser("hold_cc_b", "밥", BALANCE);
        Auction auction = persistAuction(seller, 8402, secondsLater(3600));

        AtomicInteger success = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            User bidder = index % 2 == 0 ? alice : bob;
            String code = placeAndCaptureCode(bidder, auction.getPublicId(), START_PRICE + (long)index * STEP);
            if (code == null) {
                success.incrementAndGet();
            } else if (!"BID_001".equals(code) && !"BID_004".equals(code)) {
                // 두 사용자만 경쟁하므로 밀리면 증분 미달(BID_001) 또는 연속 입찰(BID_004)이다. 그 외는 결함이다.
                unexpected.add(code);
            }
        });

        assertThat(unexpected).isEmpty();
        assertThat(success.get()).isPositive();
        // I6: 거부된 입찰은 bid 행도 홀드도 남기지 않는다.
        assertThat(bidCount(auction.getId())).isEqualTo(success.get());
        assertThat(moneyHoldRepository.count()).isEqualTo(success.get());
        assertThat(heldCount()).isEqualTo(1);
        assertMoneyConservation(alice, BALANCE);
        assertMoneyConservation(bob, BALANCE);
        // 최고입찰자가 아닌 쪽은 반드시 0이다(직전 홀드 즉시 해제 — P-008).
        Auction finalAuction = reload(auction);
        User loser = finalAuction.getHighestBidder().getId().equals(alice.getId()) ? bob : alice;
        assertThat(heldSum(loser)).isZero();
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 시나리오 4 — 잔액 경계. 가용 잔액이 3건분뿐인 사용자가 <b>서로 다른 8개 경매</b>에 동시 입찰하면
     * 정확히 3건만 성립한다(I5).
     *
     * <p>경매가 전부 다르므로 경매 행 락은 이들을 직렬화하지 않는다 — 여기서 과다 홀드를 막는 것은 오직
     * {@code user_balance} 조건부 UPDATE(가용 잔액 이내에서만 성공)다. 즉 이 테스트는 <b>이중 방어의 두 번째
     * 축</b>만 따로 떼어 검증한다. 앱 선검사에 의존했다면 여기서 무너진다(TOCTOU).
     */
    @Test
    void 가용_잔액이_3건분인_사용자는_8개_경매_동시_입찰에서_정확히_3건만_성립한다() throws Exception {
        int auctionCount = 8;
        int affordable = 3;
        long amount = START_PRICE;
        User seller = persistUser("hold_lim_seller", "경계판매자", 0L);
        User bidder = persistUser("hold_lim_bidder", "빠듯한지갑", amount * affordable);
        List<Auction> auctions = new ArrayList<>();
        for (int i = 0; i < auctionCount; i++) {
            auctions.add(persistAuction(seller, 8410 + i, secondsLater(3600)));
        }

        AtomicInteger success = new AtomicInteger();
        AtomicInteger insufficient = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(auctionCount, index -> {
            String code = placeAndCaptureCode(bidder, auctions.get(index).getPublicId(), amount);
            if (code == null) {
                success.incrementAndGet();
            } else if ("BID_005".equals(code)) {
                insufficient.incrementAndGet();
            } else {
                unexpected.add(code);
            }
        });

        assertThat(unexpected).isEmpty();
        // 정확히 감당 가능한 만큼만 성립한다 — 한 건도 더도 덜도 아니다.
        assertThat(success.get()).isEqualTo(affordable);
        assertThat(insufficient.get()).isEqualTo(auctionCount - affordable);
        // I5: 가용 잔액이 정확히 0으로 바닥나되 음수가 되지 않는다.
        assertThat(balanceOf(bidder).getGameMoneyAvailable()).isZero();
        assertMoneyConservation(bidder, amount * affordable);
        // 거부된 입찰은 홀드도 bid 행도 남기지 않는다(I6).
        assertThat(moneyHoldRepository.count()).isEqualTo(affordable);
        assertThat(heldCount()).isEqualTo(affordable);
        for (Auction auction : auctions) {
            assertAuctionAnchorInvariants(auction.getId());
        }
        long totalBids = auctions.stream().mapToLong(auction -> bidCount(auction.getId())).sum();
        assertThat(totalBids).isEqualTo(affordable);
    }

    private long ledgerCount(MoneyHoldStatus status) {
        em.clear();
        return em.createQuery("SELECT COUNT(h) FROM MoneyHold h WHERE h.status = :status", Long.class)
            .setParameter("status", status)
            .getSingleResult();
    }
}
