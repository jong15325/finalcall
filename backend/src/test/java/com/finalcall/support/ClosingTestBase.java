package com.finalcall.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.IntConsumer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

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
import com.finalcall.domain.item.ItemOwnershipHistoryRepository;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.domain.settlement.CloseService;
import com.finalcall.domain.settlement.CloseWorker;
import com.finalcall.domain.settlement.PlatformRevenueLedgerRepository;
import com.finalcall.domain.settlement.SaleOrderRepository;

import jakarta.persistence.EntityManager;

/**
 * 마감·정산 통합 테스트 공통 기반(FC-082) — 픽스처 + <b>불변식 단언</b>(closing-domain-spec §6 I-A~I-H)을 모은다.
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다</b>(bid-domain-spec §10 서문 승계). 모든 조회 헬퍼는
 * {@code em.clear()} 로 1차 캐시를 비운 뒤 DB 를 다시 읽는다.
 *
 * <p><b>{@code @Transactional} 을 걸지 않는다</b> — 각 {@code closeOne} 이 독립 트랜잭션으로 실제 커밋돼야
 * idempotency·총량 보존을 검증할 수 있다. 대신 시드 보존 정리를 수동으로 한다(FK 순서 준수).
 */
public abstract class ClosingTestBase extends IntegrationTest {

    /** 낙찰자 기본 잔액 — 낙찰가를 넉넉히 덮는다. */
    protected static final long BALANCE = 100_000_000L;

    @Autowired
    protected CloseWorker closeWorker;

    @Autowired
    protected CloseService closeService;

    @Autowired
    protected BidService bidService;

    @Autowired
    protected AuctionRepository auctionRepository;

    @Autowired
    protected BidRepository bidRepository;

    @Autowired
    protected MoneyHoldRepository moneyHoldRepository;

    @Autowired
    protected SaleOrderRepository saleOrderRepository;

    @Autowired
    protected PlatformRevenueLedgerRepository platformRevenueLedgerRepository;

    @Autowired
    protected ItemInstanceRepository itemInstanceRepository;

    @Autowired
    protected ItemOwnershipHistoryRepository itemOwnershipHistoryRepository;

    @Autowired
    protected ItemTemplateRepository itemTemplateRepository;

    @Autowired
    protected TempStorageRepository tempStorageRepository;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected UserBalanceRepository userBalanceRepository;

    @Autowired
    protected TransactionTemplate transactionTemplate;

    @Autowired
    protected EntityManager em;

    @BeforeEach
    @AfterEach
    void cleanClosingData() {
        // FK 순서: ledger → sale_order → money_hold → bid → auction → 소유이력(내 TRADE 행) → item/user.
        transactionTemplate.executeWithoutResult(status -> {
            platformRevenueLedgerRepository.deleteAllInBatch();
            saleOrderRepository.deleteAllInBatch();
            moneyHoldRepository.deleteAllInBatch();
            bidRepository.deleteAllInBatch();
            auctionRepository.deleteAllInBatch();
            // 시드 SOLD 이력(from_owner=seed_seller)은 보존하고, 테스트가 만든 TRADE 이력(from_owner=비시드)만 지운다.
            List<Long> seedUserIds = userRepository.findAll().stream()
                .filter(user -> SeedTestSupport.SEED_LOGIN_IDS.contains(user.getLoginId()))
                .map(User::getId)
                .toList();
            em.createQuery("DELETE FROM ItemOwnershipHistory h WHERE h.fromOwnerId NOT IN :seedIds")
                .setParameter("seedIds", seedUserIds)
                .executeUpdate();
        });
        SeedTestSupport.deleteNonSeedItemData(
            itemInstanceRepository, tempStorageRepository, userRepository, userBalanceRepository);
    }

    // ---------------- 불변식 단언(closing-domain-spec §6) ----------------

