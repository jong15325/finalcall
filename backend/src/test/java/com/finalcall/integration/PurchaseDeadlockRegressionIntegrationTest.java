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
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.PurchaseTestBase;

/**
 * 즉시구매 잔액 락 순서 데드락 회귀(settlement, FC-089) — purchase-spec §7-A4, §3.5. 입찰 경로의
 * {@code BidDeadlockRegressionIntegrationTest}(§4.4)를 즉시구매로 본뜬다.
 *
 * <p><b>재현하려는 결함</b>: 즉시구매 1건은 서로 다른 최대 3개 {@code user_balance} 행(buyer·seller·loser)에 배타
 * 락을 건다. 두 사용자가 <b>서로의 경매를 동시에 즉시구매</b>하면(교차거래) 락 획득 순서가 역전돼 순환 대기가
 * 성립한다 — 경매 X 에서 Bob→Alice, 경매 Y 에서 Alice→Bob 로 잡는 구도다. 경매 행 락은 서로 다른 행이라 막지
 * 못한다. 즉시구매×입찰 교차(공유 잔액 2행을 반대 순서로)도 동일 표면이다.
 *
 * <p><b>방어</b>: 잔액 갱신을 {@code user_id} 오름차순으로 수행해 전역 락 순서를 하나로 고정한다(A4). 순서가
 * 하나면 순환이 성립할 수 없다. 이 테스트는 그 순서 강제가 <b>제거되면 깨지는</b> 자리를 고정한다 — 락 실패
 * ({@link PessimisticLockingFailureException} → {@code COMMON_004}) == 0.
 */
class PurchaseDeadlockRegressionIntegrationTest extends PurchaseTestBase {

    private static final int ROUNDS = 12;
    private static final long BUY_NOW = 100_000L;
    private static final long START_PRICE = 10_000L;

    @Test
    void 두_사용자가_서로의_경매를_동시에_즉시구매해도_데드락이_없다() throws Exception {
        User alice = persistUser("pdl_alice", "앨리스", BALANCE);
        User bob = persistUser("pdl_bob", "밥", BALANCE);

        AtomicInteger lockFailures = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        for (int round = 0; round < ROUNDS; round++) {
            // X: 판매자 Alice·구매자 Bob(잔액 행 Bob·Alice). Y: 판매자 Bob·구매자 Alice(잔액 행 Alice·Bob) = 교차.
            ItemInstance itemA = persistListedItem(alice, 8801);
            Auction auctionX = persistBuyNowAuction(alice, itemA, START_PRICE, BUY_NOW, now().plusSeconds(3600));
            ItemInstance itemB = persistListedItem(bob, 8802);
            Auction auctionY = persistBuyNowAuction(bob, itemB, START_PRICE, BUY_NOW, now().plusSeconds(3600));

            AtomicInteger success = new AtomicInteger();
            AtomicInteger roundLocks = new AtomicInteger();
            runConcurrently(2, index -> {
                String outcome = index == 0
                    ? purchaseAndClassify(bob, auctionX.getPublicId())
                    : purchaseAndClassify(alice, auctionY.getPublicId());
                classify(outcome, success, roundLocks, lockFailures, unexpected);
            });

            // 라운드마다 즉시 확인한다(2차 증상으로 원인이 가려지지 않게, bid 회귀 선례).
            assertThat(roundLocks.get())
                .as("라운드 %d 락 경합 실패 — user_id 오름차순 락 순서(§7-A4)가 깨졌다", round)
                .isZero();
            assertThat(unexpected).isEmpty();
            // 서로 다른 경매라 어느 쪽도 상대의 성립 조건을 침범하지 않는다 — 데드락만 없으면 둘 다 성립한다.
            assertThat(success.get()).isEqualTo(2);
        }
        assertThat(lockFailures.get()).isZero();
    }

    @Test
    void 즉시구매와_입찰이_공유_잔액행을_교차로_잡아도_데드락이_없다() throws Exception {
        User u1 = persistUser("pdl_u1", "교차구매U1", BALANCE);
        User u2 = persistUser("pdl_u2", "교차입찰U2", BALANCE);
        User seller1 = persistUser("pdl_s1", "판매S1", 0L);
        User seller2 = persistUser("pdl_s2", "판매S2", 0L);

        AtomicInteger lockFailures = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        for (int round = 0; round < ROUNDS; round++) {
            // A: 판매자 S1·최고입찰자 U2(패자). U1 이 A 를 즉시구매하면 잔액 행 U1(차감)·S1(크레딧)·U2(홀드해제)를 건다.
            ItemInstance itemA = persistListedItem(seller1, 8803);
            Auction auctionA = persistBuyNowAuction(seller1, itemA, START_PRICE, 1_000_000L, now().plusSeconds(3600));
            placeBid(u2, auctionA.getPublicId(), 50_000L);
            // B: 판매자 S2·최고입찰자 U1. U2 가 B 에 상위 입찰하면 잔액 행 U2(홀드)·U1(직전 홀드 해제)를 건다 = 공유 U1·U2 교차.
            ItemInstance itemB = persistListedItem(seller2, 8804);
            Auction auctionB = persistBuyNowAuction(seller2, itemB, START_PRICE, 1_000_000L, now().plusSeconds(3600));
            placeBid(u1, auctionB.getPublicId(), 50_000L);

            AtomicInteger success = new AtomicInteger();
            AtomicInteger roundLocks = new AtomicInteger();
            runConcurrently(2, index -> {
                String outcome = index == 0
                    ? purchaseAndClassify(u1, auctionA.getPublicId())
                    : bidAndClassify(u2, auctionB.getPublicId(), 100_000L);
                classify(outcome, success, roundLocks, lockFailures, unexpected);
            });

            assertThat(roundLocks.get())
                .as("라운드 %d 락 경합 실패 — 즉시구매×입찰 잔액 락 순서가 깨졌다", round)
                .isZero();
            assertThat(unexpected).isEmpty();
            assertThat(success.get()).isEqualTo(2);
        }
        assertThat(lockFailures.get()).isZero();
    }

    private void classify(String outcome, AtomicInteger success, AtomicInteger roundLocks,
        AtomicInteger lockFailures, List<String> unexpected) {
        if (outcome == null) {
            success.incrementAndGet();
        } else if ("LOCK".equals(outcome)) {
            roundLocks.incrementAndGet();
            lockFailures.incrementAndGet();
        } else {
            unexpected.add(outcome);
        }
    }

    /** 즉시구매 결과를 분류한다 — 성공 {@code null} / 락 경합 {@code "LOCK"} / 그 외 에러코드·예외명. */
    private String purchaseAndClassify(User buyer, String auctionPublicId) {
        authenticateAs(buyer.getId());
        try {
            transactionTemplate.executeWithoutResult(status -> purchaseService.purchase(auctionPublicId));
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

    /** 입찰 결과를 분류한다(즉시구매와 동일 규약). */
    private String bidAndClassify(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                status -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
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
