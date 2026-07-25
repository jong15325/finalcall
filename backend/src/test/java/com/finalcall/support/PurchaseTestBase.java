package com.finalcall.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionResultType;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.settlement.PurchaseResult;
import com.finalcall.domain.settlement.PurchaseService;
import com.finalcall.domain.settlement.SaleOrder;

/**
 * 즉시구매 통합 테스트 공통 기반(FC-089) — {@link ClosingTestBase} 픽스처/불변식 단언을 승계하고 즉시구매 전용
 * 픽스처(buyNow 경매)·헬퍼(구매 실행)·불변식 단언(P-A~P-H, purchase-spec §4)을 더한다.
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다</b>(closing-domain-spec §6 서문 승계). {@code @Transactional} 을
 * 걸지 않으므로 각 구매가 실제 커밋돼 idempotency·총량 보존을 검증할 수 있다.
 */
public abstract class PurchaseTestBase extends ClosingTestBase {

    @Autowired
    protected PurchaseService purchaseService;

    // ---------------- 픽스처 ----------------

    /** 즉시구매가가 설정된 진행 중(ACTIVE) 경매. 소프트클로즈 비저촉. */
    protected Auction persistBuyNowAuction(User seller, ItemInstance item, long startPrice, long buyNowPrice,
        Instant endAt) {
        return auctionRepository.save(Auction.builder()
            .seller(seller).itemInstance(item).startPrice(startPrice).buyNowPrice(buyNowPrice)
            .status(AuctionStatus.ACTIVE).startAt(null).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(1).softCloseExtendSec(1)
            .itemNameSnapshot("구매템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    /** 예약(SCHEDULED) 미개시 buyNow 경매(startAt 미래). */
    protected Auction persistScheduledBuyNowAuction(User seller, ItemInstance item, long startPrice, long buyNowPrice,
        Instant startAt, Instant endAt) {
        return auctionRepository.save(Auction.builder()
            .seller(seller).itemInstance(item).startPrice(startPrice).buyNowPrice(buyNowPrice)
            .status(AuctionStatus.SCHEDULED).startAt(startAt).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(1).softCloseExtendSec(1)
            .itemNameSnapshot("예약구매템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    /** 즉시구매를 독립 트랜잭션으로 커밋한다(테스트가 비-트랜잭션이라 명시적 경계가 필요하다). */
    protected PurchaseResult purchase(User buyer, String auctionPublicId) {
        authenticateAs(buyer.getId());
        try {
            return transactionTemplate.execute(status -> purchaseService.purchase(auctionPublicId));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ---------------- 불변식 단언(purchase-spec §4) ----------------

    /**
     * P-A·P-B·P-D·P-E — 즉시구매(BUYNOW) 성립 상태를 검사한다. auction·sale_order·user_balance·item 이 하나의
     * 즉시구매를 정합하게 가리키는지 본다(구매자 직접 차감·홀드 미경유).
     *
     * @param auctionId   즉시구매된 경매 PK
     * @param buyer       구매자
     * @param seller      판매자
     * @param sellerBefore 정산 전 판매자 잔액
     * @param buyerBefore  구매 전 구매자 잔액(홀드 없는 순수 잔액)
     * @param price       즉시구매가(= final_price)
     */
    protected void assertBuyNowSold(Long auctionId, User buyer, User seller,
        long sellerBefore, long buyerBefore, long price) {
        em.clear();
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        // P-A: SOLD ⟺ result_type=BUYNOW ∧ sale_order 1건. 즉시구매는 highest_bidder 를 세팅하지 않는다.
        assertThat(auction.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(auction.getResultType()).isEqualTo(AuctionResultType.BUYNOW);

        List<SaleOrder> orders = saleOrders(auctionId);
        assertThat(orders).hasSize(1);
        SaleOrder order = orders.get(0);
        // P-B: final = settle + fee, final = 즉시구매가.
        assertThat(order.getFinalPrice()).isEqualTo(price);
        assertThat(order.getSettleAmount() + order.getFeeAmount()).isEqualTo(price);
        assertThat(order.getBuyer().getId()).isEqualTo(buyer.getId());
        assertThat(order.getSeller().getId()).isEqualTo(seller.getId());
        long fee = order.getFeeAmount();
        long settle = order.getSettleAmount();

        // P-D: 구매자 balance −price(홀드 미경유, held 불변 0) · 판매자 +settle · 경매에 ACTIVE bid·HELD hold 0건.
        assertThat(bidStatusCount(auctionId, BidStatus.ACTIVE)).isZero();
        assertThat(heldCount(auctionId)).isZero();
        assertThat(capturedCount(auctionId)).isZero(); // 즉시구매는 capture 를 쓰지 않는다.
        UserBalance buyerBalance = balanceOf(buyer);
        assertThat(buyerBalance.getGameMoneyBalance()).isEqualTo(buyerBefore - price);
        assertThat(buyerBalance.getGameMoneyHeld()).isZero();
        assertThat(balanceOf(seller).getGameMoneyBalance()).isEqualTo(sellerBefore + settle);

        // P-E: 아이템 소유가 구매자로 이전 · 위치 INVENTORY/TEMP · 이력 append(seller→buyer, TRADE, sale_order_id).
        ItemInstance item = itemInstanceRepository.findById(auction.getItemInstance().getId()).orElseThrow();
        assertThat(item.getOwner().getId()).isEqualTo(buyer.getId());
        assertThat(item.getLocation()).isIn(ItemLocation.INVENTORY, ItemLocation.TEMP);
        List<Object[]> history = tradeHistory(item.getId());
        assertThat(history).hasSize(1);
        assertThat((Long)history.get(0)[0]).isEqualTo(seller.getId()); // from_owner
        assertThat((Long)history.get(0)[1]).isEqualTo(buyer.getId()); // to_owner
        assertThat((Long)history.get(0)[2]).isEqualTo(order.getId()); // sale_order_id

        // P-B 재현: fee 가 수익 원장에도 동일 값 1행.
        assertThat(revenueLedgerAmount(order.getId())).isEqualTo(fee);
    }
}