    /**
     * I-A·I-B·I-D·I-E — 낙찰(SOLD) 성립 상태를 검사한다. auction·bid·money_hold·user_balance·sale_order·item 이
     * 하나의 낙찰을 정합하게 가리키는지 본다.
     *
     * @param auctionId       마감된 경매 PK
     * @param winner          낙찰자
     * @param seller          판매자
     * @param sellerBefore    정산 전 판매자 잔액
     * @param winnerBefore    정산 전(홀드 후) 낙찰자 잔액
     * @param price           최종 낙찰가
     */
    protected void assertSold(Long auctionId, User winner, User seller,
        long sellerBefore, long winnerBefore, long price) {
        em.clear();
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        // I-A: SOLD ⟺ result_type=BID ∧ highest_bidder NOT NULL ∧ sale_order 1건.
        assertThat(auction.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(auction.getResultType())
            .isEqualTo(com.finalcall.domain.auction.AuctionResultType.BID);
        assertThat(auction.getHighestBidder().getId()).isEqualTo(winner.getId());

        List<com.finalcall.domain.settlement.SaleOrder> orders = saleOrders(auctionId);
        assertThat(orders).hasSize(1);
        com.finalcall.domain.settlement.SaleOrder order = orders.get(0);
        // I-B: final = settle + fee, final = 낙찰가.
        assertThat(order.getFinalPrice()).isEqualTo(price);
        assertThat(order.getSettleAmount() + order.getFeeAmount()).isEqualTo(price);
        assertThat(order.getBuyer().getId()).isEqualTo(winner.getId());
        assertThat(order.getSeller().getId()).isEqualTo(seller.getId());
        long fee = order.getFeeAmount();
        long settle = order.getSettleAmount();

        // I-D: 낙찰 bid WON · 홀드 CAPTURED 1건 · 낙찰자 balance·held 각각 −P · 판매자 +settle.
        assertThat(bidStatusCount(auctionId, BidStatus.WON)).isEqualTo(1);
        assertThat(bidStatusCount(auctionId, BidStatus.ACTIVE)).isZero();
        assertThat(capturedCount(auctionId)).isEqualTo(1);
        assertThat(heldCount(auctionId)).isZero();
        UserBalance winnerBalance = balanceOf(winner);
        assertThat(winnerBalance.getGameMoneyBalance()).isEqualTo(winnerBefore - price);
        assertThat(winnerBalance.getGameMoneyHeld()).isZero();
        assertThat(balanceOf(seller).getGameMoneyBalance()).isEqualTo(sellerBefore + settle);

        // I-E: 아이템 소유가 낙찰자로 이전 · 위치 INVENTORY/TEMP · 이력 append(seller→winner, TRADE, sale_order_id).
        ItemInstance item = itemInstanceRepository.findById(auction.getItemInstance().getId()).orElseThrow();
        assertThat(item.getOwner().getId()).isEqualTo(winner.getId());
        assertThat(item.getLocation()).isIn(ItemLocation.INVENTORY, ItemLocation.TEMP);
        List<Object[]> history = tradeHistory(item.getId());
        assertThat(history).hasSize(1);
        assertThat((Long)history.get(0)[0]).isEqualTo(seller.getId()); // from_owner
        assertThat((Long)history.get(0)[1]).isEqualTo(winner.getId()); // to_owner
        assertThat((Long)history.get(0)[2]).isEqualTo(order.getId()); // sale_order_id

        // I-B 재현: fee 가 계산기 산출값과 일치(수익 원장에도 동일 값 1행).
        assertThat(revenueLedgerAmount(order.getId())).isEqualTo(fee);
    }

    /**
     * I-A·I-E — 유찰(UNSOLD) 상태를 검사한다. sale_order 0건, 아이템은 판매자 소유 불변, 금전 이동·이력 없음.
     */
    protected void assertUnsold(Long auctionId, User seller) {
        em.clear();
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        assertThat(auction.getStatus()).isEqualTo(AuctionStatus.UNSOLD);
        assertThat(auction.getResultType()).isNull();
        assertThat(auction.getHighestBidder()).isNull();
        assertThat(saleOrders(auctionId)).isEmpty();

        ItemInstance item = itemInstanceRepository.findById(auction.getItemInstance().getId()).orElseThrow();
        assertThat(item.getOwner().getId()).isEqualTo(seller.getId());
        assertThat(item.getLocation()).isIn(ItemLocation.INVENTORY, ItemLocation.TEMP);
        assertThat(tradeHistory(item.getId())).isEmpty();
    }

    /** I-H — 게임머니 총량(모든 사용자 잔액 합 + 수익 원장 합)이 정산 전후로 불변임을 검사한다. */
    protected long totalGameMoneyPlusRevenue() {
        em.clear();
        long balances = em.createQuery(
            "SELECT COALESCE(SUM(b.gameMoneyBalance), 0) FROM UserBalance b", Long.class).getSingleResult();
        long revenue = em.createQuery(
            "SELECT COALESCE(SUM(l.amount), 0) FROM PlatformRevenueLedger l", Long.class).getSingleResult();
        return balances + revenue;
    }

    // ---------------- 동시 실행 ----------------

    /** 래치로 출발선을 맞춰 동시에 들이받게 한다(기존 동시성 테스트 선례와 동일 패턴). */
    protected void runConcurrently(int threads, IntConsumer task) throws InterruptedException {
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
            assertThat(done.await(60, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }

    // ---------------- 픽스처 ----------------

    protected Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MILLIS);
    }

    protected User persistUser(String loginId, String nickname, long gameMoney) {
        User user = userRepository.save(
            User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        userBalanceRepository.save(balance);
        return user;
    }

    /** 출품(LISTED) 아이템을 만든다(판매자 소유·slot NULL — markListedIfInInventory 결과와 동일). */
    protected ItemInstance persistListedItem(User seller, int typeCode) {
        return itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(seller).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build());
    }

    /** 진행 중(ACTIVE) 경매를 만든다. 소프트클로즈 window/extend 는 인자로 받아 경합 테스트가 조정한다. */
    protected Auction persistAuction(User seller, ItemInstance item, long startPrice, Instant endAt,
        AuctionStatus status, Instant startAt, int windowSec, int extendSec) {
        return auctionRepository.save(Auction.builder()
            .seller(seller).itemInstance(item).startPrice(startPrice)
            .status(status).startAt(startAt).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(windowSec).softCloseExtendSec(extendSec)
            .itemNameSnapshot("마감템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    /** 마감 여유 있는 표준 ACTIVE 경매(소프트클로즈 비저촉 window/extend=1s). */
    protected Auction persistActiveAuction(User seller, ItemInstance item, long startPrice, Instant endAt) {
        return persistAuction(seller, item, startPrice, endAt, AuctionStatus.ACTIVE, null, 1, 1);
    }

    protected ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("마감템플릿").build()));
    }

    /** 단건 입찰을 독립 트랜잭션으로 커밋한다(테스트가 비-트랜잭션이라 명시적 경계가 필요하다). */
    protected void placeBid(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                status -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** 마감 시각을 과거로 당긴다(입찰 성립 후 "마감 시각이 지난" 상태를 결정적으로 만든다). */
    protected void expireAuction(Long auctionId, Instant endAt) {
        transactionTemplate
            .executeWithoutResult(status -> em.createQuery("UPDATE Auction a SET a.endAt = :endAt WHERE a.id = :id")
                .setParameter("endAt", endAt)
                .setParameter("id", auctionId)
                .executeUpdate());
    }

    protected void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }

    // ---------------- DB 상태 조회(전부 1차 캐시 우회) ----------------

    protected List<com.finalcall.domain.settlement.SaleOrder> saleOrders(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT o FROM SaleOrder o WHERE o.sourceType = :type AND o.sourceId = :id",
            com.finalcall.domain.settlement.SaleOrder.class)
            .setParameter("type", com.finalcall.domain.settlement.SaleOrderSourceType.AUCTION)
            .setParameter("id", auctionId)
            .getResultList();
    }

