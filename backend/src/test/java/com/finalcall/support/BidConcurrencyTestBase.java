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

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidPlaceCommand;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.bid.BidService;
import com.finalcall.domain.bid.BidStatus;
import com.finalcall.domain.currency.entity.MoneyHoldStatus;
import com.finalcall.domain.currency.repository.MoneyHoldRepository;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.item.repository.TempStorageRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;

import jakarta.persistence.EntityManager;

/**
 * 입찰 동시성 테스트 공통 기반(FC-034) — 픽스처 + <b>불변식 단언</b>을 한곳에 모은다.
 *
 * <p>불변식 단언을 기반 클래스에 두는 것이 이 클래스의 존재 이유다. bid-domain-spec §10 의 I1~I10 은 시나리오마다
 * 다시 쓰면 조금씩 달라지고, 달라진 단언은 회귀 방어선이 아니라 <b>시나리오별 해석</b>이 된다. 여기서 한 번만
 * 정의하면 모든 시나리오가 같은 잣대로 검사되고, 불변식이 바뀔 때 고칠 곳도 한 곳이다.
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다</b>(§10 서문 — 응답은 구현 버그를 숨긴다). 모든 조회 헬퍼는
 * {@code em.clear()} 로 1차 캐시를 비운 뒤 DB 를 다시 읽는다.
 *
 * <p><b>{@code @Transactional} 을 걸지 않는다.</b> 테스트가 트랜잭션 안이면 각 요청이 테스트 트랜잭션에 참여해
 * (1) 스레드 간 경합 자체가 재현되지 않고 (2) 실패한 요청이 rollback-only 표시만 남긴 채 이미 flush 된 INSERT 를
 * 되돌리지 않아 <b>롤백 원자성(I6)을 검증할 수 없다</b>. 대신 시드 보존 정리를 수동으로 한다.
 */
public abstract class BidConcurrencyTestBase extends IntegrationTest {

    /** 경매 기본 시작가. 최소 증분 구간 100 원 구간이라 계단 금액을 1,000 단위로 잡으면 항상 증분을 넘는다. */
    protected static final long START_PRICE = 1_000L;
    /** 계단 입찰 간격. 증분(현재가 10,000 미만 → 100 / 이상 → 1,000)보다 항상 크게 잡는다. */
    protected static final long STEP = 1_000L;
    /** 넉넉한 기본 잔액 — 잔액 경계를 테스트하는 시나리오만 별도 값을 쓴다. */
    protected static final long BALANCE = 10_000_000L;

    @Autowired
    protected BidService bidService;

    @Autowired
    protected AuctionRepository auctionRepository;

    @Autowired
    protected BidRepository bidRepository;

    @Autowired
    protected MoneyHoldRepository moneyHoldRepository;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected UserBalanceRepository userBalanceRepository;

    @Autowired
    protected ItemInstanceRepository itemInstanceRepository;

    @Autowired
    protected ItemTemplateRepository itemTemplateRepository;

    @Autowired
    protected TempStorageRepository tempStorageRepository;

    @Autowired
    protected TransactionTemplate transactionTemplate;

    @Autowired
    protected EntityManager em;

    @BeforeEach
    @AfterEach
    void cleanBidData() {
        // FK 순서: money_hold → bid → auction → item/user. 시드 user·아이템은 보존한다.
        moneyHoldRepository.deleteAllInBatch();
        bidRepository.deleteAllInBatch();
        auctionRepository.deleteAllInBatch();
        SeedTestSupport.deleteNonSeedItemData(
            itemInstanceRepository, tempStorageRepository, userRepository, userBalanceRepository);
    }

    // ---------------- 불변식 단언(bid-domain-spec §10) ----------------

