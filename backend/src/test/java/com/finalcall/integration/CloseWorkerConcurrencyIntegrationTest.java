package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidPlaceCommand;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.member.User;
import com.finalcall.support.ClosingTestBase;

/**
 * 마감 워커 동시성·idempotency 통합 검증(settlement, FC-082) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>closing-domain-spec §3 의 핵심 보증을 증거로 바꾼다: 행 락 하 재검증 + 종료성 CAS 로 <b>다중 인스턴스·재시도
 * 이중 처리가 성립하지 않고</b>(I-C·I-F), 소프트클로즈 막판 연장은 마감을 미룬다(I-G). 단언 대상은 테이블 상태다.
 */
class CloseWorkerConcurrencyIntegrationTest extends ClosingTestBase {

    private static final int THREADS = 16;

    @Test
    void 같은_경매를_동시에_N회_마감해도_낙찰_효과는_정확히_1회분만_남는다() throws Exception {
        User seller = persistUser("cc_idem_seller", "판매자", 0L);
        User winner = persistUser("cc_idem_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9301);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));

        long price = 500_000L;
        placeBid(winner, auction.getPublicId(), price);
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long winnerBefore = balanceOf(winner).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();
        expireAuction(auction.getId(), now().minusSeconds(5));

        Instant sweepNow = now();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            try {
                closeService.closeOne(auction.getId(), sweepNow);
            } catch (RuntimeException ex) {
                // 뒤늦게 락을 얻은 호출은 재검증에서 무부작용 return 해야 한다 — 예외가 나면 idempotency 결함이다.
                unexpected.add(ex.getClass().getSimpleName());
            }
        });

        // I-C·I-F: 동시 N회 호출에도 sale_order·CAPTURED·소유이전·수익원장이 정확히 1회분만 발생한다.
        assertThat(unexpected).isEmpty();
        assertSold(auction.getId(), winner, seller, sellerBefore, winnerBefore, price);
        assertThat(saleOrders(auction.getId())).hasSize(1);
        // I-H: 게임머니 총량 보존(이중 차감·이중 적립이 없어야 성립).
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 워커_tick_을_반복해도_이미_마감된_경매를_다시_처리하지_않는다() {
        User seller = persistUser("cc_rerun_seller", "판매자", 0L);
        User winner = persistUser("cc_rerun_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9302);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));
        placeBid(winner, auction.getPublicId(), 300_000L);
        long totalBefore = totalGameMoneyPlusRevenue();
        expireAuction(auction.getId(), now().minusSeconds(5));

        int first = closeWorker.sweepOnce();
        int second = closeWorker.sweepOnce();
        int third = closeWorker.sweepOnce();

        // 첫 tick 만 종결하고, 이후 tick 은 후보 스캔에서 이미 SOLD 라 잡히지 않는다(재처리 0).
        assertThat(first).isEqualTo(1);
        assertThat(second).isZero();
        assertThat(third).isZero();
        assertThat(saleOrders(auction.getId())).hasSize(1);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 소프트클로즈_막판_연장으로_마감이_밀린_경매는_그_tick에_마감되지_않는다() {
        User seller = persistUser("cc_soft_seller", "판매자", 0L);
        User winner = persistUser("cc_soft_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9303);
        // window 60s·extend 300s: 마감 10초 전 입찰이 마감을 now+300 으로 민다.
        Auction auction = persistAuction(seller, item, 100_000L, now().plusSeconds(10),
            AuctionStatus.ACTIVE, null, 60, 300);

        placeBid(winner, auction.getPublicId(), 200_000L);
        Instant extendedEndAt = reload(auction.getId()).getEndAt();
        // 연장이 실제로 일어났다(마감이 미래로 밀렸다).
        assertThat(extendedEndAt).isAfter(now().plusSeconds(60));

        // I-G: 연장으로 end_at 이 now 를 넘긴 경매는 그 tick 에 마감되지 않는다(락 스냅샷의 최신 end_at 근거).
        closeService.closeOne(auction.getId(), extendedEndAt.minusSeconds(100));
        assertThat(reload(auction.getId()).getStatus()).isEqualTo(AuctionStatus.ACTIVE);
        assertThat(saleOrders(auction.getId())).isEmpty();

        // 연장분이 지나면 다음 tick 이 정상 마감한다.
        closeService.closeOne(auction.getId(), extendedEndAt.plusSeconds(1));
        assertThat(reload(auction.getId()).getStatus()).isEqualTo(AuctionStatus.SOLD);
    }

    @Test
    void 마감된_경매에는_더_이상_입찰할_수_없다() {
        User seller = persistUser("cc_after_seller", "판매자", 0L);
        User winner = persistUser("cc_after_winner", "낙찰자", BALANCE);
        User late = persistUser("cc_after_late", "지각입찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9304);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));
        placeBid(winner, auction.getPublicId(), 300_000L);
        expireAuction(auction.getId(), now().minusSeconds(5));

        // 마감 후 입찰 경로(§6 시나리오 #5 직렬화 결과 B): 마감이 먼저면 이후 입찰은 거부된다.
        closeService.closeOne(auction.getId(), now());
        assertThat(reload(auction.getId()).getStatus()).isEqualTo(AuctionStatus.SOLD);

        authenticateAs(late.getId());
        try {
            assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(
                status -> bidService.place(new BidPlaceCommand(auction.getPublicId(), 400_000L))))
                .isInstanceOf(BusinessException.class);
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
        // 이중 정산 없음 — sale_order 는 여전히 1건.
        assertThat(saleOrders(auction.getId())).hasSize(1);
    }
}
