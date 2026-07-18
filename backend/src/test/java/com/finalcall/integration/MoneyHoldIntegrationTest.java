package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.Bid;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.currency.MoneyHold;
import com.finalcall.domain.currency.MoneyHoldRepository;
import com.finalcall.domain.currency.MoneyHoldService;
import com.finalcall.domain.currency.MoneyHoldStatus;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 홀드 생성·해제 불변식 통합 검증(currency, FC-031) — 실제 MySQL(Testcontainers).
 *
 * <p>단위 테스트가 호출 순서를, 슬라이스 테스트가 스키마·CAS 를 맡는 반면 여기서는 <b>잔액과 원장이 실제로 함께
 * 움직이는지</b>를 본다. 최악 시나리오가 홀드 미해제(자금 동결)와 이중 해제(무자본 입찰)이므로, 검증 대상은
 * 서비스 반환값이 아니라 {@code user_balance}·{@code money_hold} <b>테이블 상태</b>다(bid-domain-spec §10 I3·I4).
 *
 * <p>{@code MoneyHoldService} 는 {@code Propagation.MANDATORY} 라 트랜잭션 없이는 호출 자체가 불가능하다 —
 * 테스트 클래스의 {@code @Transactional} 이 그 트랜잭션이자 데이터 정리(롤백) 수단이다.
 */
@Transactional
class MoneyHoldIntegrationTest extends IntegrationTest {

    private static final long BALANCE = 10_000L;
    private static final long FIRST_BID = 3_000L;
    private static final long SECOND_BID = 5_000L;

    @Autowired
    private MoneyHoldService moneyHoldService;

    @Autowired
    private MoneyHoldRepository moneyHoldRepository;

    @Autowired
    private BidRepository bidRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private EntityManager em;

    private User seller;
    private User firstBidder;
    private User secondBidder;
    private Auction auction;

    @BeforeEach
    void setUp() {
        seller = persistUserWithBalance("hold_it_seller", "판매자", 0L);
        firstBidder = persistUserWithBalance("hold_it_bidder1", "입찰자1", BALANCE);
        secondBidder = persistUserWithBalance("hold_it_bidder2", "입찰자2", BALANCE);
        auction = persistAuction(seller);
        em.flush();
    }

    @Test
    void 첫_홀드는_가용잔액을_묶고_원장에_HELD로_남는다() {
        Bid bid = persistBid(firstBidder, FIRST_BID);

        MoneyHold hold = moneyHoldService.placeHold(firstBidder.getId(), bid.getId(), FIRST_BID, null);

        UserBalance balance = reloadBalance(firstBidder);
        assertThat(balance.getGameMoneyHeld()).isEqualTo(FIRST_BID);
        assertThat(balance.getGameMoneyBalance()).isEqualTo(BALANCE); // 홀드는 차감이 아니라 잠금이다
        assertThat(balance.getGameMoneyAvailable()).isEqualTo(BALANCE - FIRST_BID);
        assertThat(reload(hold).getStatus()).isEqualTo(MoneyHoldStatus.HELD);
    }

    @Test
    void 상위_입찰은_직전_홀드를_즉시_해제하고_새_홀드를_잡는다() {
        Bid firstBid = persistBid(firstBidder, FIRST_BID);
        MoneyHold firstHold = moneyHoldService.placeHold(firstBidder.getId(), firstBid.getId(), FIRST_BID, null);
        Bid secondBid = persistBid(secondBidder, SECOND_BID);

        MoneyHold secondHold = moneyHoldService.placeHold(
            secondBidder.getId(), secondBid.getId(), SECOND_BID, firstBid.getId());

        // P-008 즉시 해제 — 밀려난 입찰자의 자금은 마감을 기다리지 않고 즉시 풀린다.
        assertThat(reloadBalance(firstBidder).getGameMoneyHeld()).isZero();
        assertThat(reloadBalance(secondBidder).getGameMoneyHeld()).isEqualTo(SECOND_BID);

        MoneyHold released = reload(firstHold);
        assertThat(released.getStatus()).isEqualTo(MoneyHoldStatus.RELEASED);
        assertThat(released.getReleasedAt()).isNotNull();
        assertThat(reload(secondHold).getStatus()).isEqualTo(MoneyHoldStatus.HELD);

        // I3: 경매당 HELD 홀드는 최대 1건이며 그 보유자가 현재 최고 입찰자다.
        assertThat(moneyHoldRepository.findHeldByBidId(firstBid.getId())).isEmpty();
        assertThat(moneyHoldRepository.findHeldByBidId(secondBid.getId())).isPresent();
    }

