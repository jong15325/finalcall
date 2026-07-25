package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.ClosingTestBase;

/**
 * 유찰(UNSOLD) 통합 검증(settlement, FC-082) — closing-domain-spec §5, 불변식 I-A·I-E.
 *
 * <p>입찰 0건으로 마감된 경매가 아이템을 판매자에게 반환하고 sale_order 를 만들지 않는지 검사한다. 특히
 * <b>SCHEDULED 무입찰 마감</b>(§1.1 — 예약 경매가 입찰 0건으로 마감 시각을 지난 경우)을 포함한다.
 */
class UnsoldSettlementIntegrationTest extends ClosingTestBase {

    @Test
    void 입찰_0건_ACTIVE_경매를_마감하면_유찰_반환된다() {
        User seller = persistUser("unsold_seller", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9201);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));
        long totalBefore = totalGameMoneyPlusRevenue();

        expireAuction(auction.getId(), now().minusSeconds(5));
        int closed = closeWorker.sweepOnce();

        assertThat(closed).isEqualTo(1);
        assertUnsold(auction.getId(), seller);
        // 금전 이동 없음(홀드 0건) → 총량 자명 보존.
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 입찰_0건_SCHEDULED_예약경매도_마감_시각이_지나면_유찰된다() {
        User seller = persistUser("unsold_sched_seller", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9202);
        // 영속값 SCHEDULED 로 등록(start_at 미래) — 첫 입찰 없이 마감 시각을 지나면 영속값이 SCHEDULED 에 고인다(§1.1).
        Auction auction = persistAuction(seller, item, 100_000L, now().plusSeconds(3600),
            AuctionStatus.SCHEDULED, now().plusSeconds(1800), 1, 1);
        assertThat(reload(auction.getId()).getStatus()).isEqualTo(AuctionStatus.SCHEDULED);

        expireAuction(auction.getId(), now().minusSeconds(5));
        int closed = closeWorker.sweepOnce();

        // 후보 스캔이 SCHEDULED 도 포함하므로(§1.1) 예약 무입찰 경매도 UNSOLD 로 종결된다.
        assertThat(closed).isEqualTo(1);
        assertUnsold(auction.getId(), seller);
    }
}
