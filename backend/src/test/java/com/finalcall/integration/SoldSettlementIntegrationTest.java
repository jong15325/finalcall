package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.ClosingTestBase;

/**
 * 낙찰(SOLD) 정산 통합 검증(settlement, FC-082) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>closing-domain-spec §4 전 절차와 불변식 I-A·I-B·I-D·I-E·I-H(게임머니 총량 보존)를 DB 상태로 고정한다.
 * 수수료 경계(cap·최소 저촉)를 포함한 매물에서도 총량이 보존되는지(§6 시나리오 #7)까지 검사한다.
 */
class SoldSettlementIntegrationTest extends ClosingTestBase {

    @Test
    void 입찰_1건_경매를_마감하면_낙찰_정산이_원자적으로_이뤄진다() {
        User seller = persistUser("sold_seller", "판매자", 0L);
        User winner = persistUser("sold_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9101);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));

        long price = 2_480_000L;
        placeBid(winner, auction.getPublicId(), price);
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long winnerBefore = balanceOf(winner).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        expireAuction(auction.getId(), now().minusSeconds(5));
        int closed = closeWorker.sweepOnce();

        assertThat(closed).isEqualTo(1);
        // I-A·I-B·I-D·I-E: 낙찰 상태·정산 금액·에스크로·소유 이전이 하나의 낙찰을 정합하게 가리킨다.
        assertSold(auction.getId(), winner, seller, sellerBefore, winnerBefore, price);
        // fee-policy-spec 검산: 2,480,000 → fee 110,200 · settle 2,369,800.
        assertThat(saleOrders(auction.getId()).get(0).getFeeAmount()).isEqualTo(110_200L);
        assertThat(saleOrders(auction.getId()).get(0).getSettleAmount()).isEqualTo(2_369_800L);
        // I-H: 게임머니 총량(잔액 합 + 수익 원장 합) 불변.
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void cap_저촉_고액_매물도_총량이_보존된다() {
        User seller = persistUser("sold_cap_seller", "판매자", 0L);
        User winner = persistUser("sold_cap_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9102);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));

        long price = 20_000_000L; // fee raw 641,000 → cap 300,000.
        placeBid(winner, auction.getPublicId(), price);
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long winnerBefore = balanceOf(winner).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        expireAuction(auction.getId(), now().minusSeconds(5));
        closeService.closeOne(auction.getId(), now());

        assertSold(auction.getId(), winner, seller, sellerBefore, winnerBefore, price);
        assertThat(saleOrders(auction.getId()).get(0).getFeeAmount()).isEqualTo(300_000L);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 최소_수수료_저촉_소액_매물도_총량이_보존된다() {
        User seller = persistUser("sold_min_seller", "판매자", 0L);
        User winner = persistUser("sold_min_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9103);
        // 시작가 1,000 → 낙찰가 1,000: 누진 60 < 최소 100 → fee 100.
        Auction auction = persistActiveAuction(seller, item, 1_000L, now().plusSeconds(3600));

        long price = 1_000L;
        placeBid(winner, auction.getPublicId(), price);
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long winnerBefore = balanceOf(winner).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        expireAuction(auction.getId(), now().minusSeconds(5));
        closeService.closeOne(auction.getId(), now());

        assertSold(auction.getId(), winner, seller, sellerBefore, winnerBefore, price);
        assertThat(saleOrders(auction.getId()).get(0).getFeeAmount()).isEqualTo(100L);
        assertThat(saleOrders(auction.getId()).get(0).getSettleAmount()).isEqualTo(900L);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }
}
