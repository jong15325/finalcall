package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.AuctionErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionResultType;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.PurchaseTestBase;

/**
 * 즉시구매 동시성 통합 검증(settlement, FC-089) — 실제 MySQL(Testcontainers), 실제 커밋. purchase-spec §3.1 동일
 * auction 행 배타 락으로 즉시구매·마감이 직렬화되는지, 이중 정산이 없는지(P-C)를 DB 상태로 고정한다.
 *
 * <p>다른 테스트 템플릿과 충돌하지 않도록 <b>97xx 대역</b>을 쓴다.
 */
class PurchaseConcurrencyIntegrationTest extends PurchaseTestBase {

    @Test
    void 두_구매자가_동시에_즉시구매하면_선착_1건만_성립하고_후착은_AUCTION_006() throws InterruptedException {
        User seller = persistUser("pc_seller", "판매자", 0L);
        User buyerA = persistUser("pc_buyer_a", "구매자A", BALANCE);
        User buyerB = persistUser("pc_buyer_b", "구매자B", BALANCE);
        List<User> buyers = List.of(buyerA, buyerB);
        ItemInstance item = persistListedItem(seller, 9701);
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));
        long totalBefore = totalGameMoneyPlusRevenue();

        AtomicInteger success = new AtomicInteger();
        AtomicInteger closedConflict = new AtomicInteger();
        runConcurrently(2, index -> {
            try {
                purchase(buyers.get(index), auction.getPublicId());
                success.incrementAndGet();
            } catch (BusinessException ex) {
                if (ex.getErrorCode() == AuctionErrorCode.AUCTION_ALREADY_CLOSED) {
                    closedConflict.incrementAndGet();
                }
            }
        });

        // P-C: 정확히 1건 성립, 후착은 재검증에서 종료 상태 → AUCTION_006.
        assertThat(success.get()).isEqualTo(1);
        assertThat(closedConflict.get()).isEqualTo(1);

        em.clear();
        Auction closed = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(closed.getResultType()).isEqualTo(AuctionResultType.BUYNOW);
        // sale_order 정확히 1건 · 총량 보존 · 정확히 한 구매자만 차감됐다.
        assertThat(saleOrders(auction.getId())).hasSize(1);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
        long charged = buyers.stream().filter(b -> balanceOf(b).getGameMoneyBalance() == BALANCE - buyNow).count();
        assertThat(charged).isEqualTo(1);
    }

    @Test
    void 즉시구매와_마감워커가_같은_경매를_노려도_이중정산이_없다() throws InterruptedException {
        User seller = persistUser("pc_race_seller", "판매자", 0L);
        User bidder = persistUser("pc_race_bidder", "입찰자", BALANCE);
        User buyer = persistUser("pc_race_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9702);
        long buyNow = 3_000_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));
        placeBid(bidder, auction.getPublicId(), 500_000L);
        // 마감 시각을 과거로 당긴다 — 즉시구매는 live(end_at>now) 실패, 마감은 expired(end_at<=now) 성립으로 시간축 배타.
        expireAuction(auction.getId(), now().minusSeconds(5));
        long totalBefore = totalGameMoneyPlusRevenue();

        AtomicInteger purchaseFailed = new AtomicInteger();
        runConcurrently(2, index -> {
            if (index == 0) {
                try {
                    purchase(buyer, auction.getPublicId());
                } catch (BusinessException ex) {
                    purchaseFailed.incrementAndGet();
                }
            } else {
                closeService.closeOne(auction.getId(), now());
            }
        });

        // 시간축 배타 분할(§3.3): expired 라 즉시구매는 반드시 실패하고 마감이 SOLD/BID 로 성립한다.
        assertThat(purchaseFailed.get()).isEqualTo(1);
        em.clear();
        Auction closed = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(closed.getResultType()).isEqualTo(AuctionResultType.BID);
        // P-C: 이중 정산 없음 — sale_order 정확히 1건, 총량 보존.
        assertThat(saleOrders(auction.getId())).hasSize(1);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }
}
