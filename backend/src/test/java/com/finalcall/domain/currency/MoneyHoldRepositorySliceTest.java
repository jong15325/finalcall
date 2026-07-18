package com.finalcall.domain.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.Bid;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.member.User;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 홀드 원장 리포지토리 슬라이스 테스트(currency, FC-031) — 실제 MySQL(Testcontainers, H2 대체 금지).
 *
 * <p>V11 스키마와 {@link MoneyHold} 매핑의 정합, {@code bid_id} UK(홀드-입찰 1:1)의 DB 강제, 해제 조건부 CAS 가
 * 이중 해제를 0행으로 거절하는지를 검증한다. UK 는 앱 검증이 아니라 <b>스키마</b>가 지켜야 하는 불변식이라
 * 실제 DB 에서 확인한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class MoneyHoldRepositorySliceTest {

    @Autowired
    private MoneyHoldRepository moneyHoldRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 홀드는_HELD_상태와_해제시각_null로_저장된다() {
        User user = persistUser("hold_user1", "홀더1");
        Bid bid = persistBid(user, 8401, 5000L);

        MoneyHold saved = moneyHoldRepository.saveAndFlush(hold(user, bid, 5000L));
        em.clear();

        MoneyHold reloaded = moneyHoldRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(MoneyHoldStatus.HELD);
        assertThat(reloaded.getReleasedAt()).isNull();
        assertThat(reloaded.getAmount()).isEqualTo(5000L);
    }

    @Test
    void 같은_입찰에_홀드를_두_건_만들면_UK가_차단한다() {
        User user = persistUser("hold_user2", "홀더2");
        Bid bid = persistBid(user, 8402, 5000L);
        moneyHoldRepository.saveAndFlush(hold(user, bid, 5000L));

        // 홀드-입찰 1:1(erd §4.1). 앱 검증을 우회해도 bid_id UK 가 중복 홀드를 막는다.
        assertThatThrownBy(() -> moneyHoldRepository.saveAndFlush(hold(user, bid, 5000L)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 해제_CAS는_HELD만_전이하고_반복은_0행() {
        User user = persistUser("hold_user3", "홀더3");
        Bid bid = persistBid(user, 8403, 5000L);
        MoneyHold held = moneyHoldRepository.saveAndFlush(hold(user, bid, 5000L));
        Instant releasedAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        int first = moneyHoldRepository.releaseIfHeld(held.getId(), releasedAt);
        int second = moneyHoldRepository.releaseIfHeld(held.getId(), releasedAt);
        em.clear();

        assertThat(first).isEqualTo(1); // HELD → RELEASED 해제 성공
        assertThat(second).isZero(); // 이미 RELEASED — 이중 해제 불가(무자본 입찰 방어)
        MoneyHold reloaded = moneyHoldRepository.findById(held.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(MoneyHoldStatus.RELEASED);
        assertThat(reloaded.getReleasedAt()).isNotNull();
    }

    @Test
    void 유효홀드_조회는_HELD만_반환한다() {
        User user = persistUser("hold_user4", "홀더4");
        Bid bid = persistBid(user, 8404, 7000L);
        MoneyHold held = moneyHoldRepository.saveAndFlush(hold(user, bid, 7000L));
        em.flush();
        em.clear();

        MoneyHoldSnapshot snapshot = moneyHoldRepository.findHeldByBidId(bid.getId()).orElseThrow();
        assertThat(snapshot.holdId()).isEqualTo(held.getId());
        assertThat(snapshot.userId()).isEqualTo(user.getId());
        assertThat(snapshot.amount()).isEqualTo(7000L);

        moneyHoldRepository.releaseIfHeld(held.getId(), Instant.now());
        em.clear();
        assertThat(moneyHoldRepository.findHeldByBidId(bid.getId())).isEmpty(); // 해제 후에는 대상이 아니다
    }

    private MoneyHold hold(User user, Bid bid, long amount) {
        return MoneyHold.builder().user(user).bid(bid).amount(amount).build();
    }

    private Bid persistBid(User bidder, int typeCode, long amount) {
        Bid bid = Bid.builder().auction(persistAuction(bidder, typeCode)).bidder(bidder).amount(amount).build();
        em.persist(bid);
        em.flush();
        return bid;
    }

    private Auction persistAuction(User seller, int typeCode) {
        Instant endAt = Instant.now().plus(1, ChronoUnit.HOURS);
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(persistListedItem(seller, typeCode)).startPrice(1000L)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("홀드템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(auction);
        return auction;
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(persistTemplate(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    /** 축(main/sub/element/kind)을 typeCode 자리값에서 파생해 복합 UK 도 유일하게 만든다(시드 규약 동일). */
    private ItemTemplate persistTemplate(int typeCode) {
        ItemTemplate template = ItemTemplate.builder()
            .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
            .element(typeCode / 10 % 10).kind(typeCode % 10)
            .typeCode(typeCode).displayName("홀드템플릿").build();
        em.persist(template);
        return template;
    }

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }
}
