package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionService;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 판매자 취소 vs 첫 입찰 경합 검증(auction·bid, FC-034) — bid-domain-spec §10 시나리오 5, 불변식 <b>I9</b>.
 *
 * <p>두 가지를 동시에 본다. (1) <b>상호배제</b> — 취소 성공과 입찰 성립은 절대 공존하지 않는다. (2) <b>에러코드
 * 정확성</b> — 취소가 밀렸을 때 {@code AUCTION_007}(입찰 존재)로 분류돼야지 {@code AUCTION_006}(이미 종료)이면
 * 안 된다. 후자는 정합성 결함이 아니라 <b>오분류</b>지만, 판매자에게 "왜 취소가 안 되는지"를 거짓으로 알려주는
 * 결함이라 회귀로 고정한다(§4.6, EPIC-AUCTION 인계 정정분).
 *
 * <p>승자는 실행마다 달라진다 — 그래서 어느 한쪽을 기대하지 않고 <b>두 결말 각각에 대해</b> 성립해야 할 상태를
 * 전부 단언한다. 라운드를 반복해 양쪽 결말이 모두 밟히도록 한다(둘 중 하나만 나와도 단언은 성립한다).
 */
class AuctionCancelVsBidConcurrencyIntegrationTest extends BidConcurrencyTestBase {

    private static final int ROUNDS = 6;
    private static final int BID_THREADS = 4;

    @Autowired
    private AuctionService auctionService;

    @Test
    void 취소와_첫_입찰이_경합하면_정확히_한쪽만_성립하고_실패한_취소는_AUCTION_007이다() throws Exception {
        User seller = persistUser("cvb_seller", "취소경합판매자", 0L);
        List<User> bidders = new ArrayList<>();
        for (int i = 0; i < BID_THREADS; i++) {
            bidders.add(persistUser("cvb_bidder_" + i, "취소경합입찰자" + i, BALANCE));
        }

        for (int round = 0; round < ROUNDS; round++) {
            Auction auction = persistAuction(seller, 8521 + round, secondsLater(3600));
            // 홀수 라운드는 입찰 1건을 미리 커밋해 <b>취소가 반드시 밀리는 쪽</b>을 결정적으로 만든다. 이렇게 하지
            //   않으면 실행마다 취소가 계속 이겨 AUCTION_007 분기가 한 번도 밟히지 않을 수 있다(무증상 미검증).
            boolean bidCommittedFirst = round % 2 == 1;
            int preBids = bidCommittedFirst ? 1 : 0;
            if (bidCommittedFirst) {
                placeInTransaction(bidders.get(0), auction.getPublicId(), START_PRICE);
            }

            AtomicReference<String> cancelCode = new AtomicReference<>();
            AtomicInteger bidSuccess = new AtomicInteger();
            List<String> unexpected = new CopyOnWriteArrayList<>();

            List<Runnable> tasks = new ArrayList<>();
            tasks.add(() -> cancelCode.set(cancelAndCaptureCode(seller, auction.getPublicId())));
            for (int i = 0; i < BID_THREADS; i++) {
                final int index = i;
                tasks.add(() -> {
                    String code = placeAndCaptureCode(
                        bidders.get(index), auction.getPublicId(), START_PRICE + (long)(index + 1) * STEP);
                    if (code == null) {
                        bidSuccess.incrementAndGet();
                    } else if (!"BID_001".equals(code) && !"BID_004".equals(code) && !"BID_006".equals(code)) {
                        // 취소가 이겼으면 BID_006, 다른 입찰에 밀렸으면 BID_001, 선입찰자가 자기 위에 또 걸면
                        //   BID_004 다. 그 외 코드는 전부 결함이다.
                        unexpected.add(code);
                    }
                });
            }
            runConcurrently(tasks);

            assertThat(unexpected).isEmpty();
            Auction finalAuction = reload(auction);
            if (bidCommittedFirst) {
                // 이 라운드의 결말은 고정이다 — 취소는 "이미 종료"가 아니라 "입찰 존재"여야 한다.
                assertThat(cancelCode.get()).isEqualTo("AUCTION_007");
            }
            if (cancelCode.get() == null) {
                // 취소가 이겼다 — 입찰은 단 한 건도 성립하지 않았고 자금도 묶이지 않았다.
                assertThat(finalAuction.getStatus()).isEqualTo(AuctionStatus.CANCELLED);
                assertThat(finalAuction.getHighestBidder()).isNull();
                assertThat(finalAuction.getHighestBidAmount()).isNull();
                assertThat(bidSuccess.get()).isZero();
                assertThat(bidCount(auction.getId())).isZero();
                assertThat(heldRows(auction.getId())).isEmpty();
            } else {
                // 입찰이 이겼다 — 취소는 "이미 종료"가 아니라 "입찰 존재"로 정확히 분류된다(§4.6 정정분).
                assertThat(cancelCode.get()).isEqualTo("AUCTION_007");
                assertThat(finalAuction.getStatus()).isNotEqualTo(AuctionStatus.CANCELLED);
                assertThat(bidSuccess.get() + preBids).isPositive();
                assertThat(bidCount(auction.getId())).isEqualTo(bidSuccess.get() + preBids);
            }
            assertAuctionAnchorInvariants(auction.getId());
            for (User bidder : bidders) {
                assertMoneyConservation(bidder, BALANCE);
            }
        }
    }

    /**
     * 입찰이 이미 성립한 경매의 취소는 <b>항상</b> {@code AUCTION_007} 이다(경합이 없는 결정적 경로).
     *
     * <p>위 경합 테스트는 실행마다 승자가 갈리므로, 오분류 회귀를 결정적으로도 한 번 못 박는다.
     */
    @Test
    void 입찰이_있는_경매의_취소는_AUCTION_007로_거부된다() throws Exception {
        User seller = persistUser("cvb_det_seller", "결정판매자", 0L);
        User bidder = persistUser("cvb_det_bidder", "결정입찰자", BALANCE);
        Auction auction = persistAuction(seller, 8530, secondsLater(3600));
        placeInTransaction(bidder, auction.getPublicId(), START_PRICE);

        assertThat(cancelAndCaptureCode(seller, auction.getPublicId())).isEqualTo("AUCTION_007");

        Auction finalAuction = reload(auction);
        assertThat(finalAuction.getStatus()).isNotEqualTo(AuctionStatus.CANCELLED);
        assertThat(heldSum(bidder)).isEqualTo(START_PRICE);
        assertAuctionAnchorInvariants(auction.getId());
    }

    /** 취소를 독립 트랜잭션으로 실행하고 결과를 에러코드로 돌려준다(성공이면 {@code null}). */
    private String cancelAndCaptureCode(User seller, String auctionPublicId) {
        authenticateAs(seller.getId());
        try {
            transactionTemplate.executeWithoutResult(
                statusCallback -> auctionService.cancel(auctionPublicId));
            return null;
        } catch (BusinessException ex) {
            return ex.getErrorCode().getCode();
        } catch (RuntimeException ex) {
            return ex.getClass().getSimpleName();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