    /**
     * I1·I2·I3 — 경매 하나의 <b>앵커 정합</b>을 검사한다.
     *
     * <p>세 테이블(auction·bid·money_hold)이 같은 하나의 입찰을 가리키는지 본다. 직렬화가 깨지거나 §4.2 의
     * 영속성 컨텍스트 clear 함정을 밟으면 여기서 갈라진다 — 특히 clear 함정은 <b>예외 없이 갱신이 유실</b>되므로
     * 이 단언 말고는 잡을 방법이 없다.
     */
    protected void assertAuctionAnchorInvariants(Long auctionId) {
        em.clear();
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        List<Object[]> actives = activeBids(auctionId);
        List<Object[]> holds = heldRows(auctionId);

        if (auction.getHighestBidAmount() == null) {
            // 입찰이 성립한 적이 없다 → ACTIVE 입찰도 HELD 홀드도 존재해선 안 된다.
            assertThat(actives).isEmpty();
            assertThat(holds).isEmpty();
            assertThat(auction.getHighestBidder()).isNull();
            return;
        }

        // I1: 경매당 ACTIVE 입찰은 정확히 1건이고, 그 금액·입찰자가 auction 앵커와 일치한다.
        assertThat(actives).hasSize(1);
        assertThat((Long)actives.get(0)[0]).isEqualTo(auction.getHighestBidAmount());
        assertThat((Long)actives.get(0)[1]).isEqualTo(auction.getHighestBidder().getId());
        // I2: 최고가는 성립 입찰 중 최댓값이다(낮은 입찰이 덮어쓰는 lost update 가 없었다).
        assertThat(auction.getHighestBidAmount()).isEqualTo(maxBidAmount(auctionId));
        // I2: 성립 입찰 금액은 수용 순서(= id 순, 행 락 아래에서 채번)대로 엄격 증가한다.
        assertThat(bidAmountsInAcceptanceOrder(auctionId)).isSorted().doesNotHaveDuplicates();
        // I3: 경매당 HELD 홀드는 1건이며 그 보유자·금액이 현재 최고입찰자와 일치한다(P-008 즉시 해제).
        assertThat(holds).hasSize(1);
        assertThat((Long)holds.get(0)[0]).isEqualTo(auction.getHighestBidder().getId());
        assertThat((Long)holds.get(0)[1]).isEqualTo(auction.getHighestBidAmount());
    }

    /**
     * I4·I5 — 금전 총량 보존. 사용자별로 <b>원장 합계 == 잔액의 홀드 필드</b>이고, 잔액은 음수가 되지 않는다.
     *
     * <p>{@code initialBalance} 를 함께 받는 이유는 "잔액 + 활성 홀드 = 초기 잔액"(총량 보존)을 직접 확인하기
     * 위해서다. 홀드는 차감이 아니라 잠금이므로 {@code game_money_balance} 는 초기값 그대로여야 하고,
     * 가용({@code balance − held})에 홀드를 되돌리면 초기값이 복원된다.
     */
    protected void assertMoneyConservation(User user, long initialBalance) {
        em.clear();
        UserBalance balance = userBalanceRepository.findByUserId(user.getId()).orElseThrow();
        long ledgerHeld = heldSum(user);

        // I4: 잔액의 홀드 필드와 HELD 원장 합계가 정확히 같다(원장-잔액 드리프트 없음).
        assertThat(balance.getGameMoneyHeld()).isEqualTo(ledgerHeld);
        // 총량 보존: 가용 + 활성 홀드 == 초기 잔액. 홀드는 잠금이지 차감이 아니다.
        assertThat(balance.getGameMoneyAvailable() + ledgerHeld).isEqualTo(initialBalance);
        assertThat(balance.getGameMoneyBalance()).isEqualTo(initialBalance);
        // I5: 0 <= held <= balance. 초과 홀드·음수 가용이 없다.
        assertThat(balance.getGameMoneyHeld()).isNotNegative();
        assertThat(balance.getGameMoneyAvailable()).isNotNegative();
    }