    @Test
    void 같은_홀드를_두_번_해제할_수_없다() {
        Bid bid = persistBid(firstBidder, FIRST_BID);
        moneyHoldService.placeHold(firstBidder.getId(), bid.getId(), FIRST_BID, null);
        moneyHoldService.release(bid.getId());

        // 이미 RELEASED — 두 번째 해제는 조건부 CAS 가 0행으로 막고 예외로 올라간다(무자본 입찰 방어).
        assertThatThrownBy(() -> moneyHoldService.release(bid.getId()))
            .isInstanceOf(BusinessException.class);

        assertThat(reloadBalance(firstBidder).getGameMoneyHeld()).isZero(); // 홀드가 음수로 내려가지 않는다
    }

    @Test
    void 가용잔액을_넘는_홀드는_BID_005로_거절되고_원장에_남지_않는다() {
        Bid bid = persistBid(firstBidder, BALANCE + 1);

        assertThatThrownBy(() -> moneyHoldService.placeHold(firstBidder.getId(), bid.getId(), BALANCE + 1, null))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(BidErrorCode.BID_INSUFFICIENT_BALANCE);

        assertThat(reloadBalance(firstBidder).getGameMoneyHeld()).isZero();
        assertThat(moneyHoldRepository.findHeldByBidId(bid.getId())).isEmpty();
    }

    @Test
    void 이미_홀드된_금액은_다음_홀드의_가용잔액에서_빠진다() {
        Bid first = persistBid(firstBidder, SECOND_BID);
        moneyHoldService.placeHold(firstBidder.getId(), first.getId(), SECOND_BID, null);
        Bid second = persistBid(firstBidder, BALANCE - SECOND_BID + 1); // 남은 가용을 1 초과

        assertThatThrownBy(() -> moneyHoldService.placeHold(
            firstBidder.getId(), second.getId(), BALANCE - SECOND_BID + 1, null))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(BidErrorCode.BID_INSUFFICIENT_BALANCE);

        assertThat(reloadBalance(firstBidder).getGameMoneyHeld()).isEqualTo(SECOND_BID); // 기존 홀드는 그대로
    }

    private MoneyHold reload(MoneyHold hold) {
        em.clear();
        return moneyHoldRepository.findById(hold.getId()).orElseThrow();
    }

    private UserBalance reloadBalance(User user) {
        em.clear();
        return userBalanceRepository.findByUserId(user.getId()).orElseThrow();
    }

    private Bid persistBid(User bidder, long amount) {
        Bid bid = bidRepository.saveAndFlush(
            Bid.builder().auction(auction).bidder(bidder).amount(amount).build());
        em.flush();
        return bid;
    }

    private Auction persistAuction(User owner) {
        Instant endAt = Instant.now().plus(1, ChronoUnit.HOURS);
        Auction created = Auction.builder()
            .seller(owner).itemInstance(persistListedItem(owner)).startPrice(1000L)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("홀드통합템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(created);
        return created;
    }

    private ItemInstance persistListedItem(User owner) {
        ItemInstance item = ItemInstance.builder()
            .template(persistTemplate()).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    /** 축(main/sub/element/kind)을 typeCode 자리값에서 파생해 복합 UK 도 유일하게 만든다(시드 규약 동일). */
    private ItemTemplate persistTemplate() {
        ItemTemplate template = ItemTemplate.builder()
            .mainCategory(8).subGroup(5).element(0).kind(1)
            .typeCode(8501).displayName("홀드통합템플릿").build();
        em.persist(template);
        return template;
    }

    private User persistUserWithBalance(String loginId, String nickname, long gameMoney) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        em.persist(balance);
        return user;
    }
}
