package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.member.entity.User;
import com.finalcall.support.BidConcurrencyTestBase;

/**
 * 입찰 폭주 동시성 검증(bid, FC-032 착수 · FC-034 강화) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>이 프로젝트가 "핵심 기술 도전"이라 부르는 것을 증거로 바꾸는 자리다(bid-domain-spec §10 시나리오 1·6).
 * 담당 불변식은 <b>I1·I2·I6·I10</b> 이고, 소프트클로즈(I7·I8)·홀드 총량(I3·I4·I5)·취소 경합(I9)·데드락은
 * 각각 전용 테스트가 맡는다.
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다</b>(§10 서문 — 응답은 구현 버그를 숨긴다). 공통 불변식 단언과
 * 픽스처는 {@link BidConcurrencyTestBase} 에 있다.
 */
class BidConcurrencyIntegrationTest extends BidConcurrencyTestBase {

    /** 폭주 규모(§10 시나리오 1 "N ≥ 30"). 단일 경매 행에 전부 몰아넣는다. */
    private static final int THREADS = 32;

    @Test
    void 동시_입찰_32건은_유실도_중복도_없이_전부_수용되거나_거절된다() throws Exception {
        User seller = persistUser("bid_cc_seller", "경합판매자", 0L);
        Auction auction = persistAuction(seller, 8201, secondsLater(3600));
        // 계단 금액: 스레드마다 서로 다른 금액으로 동시에 들이받는다. 직렬화가 없으면 낮은 입찰이 높은 입찰을
        //   덮어써(lost update) 최고가가 내려가고 ACTIVE 입찰이 여러 건 남는다.
        List<User> bidders = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            bidders.add(persistUser("bid_cc_" + i, "경합입찰자" + i, BALANCE));
        }

        AtomicInteger success = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(bidders.size(), index -> {
            String code = placeAndCaptureCode(
                bidders.get(index), auction.getPublicId(), START_PRICE + (long)index * STEP);
            if (code == null) {
                success.incrementAndGet();
            } else if ("BID_001".equals(code)) {
                // 경합에서 밀린 입찰은 최소 증분 미달로 정상 거절된다.
                rejected.incrementAndGet();
            } else {
                // 500 이나 락 실패가 "거절"로 조용히 집계되면 합계 단언이 통과하며 결함을 덮는다.
                unexpected.add(code);
            }
        });

