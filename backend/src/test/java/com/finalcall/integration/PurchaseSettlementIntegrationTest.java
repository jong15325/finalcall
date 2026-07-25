package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.AuctionErrorCode;
import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.entity.BidStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.PurchaseTestBase;

/**
 * 즉시구매(BUYNOW) 정산 통합 검증(settlement, FC-089) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>purchase-spec §3(동시성 절차)·§4(불변식 P-A~P-H)를 DB 상태로 고정한다. 구매자 직접 차감(홀드 미경유)·진행
 * 최고입찰 홀드 RELEASE+OUTBID·본인구매 허용·거부 경로(자기구매·미설정·잔액·미개시·종료)·게임머니 총량 보존을
 * 검사한다. 다른 테스트 템플릿과 충돌하지 않도록 <b>96xx 대역</b>을 쓴다.
 */
class PurchaseSettlementIntegrationTest extends PurchaseTestBase {

    @Test
    void 입찰_0건_경매를_즉시구매하면_구매자_직접차감으로_정산된다() {
        User seller = persistUser("buy_seller", "판매자", 0L);
        User buyer = persistUser("buy_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9601);
        long buyNow = 2_480_000L; // fee 110,200 · settle 2,369,800.
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore = balanceOf(buyer).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        purchase(buyer, auction.getPublicId());

        // P-A·P-B·P-D·P-E: 즉시구매 상태·정산 금액·직접 차감·소유 이전이 하나의 즉시구매를 정합하게 가리킨다.
        assertBuyNowSold(auction.getId(), buyer, seller, sellerBefore, buyerBefore, buyNow);
        assertThat(saleOrders(auction.getId()).get(0).getFeeAmount()).isEqualTo(110_200L);
        assertThat(saleOrders(auction.getId()).get(0).getSettleAmount()).isEqualTo(2_369_800L);
        // P-H: 게임머니 총량(잔액 합 + 수익 원장 합) 불변.
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 진행_입찰이_있는_경매를_즉시구매하면_패자_홀드가_해제되고_강등된다() {
        User seller = persistUser("buy_l_seller", "판매자", 0L);
        User loser = persistUser("buy_l_loser", "패자", BALANCE);
        User buyer = persistUser("buy_l_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9602);
        long buyNow = 3_000_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        placeBid(loser, auction.getPublicId(), 500_000L); // 패자 홀드 500,000.
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore = balanceOf(buyer).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        purchase(buyer, auction.getPublicId());

        // P-D: 구매자 직접 차감 + 패자 홀드 RELEASED + 패자 bid OUTBID.
        assertBuyNowSold(auction.getId(), buyer, seller, sellerBefore, buyerBefore, buyNow);
        assertThat(bidStatusCount(auction.getId(), BidStatus.OUTBID)).isEqualTo(1);
        // 패자 잔액은 홀드 해제로 원복(순 지불 0), held 0.
        assertThat(balanceOf(loser).getGameMoneyBalance()).isEqualTo(BALANCE);
        assertThat(balanceOf(loser).getGameMoneyHeld()).isZero();
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 최고_입찰자_본인이_즉시구매하면_자기_홀드를_풀고_즉시구매가만_지불한다() {
        User seller = persistUser("buy_self_seller", "판매자", 0L);
        User buyer = persistUser("buy_self_buyer", "최고입찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9603);
        long buyNow = 3_000_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        placeBid(buyer, auction.getPublicId(), 800_000L); // 본인 홀드 800,000(잔액 불변, held 800,000).
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        // 본인 구매 허용(§3.5): 패자 해제를 차감보다 앞세워 자기 홀드를 먼저 풀어야 available-gated 차감이 통과한다.
        purchase(buyer, auction.getPublicId());

        // 순 지불 = buyNow(홀드는 잠금일 뿐이라 balance 는 −buyNow 만). P-D·P-H.
        assertBuyNowSold(auction.getId(), buyer, seller, sellerBefore, BALANCE, buyNow);
        assertThat(bidStatusCount(auction.getId(), BidStatus.OUTBID)).isEqualTo(1);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 판매자_본인은_자기_경매를_즉시구매할_수_없다() {
        User seller = persistUser("buy_wash_seller", "판매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9604);
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, 1_000_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> purchase(seller, auction.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(AuctionErrorCode.AUCTION_SELF_PURCHASE);
        assertThat(reload(auction.getId()).getStatus().name()).isEqualTo("ACTIVE");
    }

    @Test
    void 즉시구매가가_없는_경매는_구매할_수_없다() {
        User seller = persistUser("buy_ns_seller", "판매자", 0L);
        User buyer = persistUser("buy_ns_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9605);
        // buyNowPrice 미설정(null) — persistActiveAuction 은 buyNow 를 세팅하지 않는다.
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> purchase(buyer, auction.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(AuctionErrorCode.AUCTION_BUY_NOW_NOT_SET);
    }

    @Test
    void 가용_게임머니가_부족하면_즉시구매가_거부된다() {
        User seller = persistUser("buy_poor_seller", "판매자", 0L);
        User buyer = persistUser("buy_poor_buyer", "구매자", 500_000L);
        ItemInstance item = persistListedItem(seller, 9606);
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, 1_000_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> purchase(buyer, auction.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(BidErrorCode.BID_INSUFFICIENT_BALANCE);
        // 거부는 부작용이 없어야 한다 — 잔액 불변·경매 미종결.
        assertThat(balanceOf(buyer).getGameMoneyBalance()).isEqualTo(500_000L);
        assertThat(reload(auction.getId()).getStatus().name()).isEqualTo("ACTIVE");
    }

    @Test
    void 미개시_예약_경매는_즉시구매할_수_없다() {
        User seller = persistUser("buy_sched_seller", "판매자", 0L);
        User buyer = persistUser("buy_sched_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9607);
        Auction auction = persistScheduledBuyNowAuction(
            seller, item, 100_000L, 1_000_000L, now().plusSeconds(1800), now().plusSeconds(3600));

        assertThatThrownBy(() -> purchase(buyer, auction.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(AuctionErrorCode.AUCTION_ALREADY_CLOSED);
    }

    @Test
    void 마감_시각이_지난_경매는_즉시구매할_수_없다() {
        User seller = persistUser("buy_end_seller", "판매자", 0L);
        User buyer = persistUser("buy_end_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9608);
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, 1_000_000L, now().plusSeconds(3600));
        expireAuction(auction.getId(), now().minusSeconds(5));

        assertThatThrownBy(() -> purchase(buyer, auction.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(AuctionErrorCode.AUCTION_ALREADY_CLOSED);
    }

    @Test
    void cap_저촉_고액과_최소수수료_저촉_소액_모두_총량이_보존된다() {
        User seller = persistUser("buy_cap_seller", "판매자", 0L);
        User buyer = persistUser("buy_cap_buyer", "구매자", BALANCE);
        ItemInstance capItem = persistListedItem(seller, 9609);
        long capBuyNow = 20_000_000L; // fee raw 641,000 → cap 300,000.
        Auction capAuction = persistBuyNowAuction(seller, capItem, 100_000L, capBuyNow, now().plusSeconds(3600));
        long total1 = totalGameMoneyPlusRevenue();
        long sellerBefore1 = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore1 = balanceOf(buyer).getGameMoneyBalance();

        purchase(buyer, capAuction.getPublicId());
        assertBuyNowSold(capAuction.getId(), buyer, seller, sellerBefore1, buyerBefore1, capBuyNow);
        assertThat(saleOrders(capAuction.getId()).get(0).getFeeAmount()).isEqualTo(300_000L);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(total1);
    }
}