    protected long revenueLedgerAmount(Long saleOrderId) {
        em.clear();
        return em.createQuery(
            "SELECT COALESCE(SUM(l.amount), 0) FROM PlatformRevenueLedger l WHERE l.saleOrder.id = :id", Long.class)
            .setParameter("id", saleOrderId)
            .getSingleResult();
    }

    protected long bidStatusCount(Long auctionId, BidStatus status) {
        em.clear();
        return em.createQuery(
            "SELECT COUNT(b) FROM Bid b WHERE b.auction.id = :id AND b.status = :status", Long.class)
            .setParameter("id", auctionId)
            .setParameter("status", status)
            .getSingleResult();
    }

    protected long heldCount(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT COUNT(h) FROM MoneyHold h WHERE h.bid.auction.id = :id AND h.status = :status", Long.class)
            .setParameter("id", auctionId)
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
    }

    protected long capturedCount(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT COUNT(h) FROM MoneyHold h WHERE h.bid.auction.id = :id AND h.status = :status", Long.class)
            .setParameter("id", auctionId)
            .setParameter("status", MoneyHoldStatus.CAPTURED)
            .getSingleResult();
    }

    /** {@code [from_owner_id, to_owner_id, sale_order_id]} 형태의 TRADE 이력 행. */
    protected List<Object[]> tradeHistory(Long instanceId) {
        em.clear();
        return em.createQuery(
            "SELECT h.fromOwnerId, h.toOwnerId, h.saleOrderId FROM ItemOwnershipHistory h "
                + "WHERE h.instanceId = :id AND h.transferType = :type",
            Object[].class)
            .setParameter("id", instanceId)
            .setParameter("type", com.finalcall.domain.item.TransferType.TRADE)
            .getResultList();
    }

    protected UserBalance balanceOf(User user) {
        em.clear();
        return userBalanceRepository.findByUserId(user.getId()).orElseThrow();
    }

    protected Auction reload(Long auctionId) {
        em.clear();
        return auctionRepository.findById(auctionId).orElseThrow();
    }
}
