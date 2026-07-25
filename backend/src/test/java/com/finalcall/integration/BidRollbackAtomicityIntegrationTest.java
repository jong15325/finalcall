package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.bid.dto.BidPlaceCommand;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 입찰 트랜잭션 원자성 검증(bid, FC-034) — 불변식 <b>I6</b>(실패는 어떤 흔적도 남기지 않는다).
 *
 * <p>게이트2 (b)가 확정한 것은 "검증 → 입찰 기록 → 홀드 → 직전 홀드 해제 → 최고가·연장 갱신이 <b>전부 하나의
 * 트랜잭션</b>"이라는 경계다. 그 경계가 실제로 하나인지는 <b>롤백시켜 봐야</b> 안다 — 홀드가 자체 트랜잭션으로
 * 독립 커밋되는 배선(예: {@code REQUIRES_NEW})이면 입찰이 롤백돼도 자금이 묶인 채 남고, 그 결함은 정상 경로
 * 테스트로는 절대 드러나지 않는다.
 *
 * <p>여기서는 {@code setRollbackOnly} 로 <b>성공한 입찰을 통째로 되돌려</b> 다섯 테이블 효과(bid·money_hold·
 * user_balance·auction 최고가·auction 마감)가 전부 사라지는지 본다. 홀드만 살아남으면 즉시 실패한다.
 *
 * <p>※ 이 검증은 <b>비-트랜잭션 테스트에서만</b> 유효하다. 테스트 자체가 {@code @Transactional} 이면 요청이
 * 테스트 트랜잭션에 참여해 rollback-only 표시만 남고 이미 flush 된 INSERT 가 실제로는 되돌아가지 않는다.
 */
class BidRollbackAtomicityIntegrationTest extends BidConcurrencyTestBase {

    private static final int THREADS = 16;

    /**
     * 첫 입찰이 성립한 트랜잭션을 롤백하면 <b>홀드까지 함께</b> 사라진다 — 홀드가 별도 트랜잭션이 아님을 증명한다.
     */
    @Test
    void 성립한_입찰_트랜잭션을_롤백하면_홀드도_최고가도_남지_않는다() throws Exception {
        User seller = persistUser("rb_one_seller", "롤백판매자", 0L);
        User bidder = persistUser("rb_one_bidder", "롤백입찰자", BALANCE);
        Auction auction = persistAuction(seller, 8701, secondsLater(3600));

        placeThenRollback(bidder, auction.getPublicId(), START_PRICE);

        assertThat(bidCount(auction.getId())).isZero();
        assertThat(moneyHoldRepository.count()).isZero();
        // 잔액도 원복 — 홀드 UPDATE 가 입찰과 같은 트랜잭션이 아니었다면 여기가 START_PRICE 로 남는다.
        assertMoneyConservation(bidder, BALANCE);
        Auction finalAuction = reload(auction);
        assertThat(finalAuction.getHighestBidAmount()).isNull();
        assertThat(finalAuction.getHighestBidder()).isNull();
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 상위 입찰 트랜잭션을 롤백하면 <b>직전 홀드가 HELD 로 되살아난다</b>(P-008 즉시 해제도 같은 경계 안이다).
     *
     * <p>해제가 별도 트랜잭션이었다면 "직전 입찰자의 홀드는 풀렸는데 새 입찰은 없는" 상태가 남는다 — 최고입찰자가
     * 자금을 묶지 않은 채 최고가를 유지하는, 겉보기로는 정상인 무자본 상태다.
     */
    @Test
    void 상위_입찰_트랜잭션을_롤백하면_직전_홀드가_되살아난다() throws Exception {
        User seller = persistUser("rb_two_seller", "해제판매자", 0L);
        User first = persistUser("rb_two_a", "선입찰자", BALANCE);
        User second = persistUser("rb_two_b", "후입찰자", BALANCE);
        Auction auction = persistAuction(seller, 8702, secondsLater(3600));
        placeInTransaction(first, auction.getPublicId(), START_PRICE);

        placeThenRollback(second, auction.getPublicId(), START_PRICE + STEP);

        // 직전 입찰자의 홀드가 그대로 살아 있다(RELEASED 로 남지 않았다).
        assertThat(heldSum(first)).isEqualTo(START_PRICE);
        assertThat(heldSum(second)).isZero();
        assertThat(heldCount()).isEqualTo(1);
        assertThat(moneyHoldRepository.count()).isEqualTo(1);
        assertThat(bidCount(auction.getId())).isEqualTo(1);
        assertMoneyConservation(first, BALANCE);
        assertMoneyConservation(second, BALANCE);
        // 최고가도 직전 입찰 그대로다.
        assertThat(reload(auction).getHighestBidAmount()).isEqualTo(START_PRICE);
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 동시 다발 실패도 흔적을 남기지 않는다 — 잔액이 전혀 없는 {@value #THREADS} 명이 한꺼번에 들이받는다.
     *
     * <p>{@code bid} INSERT 는 홀드보다 <b>먼저</b> 실행되므로(money_hold.bid_id 가 NOT NULL FK + UK), 이 경로는
     * "행을 하나 쓴 뒤 실패"하는 구조다. 트랜잭션 경계가 어긋나면 고아 {@code bid} 행이 남는다.
     */
    @Test
    void 잔액_부족_동시_입찰은_bid_행도_홀드도_하나도_남기지_않는다() throws Exception {
        User seller = persistUser("rb_bulk_seller", "무일푼판매자", 0L);
        Auction auction = persistAuction(seller, 8703, secondsLater(3600));
        List<User> paupers = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            paupers.add(persistUser("rb_bulk_" + i, "무일푼" + i, 0L));
        }

        List<String> codes = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            String code = placeAndCaptureCode(paupers.get(index), auction.getPublicId(), START_PRICE);
            codes.add(code == null ? "성공" : code);
        });

        assertThat(codes).hasSize(THREADS).containsOnly("BID_005");
        assertThat(bidCount(auction.getId())).isZero();
        assertThat(moneyHoldRepository.count()).isZero();
        for (User pauper : paupers) {
            assertMoneyConservation(pauper, 0L);
        }
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 입찰을 성립시킨 뒤 <b>바깥 트랜잭션을 롤백</b>한다.
     *
     * <p>{@code BidService.place} 는 {@code Propagation.REQUIRED} 라 이 템플릿의 트랜잭션에 참여한다. 따라서
     * {@code setRollbackOnly} 하나로 입찰이 만든 모든 효과가 함께 되돌아가야 한다 — 되돌아가지 않는 효과가 있다면
     * 그것이 곧 경계 밖으로 새어나간 쓰기다.
     */
    private void placeThenRollback(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(status -> {
                bidService.place(new BidPlaceCommand(auctionPublicId, amount));
                status.setRollbackOnly();
            });
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
