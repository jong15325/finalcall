package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidPlaceCommand;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.bid.BidService;
import com.finalcall.domain.bid.BidStatus;
import com.finalcall.domain.currency.MoneyHoldRepository;
import com.finalcall.domain.currency.MoneyHoldStatus;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.SeedTestSupport;

import jakarta.persistence.EntityManager;

/**
 * 입찰 동시성 기본 검증(bid, FC-032) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>이 프로젝트의 핵심 기술 도전(마감 직전 입찰 폭주)을 최소 형태로 고정한다. 본격 폭주 시나리오 7종과
 * 불변식 I1~I10 전수는 FC-034 소유이고, 여기서는 <b>FC-032 가 깨뜨릴 수 있는 것</b>만 지킨다:
 * 최고가 단조 증가(I2)·경매당 ACTIVE 입찰 1건(I1)·홀드 합계 보존(I3·I4)·실패의 무흔적(I6).
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다</b>(bid-domain-spec §10 서문 — 응답은 구현 버그를 숨긴다).
 * 실제 커밋·요청별 독립 트랜잭션이 필요하므로 {@code @Transactional} 을 걸지 않고 시드 보존 정리를 수동으로 한다.
 */
class BidConcurrencyIntegrationTest extends IntegrationTest {

    private static final int THREADS = 12;
    private static final long START_PRICE = 1_000L;
    private static final long BALANCE = 10_000_000L;

    @Autowired
    private BidService bidService;

    @Autowired
    private AuctionRepository auctionRepository;

    @Autowired
    private BidRepository bidRepository;

    @Autowired
    private MoneyHoldRepository moneyHoldRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private TempStorageRepository tempStorageRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private EntityManager em;

    @BeforeEach
    @AfterEach
    void clean() {
        // FK 순서: money_hold → bid → auction → item/user.
        moneyHoldRepository.deleteAllInBatch();
        bidRepository.deleteAllInBatch();
        auctionRepository.deleteAllInBatch();
        SeedTestSupport.deleteNonSeedItemData(
            itemInstanceRepository, tempStorageRepository, userRepository, userBalanceRepository);
    }

    @Test
    void 동시_입찰에도_최고가는_단조_증가하고_ACTIVE_입찰은_1건만_남는다() throws Exception {
        User seller = persistUser("bid_cc_seller", "경합판매자", 0L);
        Auction auction = persistAuction(seller, 8201, hoursLater(1));
        // 계단 금액: 스레드마다 서로 다른 금액으로 동시에 들이받는다. 락이 없으면 낮은 입찰이 높은 입찰을
        //   덮어써(lost update) 최고가가 내려가고, ACTIVE 입찰이 여러 건 남는다.
        List<User> bidders = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            bidders.add(persistUser("bid_cc_" + i, "경합입찰자" + i, BALANCE));
        }

        AtomicInteger success = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(bidders.size(), index -> {
            authenticateAs(bidders.get(index).getId());
            try {
                bidService.place(new BidPlaceCommand(
                    auction.getPublicId(), START_PRICE + (long)index * 1_000L));
                success.incrementAndGet();
            } catch (BusinessException ex) {
                // 경합에서 밀린 입찰은 최소 증분 미달(BID_001)로 정상 거절된다 — 500 이 아니어야 한다.
                if ("BID_001".equals(ex.getErrorCode().getCode())) {
                    rejected.incrementAndGet();
                } else {
                    unexpected.add(ex.getErrorCode().getCode());
                }
            } catch (RuntimeException ex) {
                // 락 경합 실패(COMMON_004)나 500 이 섞이면 여기서 잡아 드러낸다 — 조용히 삼키면 안 된다.
                unexpected.add(ex.getClass().getSimpleName());
            } finally {
                SecurityContextHolder.clearContext();
            }
        });

        assertThat(unexpected).isEmpty();
        assertThat(success.get() + rejected.get()).isEqualTo(THREADS);
        assertThat(success.get()).isPositive();