        // I6: 시도 = 성공 + 거절. 유실(둘 다 아닌 결과)도 중복 집계도 없다.
        assertThat(unexpected).isEmpty();
        assertThat(success.get() + rejected.get()).isEqualTo(THREADS);
        assertThat(success.get()).isPositive();
        // I6: 성공 응답 수 == bid 행 수 == money_hold 행 수. 실패는 어떤 흔적도 남기지 않는다.
        assertThat(bidCount(auction.getId())).isEqualTo(success.get());
        assertThat(moneyHoldRepository.count()).isEqualTo(success.get());
        // I1·I2·I3: 최고가·최고입찰자·ACTIVE 입찰·HELD 홀드가 모두 같은 하나의 입찰을 가리키고,
        //   성립 입찰 금액은 수용 순서대로 엄격 증가한다.
        assertAuctionAnchorInvariants(auction.getId());
        // 최종 최고가 보유자는 실제로 그 금액을 홀드하고 있고, 밀려난 입찰자는 한 푼도 묶여 있지 않다.
        Auction finalAuction = reload(auction);
        for (User bidder : bidders) {
            assertMoneyConservation(bidder, BALANCE);
            long expectedHeld = bidder.getId().equals(finalAuction.getHighestBidder().getId())
                ? finalAuction.getHighestBidAmount() : 0L;
            assertThat(heldSum(bidder)).isEqualTo(expectedHeld);
        }
    }

    @Test
    void 교대_입찰_후에도_홀드_합계는_보존되고_최고입찰자만_묶여있다() throws Exception {
        User seller = persistUser("bid_alt_seller", "교대판매자", 0L);
        User alice = persistUser("bid_alt_a", "앨리스", BALANCE);
        User bob = persistUser("bid_alt_b", "밥", BALANCE);
        Auction auction = persistAuction(seller, 8202, secondsLater(3600));

        // A·B 가 번갈아 상위 입찰한다. 매 회 직전 홀드가 즉시 해제되지 않으면 홀드가 누적된다(자금 동결).
        long amount = START_PRICE;
        for (int round = 0; round < 6; round++) {
            placeInTransaction(round % 2 == 0 ? alice : bob, auction.getPublicId(), amount);
            amount += STEP;
        }

        long lastAmount = amount - STEP; // 마지막 성립 입찰액(6,000)
        User lastBidder = bob; // round 0..5 중 마지막 round=5 는 홀수 → bob

        // I3: 경매당 HELD 홀드는 1건, 그 보유자가 현재 최고입찰자다.
        assertThat(heldCount()).isEqualTo(1);
        assertThat(heldSum(lastBidder)).isEqualTo(lastAmount);
        assertThat(heldSum(alice)).isZero();
        // I4·I5: 사용자별 game_money_held == HELD 원장 합계, 총량 보존, 음수 없음.
        assertMoneyConservation(alice, BALANCE);
        assertMoneyConservation(bob, BALANCE);
        assertAuctionAnchorInvariants(auction.getId());
        // 밀려난 입찰은 전부 OUTBID 로 보존된다(삭제 아님 — 원장).
        assertThat(bidCount(auction.getId())).isEqualTo(6);
    }

    @Test
    void 잔액이_부족한_입찰은_bid_행조차_남기지_않는다() throws Exception {
        User seller = persistUser("bid_rb_seller", "롤백판매자", 0L);
        User poor = persistUser("bid_rb_poor", "빈지갑", 5_000L);
        Auction auction = persistAuction(seller, 8203, secondsLater(3600));

        // bid INSERT 가 홀드보다 먼저 실행되지만 같은 트랜잭션이라 함께 롤백된다(I6).
        //   요청별 독립 트랜잭션이어야 검증되므로 이 테스트는 @Transactional 이 아니다.
        assertThat(placeAndCaptureCode(poor, auction.getPublicId(), 10_000L)).isEqualTo("BID_005");

        assertThat(bidCount(auction.getId())).isZero();
        assertThat(moneyHoldRepository.count()).isZero();
        assertMoneyConservation(poor, 5_000L);
        assertAuctionAnchorInvariants(auction.getId());
    }

    @Test
    void 최고입찰자의_동시_재입찰은_전부_BID_004로_막힌다() throws Exception {
        User seller = persistUser("bid_sf_seller", "자기인상판매자", 0L);
        User bidder = persistUser("bid_sf_bidder", "자기인상", BALANCE);
        Auction auction = persistAuction(seller, 8204, secondsLater(3600));
        placeInTransaction(bidder, auction.getPublicId(), START_PRICE);

        AtomicInteger success = new AtomicInteger();
        List<String> codes = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            String code = placeAndCaptureCode(bidder, auction.getPublicId(), START_PRICE + 10_000L);
            if (code == null) {
                success.incrementAndGet();
            } else {
                codes.add(code);
            }
        });

        // I10: 자기 가격 인상(shill)은 동시 상황에서도 단 한 건도 성립하지 않는다.
        assertThat(success.get()).isZero();
        assertThat(codes).hasSize(THREADS).containsOnly("BID_004");
        assertThat(bidCount(auction.getId())).isEqualTo(1);
        assertThat(heldSum(bidder)).isEqualTo(START_PRICE);
        assertMoneyConservation(bidder, BALANCE);
        assertAuctionAnchorInvariants(auction.getId());
    }

    /**
     * 취소 CAS 0행 원인 판정이 <b>동시 입찰을 실제로 본다</b>(bid-domain-spec §4.6 · I9).
     *
     * <p>재현 조건이 까다로워 서비스 호출로는 타이밍을 잡을 수 없으므로, 취소 트랜잭션이 겪는 순서를 그대로
     * 재현해 리포지토리 수준에서 고정한다: (1) 경매를 한 번 읽어 트랜잭션의 일관읽기 스냅샷을 연다 →
     * (2) 다른 스레드가 첫 입찰을 커밋한다 → (3) 원인 판정용 재조회가 최신 값을 봐야 한다.
     *
     * <p>여기서 <b>일반 재조회로는 고칠 수 없다</b>는 점이 핵심이다. 1차 캐시를 비워도 MySQL 기본 격리수준
     * REPEATABLE READ 의 일관읽기 스냅샷 때문에 여전히 옛 값이 보인다. 잠금 읽기만이 최신 커밋 버전을 읽는다.
     * 서비스 수준의 실제 경합은 {@code AuctionCancelVsBidConcurrencyIntegrationTest} 가 맡는다.
     */
    @Test
    void 취소_원인판정_재조회는_동시_입찰이_채운_최고입찰자를_본다() throws Exception {
        User seller = persistUser("bid_i9_seller", "취소경합판매자", 0L);
        User bidder = persistUser("bid_i9_bidder", "취소경합입찰자", BALANCE);
        Auction auction = persistAuction(seller, 8205, secondsLater(3600));
        Long auctionId = auction.getId();

        transactionTemplate.executeWithoutResult(statusCallback -> {
            // (1) 취소 경로가 하는 첫 로드 — 이 시점에 일관읽기 스냅샷이 열린다. 아직 입찰이 없다.
            assertThat(auctionRepository.findById(auctionId).orElseThrow().getHighestBidder()).isNull();

            // (2) 다른 스레드에서 첫 입찰이 커밋된다(이 트랜잭션은 행 락을 잡고 있지 않아 진행된다).
            commitBidFromOtherThread(bidder, auction.getPublicId(), START_PRICE);

            // (3) 대조군 — 1차 캐시를 비운 일반 재조회는 <b>여전히 null</b> 이다. findById 는 해법이 아니다.
            em.clear();
            assertThat(auctionRepository.findById(auctionId).orElseThrow().getHighestBidder()).isNull();

            // (4) 정정된 판정 근거 — 스칼라 프로젝션 + 잠금 읽기는 최신 커밋 값을 본다 → AUCTION_007 로 분류된다.
            assertThat(auctionRepository.findCancelStateForUpdate(auctionId).orElseThrow().highestBidderId())
                .isEqualTo(bidder.getId());
        });
    }

    /** 별도 스레드 + 별도 트랜잭션에서 입찰을 커밋한다(호출 트랜잭션과 독립이어야 경합이 재현된다). */
    private void commitBidFromOtherThread(User bidder, String auctionPublicId, long amount) {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            pool.submit(() -> placeInTransaction(bidder, auctionPublicId, amount)).get(20, TimeUnit.SECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(ex);
        } catch (Exception ex) {
            throw new IllegalStateException("동시 입찰 커밋 실패", ex);
        } finally {
            pool.shutdownNow();
        }
    }
}
