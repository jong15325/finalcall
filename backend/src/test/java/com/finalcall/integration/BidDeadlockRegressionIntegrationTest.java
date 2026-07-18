package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.bid.BidPlaceCommand;
import com.finalcall.domain.member.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 잔액 행 락 순서 데드락 회귀(bid, FC-034) — bid-domain-spec §10 시나리오 7, §4.4 집행 규칙.
 *
 * <p><b>재현하려는 결함</b>: 입찰 1건은 서로 다른 두 {@code user_balance} 행에 배타 락을 건다(신규 입찰자 hold +
 * 직전 입찰자 release). 두 사용자가 서로 다른 두 경매에서 <b>교차로 상대를 밀어내면</b> 락 획득 순서가 역전돼
 * 순환 대기가 성립한다 — 경매 X 에서 U1→U2 로 잡는 동안 경매 Y 에서 U2→U1 로 잡는 구도다. 경매 행 락은 서로
 * 다른 행이라 이 교차를 막아주지 못한다.
 *
 * <p><b>방어</b>: 두 잔액 갱신을 {@code user_id} 오름차순으로 수행해 전역 락 순서를 하나로 고정한다. 순서가
 * 하나면 순환이 성립할 수 없다. 이 테스트는 그 순서 강제가 <b>제거되면 깨지는</b> 자리를 고정한다.
 *
 * <p>백스톱까지 함께 본다 — 만에 하나 DB 가 희생자를 롤백시키면 {@code PessimisticLockingFailureException}
 * (→ {@code COMMON_004}, 409)으로 매핑되고 정합성은 롤백으로 보존돼야 한다. 즉 <b>어떤 결말이든 원장·잔액은
 * 갈라지지 않는다</b>.
 */
class BidDeadlockRegressionIntegrationTest extends BidConcurrencyTestBase {

    private static final int ROUNDS = 15;
    private static final long CROSS_STEP = 2_000L;

    @Test
    void 두_사용자가_두_경매에서_교차로_밀어내도_데드락이_발생하지_않는다() throws Exception {
        User seller = persistUser("dl_seller", "교차판매자", 0L);
        User first = persistUser("dl_u1", "교차U1", BALANCE);
        User second = persistUser("dl_u2", "교차U2", BALANCE);
        Auction auctionX = persistAuction(seller, 8601, secondsLater(3600));
        Auction auctionY = persistAuction(seller, 8602, secondsLater(3600));

        // 초기 배치 — X 의 최고입찰자는 U2, Y 의 최고입찰자는 U1. 이제부터 매 라운드가 서로를 밀어낸다.
        placeInTransaction(second, auctionX.getPublicId(), START_PRICE);
        placeInTransaction(first, auctionY.getPublicId(), START_PRICE);

        AtomicInteger lockFailures = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        for (int round = 0; round < ROUNDS; round++) {
            long amount = START_PRICE + (long)(round + 1) * CROSS_STEP;
            // 라운드마다 역할이 뒤바뀐다: X 를 미는 쪽이 Y 에서는 밀려나는 쪽이다 = 항상 교차 구도가 유지된다.
            User bidderOnX = round % 2 == 0 ? first : second;
            User bidderOnY = round % 2 == 0 ? second : first;
            AtomicInteger success = new AtomicInteger();
            AtomicInteger roundLocks = new AtomicInteger();

            runConcurrently(2, index -> {
                User bidder = index == 0 ? bidderOnX : bidderOnY;
                String publicId = index == 0 ? auctionX.getPublicId() : auctionY.getPublicId();
                String outcome = placeAndClassify(bidder, publicId, amount);
                if (outcome == null) {
                    success.incrementAndGet();
                } else if ("LOCK".equals(outcome)) {
                    roundLocks.incrementAndGet();
                    lockFailures.incrementAndGet();
                } else {
                    unexpected.add(outcome);
                }
            });

            // ★ 라운드마다 즉시 확인한다. 마지막에 몰아서 보면 첫 데드락이 다음 라운드의 역할 배치를 어긋나게
            //   만들어 BID_004 같은 <b>2차 증상</b>으로 실패하고, 원인이 데드락이라는 사실이 가려진다.
            assertThat(roundLocks.get())
                .as("라운드 %d 락 경합 실패 — user_id 오름차순 락 순서(§4.4)가 깨졌다", round)
                .isZero();
            // 교차 입찰은 어느 쪽도 서로의 성립 조건을 침범하지 않는다 — 데드락만 없다면 둘 다 성립해야 한다.
            assertThat(unexpected).isEmpty();
            assertThat(success.get()).isEqualTo(2);
        }

        // ★ §4.4 순서 강제가 살아 있으면 순환 대기가 성립할 수 없다 — 락 실패는 0이어야 한다.
        assertThat(lockFailures.get()).isZero();

        long finalAmount = START_PRICE + (long)ROUNDS * CROSS_STEP;
        User winnerOnX = ROUNDS % 2 == 0 ? second : first; // 마지막 라운드는 ROUNDS-1
        User winnerOnY = ROUNDS % 2 == 0 ? first : second;

        // 결말이 무엇이든 원장·잔액은 갈라지지 않는다(I3·I4·I5).
        assertAuctionAnchorInvariants(auctionX.getId());
        assertAuctionAnchorInvariants(auctionY.getId());
        assertMoneyConservation(first, BALANCE);
        assertMoneyConservation(second, BALANCE);
        assertThat(reload(auctionX).getHighestBidder().getId()).isEqualTo(winnerOnX.getId());
        assertThat(reload(auctionY).getHighestBidder().getId()).isEqualTo(winnerOnY.getId());
        // 각 사용자는 자기가 이기고 있는 경매 1건분만 묶여 있다(직전 홀드 즉시 해제 — P-008).
        assertThat(heldSum(first)).isEqualTo(finalAmount);
        assertThat(heldSum(second)).isEqualTo(finalAmount);
        assertThat(heldCount()).isEqualTo(2);
    }

    /**
     * 입찰 결과를 분류한다 — 성공 {@code null} / 락 경합 {@code "LOCK"} / 그 외는 에러코드·예외명.
     *
     * <p>{@link PessimisticLockingFailureException} 을 따로 잡는 이유는 그것이 데드락·락 대기 timeout 의 공통
     * 상위이고, 전역 핸들러가 이 타입을 {@code COMMON_004}(409)로 매핑하기 때문이다. 다른 실패와 뭉뚱그리면
     * "데드락이 났는데 테스트는 통과"하는 상태가 만들어진다.
     */
    private String placeAndClassify(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                statusCallback -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
            return null;
        } catch (PessimisticLockingFailureException ex) {
            return "LOCK";
        } catch (BusinessException ex) {
            return ex.getErrorCode().getCode();
        } catch (RuntimeException ex) {
            return ex.getClass().getSimpleName();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