    /**
     * I7 — 마감 시각 불변식. {@code end_at} 은 상한을 넘지 않고, 최초 마감보다 앞당겨지지 않는다.
     *
     * @param originalEndAt 연장 이전의 마감 시각(단조 비감소 기준선)
     */
    protected void assertEndAtInvariants(Long auctionId, Instant originalEndAt) {
        em.clear();
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        assertThat(auction.getEndAt()).isBeforeOrEqualTo(auction.getMaxEndAt());
        assertThat(auction.getEndAt()).isAfterOrEqualTo(originalEndAt);
        assertThat(auction.getExtensionCount()).isNotNegative();
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

    /** 서로 다른 작업을 동시에 출발시킨다(취소 vs 입찰, 교차 outbid 처럼 역할이 다른 경합용). */
    protected void runConcurrently(List<Runnable> tasks) throws InterruptedException {
        runConcurrently(tasks.size(), index -> tasks.get(index).run());
    }

    // ---------------- 입찰 실행 ----------------

    /** 단건 입찰을 독립 트랜잭션으로 커밋한다(테스트가 비-트랜잭션이라 명시적 경계가 필요하다). */
    protected void placeInTransaction(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                statusCallback -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * 입찰을 시도하고 결과를 <b>에러코드 문자열</b>로 돌려준다(성공이면 {@code null}).
     *
     * <p>{@link BusinessException} 이 아닌 예외는 삼키지 않고 클래스명을 반환한다 — 500 이나 락 실패가 조용히
     * "거절"로 집계되면 성공/거절 합계 단언(I6)이 통과해버려 결함을 덮는다.
     */
    protected String placeAndCaptureCode(User bidder, String auctionPublicId, long amount) {
        authenticateAs(bidder.getId());
        try {
            transactionTemplate.executeWithoutResult(
                statusCallback -> bidService.place(new BidPlaceCommand(auctionPublicId, amount)));
            return null;
        } catch (BusinessException ex) {
            return ex.getErrorCode().getCode();
        } catch (RuntimeException ex) {
            return ex.getClass().getSimpleName();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    protected void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }

    // ---------------- DB 상태 조회(전부 1차 캐시 우회) ----------------

    /** {@code [amount, bidderId]} 형태의 ACTIVE 입찰 행. */
    protected List<Object[]> activeBids(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT b.amount, b.bidder.id FROM Bid b WHERE b.auction.id = :id AND b.status = :status",
            Object[].class)
            .setParameter("id", auctionId)
            .setParameter("status", BidStatus.ACTIVE)
            .getResultList();
    }

    /** {@code [userId, amount]} 형태의, 해당 경매에 걸린 HELD 홀드 행. */
    protected List<Object[]> heldRows(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT h.user.id, h.amount FROM MoneyHold h "
                + "WHERE h.bid.auction.id = :id AND h.status = :status",
            Object[].class)
            .setParameter("id", auctionId)
            .setParameter("status", MoneyHoldStatus.HELD)
            .getResultList();
    }

    /** 수용 순서(= id 순)대로 나열한 성립 입찰 금액. id 는 경매 행 락 아래에서 채번되므로 곧 직렬화 순서다. */
    protected List<Long> bidAmountsInAcceptanceOrder(Long auctionId) {
        em.clear();
        return em.createQuery(
            "SELECT b.amount FROM Bid b WHERE b.auction.id = :id ORDER BY b.id ASC", Long.class)
            .setParameter("id", auctionId)
            .getResultList();
    }

    protected Long maxBidAmount(Long auctionId) {
        em.clear();
        return em.createQuery("SELECT MAX(b.amount) FROM Bid b WHERE b.auction.id = :id", Long.class)
            .setParameter("id", auctionId)
            .getSingleResult();
    }

    protected long bidCount(Long auctionId) {
        em.clear();
        return em.createQuery("SELECT COUNT(b) FROM Bid b WHERE b.auction.id = :id", Long.class)
            .setParameter("id", auctionId)
            .getSingleResult();
    }

    protected long heldCount() {
        em.clear();
        return em.createQuery("SELECT COUNT(h) FROM MoneyHold h WHERE h.status = :status", Long.class)
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
    }

    protected long heldSum(User user) {
        em.clear();
        return em.createQuery(
            "SELECT COALESCE(SUM(h.amount), 0) FROM MoneyHold h WHERE h.user.id = :id AND h.status = :status",
            Long.class)
            .setParameter("id", user.getId())
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
    }

    protected UserBalance balanceOf(User user) {
        em.clear();
        return userBalanceRepository.findByUserId(user.getId()).orElseThrow();
    }

    protected Auction reload(Auction auction) {
        em.clear();
        return auctionRepository.findById(auction.getId()).orElseThrow();
    }

    // ---------------- 픽스처 ----------------

    protected Instant secondsLater(long seconds) {
        return Instant.now().plusSeconds(seconds).truncatedTo(ChronoUnit.MILLIS);
    }

    /** 기본 경매 — 소프트클로즈 30/30, 상한은 마감 +1시간(연장 여지 충분). */
    protected Auction persistAuction(User seller, int typeCode, Instant endAt) {
        return persistAuction(seller, typeCode, endAt, endAt.plus(1, ChronoUnit.HOURS), 30, 30);
    }

    protected Auction persistAuction(
        User seller, int typeCode, Instant endAt, Instant maxEndAt, int windowSec, int extendSec) {
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(seller).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build());
        return auctionRepository.save(Auction.builder()
            .seller(seller).itemInstance(item).startPrice(START_PRICE)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(maxEndAt)
            .softCloseWindowSec(windowSec).softCloseExtendSec(extendSec)
            .itemNameSnapshot("경합템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    protected ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("경합템플릿").build()));
    }

    protected User persistUser(String loginId, String nickname, long gameMoney) {
        User user = userRepository.save(
            User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        userBalanceRepository.save(balance);
        return user;
    }
}