        Auction finalAuction = auctionRepository.findById(auction.getId()).orElseThrow();
        // I1: ACTIVE 입찰은 정확히 1건이고 그 금액·입찰자가 auction 최고가와 일치한다.
        List<Object[]> actives = activeBids(auction.getId());
        assertThat(actives).hasSize(1);
        assertThat((Long)actives.get(0)[0]).isEqualTo(finalAuction.getHighestBidAmount());
        assertThat((Long)actives.get(0)[1]).isEqualTo(finalAuction.getHighestBidder().getId());
        // I2: 최종 최고가는 성립한 입찰 중 최댓값이다(낮은 입찰이 덮어쓰지 않았다).
        assertThat(finalAuction.getHighestBidAmount()).isEqualTo(maxBidAmount(auction.getId()));
        // I6: 성공 응답 수 == bid 행 수 == money_hold 행 수. 실패는 어떤 흔적도 남기지 않는다.
        assertThat(bidCount(auction.getId())).isEqualTo(success.get());
        assertThat(moneyHoldRepository.count()).isEqualTo(success.get());
    }

    @Test
    void 교대_입찰_후에도_홀드_합계는_보존되고_최고입찰자만_묶여있다() throws Exception {
        User seller = persistUser("bid_alt_seller", "교대판매자", 0L);
        User alice = persistUser("bid_alt_a", "앨리스", BALANCE);
        User bob = persistUser("bid_alt_b", "밥", BALANCE);
        Auction auction = persistAuction(seller, 8202, hoursLater(1));

        // A·B 가 번갈아 상위 입찰한다. 매 회 직전 홀드가 즉시 해제되지 않으면 홀드가 누적된다(자금 동결).
        long amount = START_PRICE;
        for (int round = 0; round < 6; round++) {
            User bidder = round % 2 == 0 ? alice : bob;
            placeInTransaction(bidder, auction.getPublicId(), amount);
            amount += 1_000L;
        }

        long lastAmount = amount - 1_000L; // 마지막 성립 입찰액(6,000)
        User lastBidder = bob; // 6회(round 0..5) 중 마지막 round=5 는 홀수 → bob

        // I3: 경매당 HELD 홀드는 1건, 그 보유자가 현재 최고입찰자다.
        assertThat(heldCount()).isEqualTo(1);
        assertThat(heldSum(lastBidder)).isEqualTo(lastAmount);
        assertThat(heldSum(alice)).isZero();
        // I4: 사용자별 game_money_held == HELD 원장 합계.
        assertThat(balanceOf(alice).getGameMoneyHeld()).isEqualTo(heldSum(alice));
        assertThat(balanceOf(bob).getGameMoneyHeld()).isEqualTo(heldSum(bob));
        // I5: 잔액은 전혀 차감되지 않았다(홀드는 잠금이지 차감이 아니다) — 가용 >= 0.
        assertThat(balanceOf(alice).getGameMoneyBalance()).isEqualTo(BALANCE);
        assertThat(balanceOf(bob).getGameMoneyBalance()).isEqualTo(BALANCE);
        assertThat(balanceOf(alice).getGameMoneyAvailable()).isNotNegative();
        assertThat(balanceOf(bob).getGameMoneyAvailable()).isNotNegative();
        // 밀려난 입찰은 전부 OUTBID 로 보존된다(삭제 아님 — 원장).
        assertThat(activeBids(auction.getId())).hasSize(1);
        assertThat(bidCount(auction.getId())).isEqualTo(6);
    }

    @Test
    void 잔액이_부족한_입찰은_bid_행조차_남기지_않는다() throws Exception {
        User seller = persistUser("bid_rb_seller", "롤백판매자", 0L);
        User poor = persistUser("bid_rb_poor", "빈지갑", 5_000L);
        Auction auction = persistAuction(seller, 8203, hoursLater(1));

        // bid INSERT 가 홀드보다 먼저 실행되지만 같은 트랜잭션이라 함께 롤백된다(I6).
        //   요청별 독립 트랜잭션이어야 검증되므로 이 테스트는 @Transactional 이 아니다.
        assertThatBidFails(poor, auction.getPublicId(), 10_000L, "BID_005");

        assertThat(bidCount(auction.getId())).isZero();
        assertThat(moneyHoldRepository.count()).isZero();
        assertThat(balanceOf(poor).getGameMoneyHeld()).isZero();
        assertThat(balanceOf(poor).getGameMoneyBalance()).isEqualTo(5_000L);
        assertThat(auctionRepository.findById(auction.getId()).orElseThrow().getHighestBidAmount()).isNull();
    }

    @Test
    void 최고입찰자의_동시_재입찰은_전부_BID_004로_막힌다() throws Exception {
        User seller = persistUser("bid_sf_seller", "자기인상판매자", 0L);
        User bidder = persistUser("bid_sf_bidder", "자기인상", BALANCE);
        Auction auction = persistAuction(seller, 8204, hoursLater(1));
        placeInTransaction(bidder, auction.getPublicId(), START_PRICE);

        AtomicInteger success = new AtomicInteger();
        AtomicInteger consecutive = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        runConcurrently(THREADS, index -> {
            authenticateAs(bidder.getId());
            try {
                bidService.place(new BidPlaceCommand(auction.getPublicId(), START_PRICE + 10_000L));
                success.incrementAndGet();
            } catch (BusinessException ex) {
                if ("BID_004".equals(ex.getErrorCode().getCode())) {
                    consecutive.incrementAndGet();
                } else {
                    unexpected.add(ex.getErrorCode().getCode());
                }
            } catch (RuntimeException ex) {
                unexpected.add(ex.getClass().getSimpleName());
            } finally {
                SecurityContextHolder.clearContext();
            }
        });

        // I10: 자기 가격 인상은 동시 상황에서도 단 한 건도 성립하지 않는다.
        assertThat(unexpected).isEmpty();
        assertThat(success.get()).isZero();
        assertThat(consecutive.get()).isEqualTo(THREADS);
        assertThat(bidCount(auction.getId())).isEqualTo(1);
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isEqualTo(START_PRICE);
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
     */
    @Test
    void 취소_원인판정_재조회는_동시_입찰이_채운_최고입찰자를_본다() throws Exception {
        User seller = persistUser("bid_i9_seller", "취소경합판매자", 0L);
        User bidder = persistUser("bid_i9_bidder", "취소경합입찰자", BALANCE);
        Auction auction = persistAuction(seller, 8205, hoursLater(1));
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

    // ---------------- helpers ----------------

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

    /** 래치로 출발선을 맞춰 동시에 들이받게 한다(기존 동시성 테스트 선례와 동일 패턴). */
    private void runConcurrently(int threads, java.util.function.IntConsumer task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        try {
            for (int i = 0; i < threads; i++) {
                final int index = i;
                pool.submit(() -> {
                    try {
                        ready.await();
                        task.accept(index);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            ready.countDown();
            assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }

    /** 단건 입찰을 독립 트랜잭션으로 커밋한다(테스트가 비-트랜잭션이라 명시적 경계가 필요하다). */
    private void placeInTransaction(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                statusCallback -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void assertThatBidFails(User bidder, String auctionPublicId, long amount, String expectedCode) {
        authenticateAs(bidder.getId());
        try {
            bidService.place(new BidPlaceCommand(auctionPublicId, amount));
            throw new AssertionError("입찰이 " + expectedCode + " 로 거절돼야 한다");
        } catch (BusinessException ex) {
            assertThat(ex.getErrorCode().getCode()).isEqualTo(expectedCode);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private List<Object[]> activeBids(Long auctionId) {
        return em.createQuery(
            "SELECT b.amount, b.bidder.id FROM Bid b WHERE b.auction.id = :id AND b.status = :status",
            Object[].class)
            .setParameter("id", auctionId)
            .setParameter("status", BidStatus.ACTIVE)
            .getResultList();
    }

    private Long maxBidAmount(Long auctionId) {
        return em.createQuery("SELECT MAX(b.amount) FROM Bid b WHERE b.auction.id = :id", Long.class)
            .setParameter("id", auctionId)
            .getSingleResult();
    }

    private long bidCount(Long auctionId) {
        return em.createQuery("SELECT COUNT(b) FROM Bid b WHERE b.auction.id = :id", Long.class)
            .setParameter("id", auctionId)
            .getSingleResult();
    }

    private long heldCount() {
        return em.createQuery("SELECT COUNT(h) FROM MoneyHold h WHERE h.status = :status", Long.class)
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
    }

    private long heldSum(User user) {
        return em.createQuery(
            "SELECT COALESCE(SUM(h.amount), 0) FROM MoneyHold h WHERE h.user.id = :id AND h.status = :status",
            Long.class)
            .setParameter("id", user.getId())
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
    }

    private UserBalance balanceOf(User user) {
        em.clear();
        return userBalanceRepository.findByUserId(user.getId()).orElseThrow();
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }

    private Instant hoursLater(int hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
    }

    private Auction persistAuction(User seller, int typeCode, Instant endAt) {
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(seller).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build());
        return auctionRepository.save(Auction.builder()
            .seller(seller).itemInstance(item).startPrice(START_PRICE)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("경합템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("경합템플릿").build()));
    }

    private User persistUser(String loginId, String nickname, long gameMoney) {
        User user = userRepository.save(
            User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        userBalanceRepository.save(balance);
        return user;
    }
}
