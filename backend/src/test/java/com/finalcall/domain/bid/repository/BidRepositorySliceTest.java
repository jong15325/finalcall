package com.finalcall.domain.bid.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.bid.entity.Bid;
import com.finalcall.domain.bid.entity.BidSnapshot;
import com.finalcall.domain.bid.entity.BidStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.member.entity.User;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 입찰 리포지토리 슬라이스 테스트(bid, FC-031) — 실제 MySQL(Testcontainers, H2 대체 금지).
 *
 * <p>V11 스키마와 {@link Bid} 매핑의 정합(ddl-auto=validate 통과), 현재 최고 입찰 단건 스냅샷 조회, ACTIVE→OUTBID
 * 조건부 CAS 의 영향행을 검증한다. 자체 데이터를 만들어 시드와 섞이지 않게 한다(@DataJpaTest 롤백).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class BidRepositorySliceTest {

    @Autowired
    private BidRepository bidRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 입찰은_ULID_public_id와_ACTIVE_상태로_저장된다() {
        User seller = persistUser("bid_seller1", "판매자1");
        User bidder = persistUser("bid_bidder1", "입찰자1");
        Auction auction = persistAuction(seller, 8301);

        Bid saved = bidRepository.saveAndFlush(bid(auction, bidder, 1500L));
        em.clear();

        Bid reloaded = bidRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPublicId()).hasSize(26); // CHAR(26) ULID — 패딩 없이 그대로 왕복해야 한다
        assertThat(reloaded.getStatus()).isEqualTo(BidStatus.ACTIVE);
        assertThat(reloaded.getAmount()).isEqualTo(1500L);
        assertThat(bidRepository.findByPublicId(saved.getPublicId())).isPresent();
    }

    @Test
    void 현재_최고_입찰은_ACTIVE_단건을_스냅샷으로_반환한다() {
        User seller = persistUser("bid_seller2", "판매자2");
        User first = persistUser("bid_bidder2a", "입찰자2a");
        User second = persistUser("bid_bidder2b", "입찰자2b");
        Auction auction = persistAuction(seller, 8302);

        Bid outbid = bidRepository.saveAndFlush(bid(auction, first, 1000L));
        Bid current = bidRepository.saveAndFlush(bid(auction, second, 2000L));
        bidRepository.markOutbidIfActive(outbid.getId()); // 밀려난 입찰 — 스냅샷 대상에서 빠져야 한다
        em.flush();
        em.clear();

        BidSnapshot snapshot = bidRepository.findActiveByAuctionId(auction.getId()).orElseThrow();

        assertThat(snapshot.bidId()).isEqualTo(current.getId());
        assertThat(snapshot.bidderId()).isEqualTo(second.getId());
        assertThat(snapshot.amount()).isEqualTo(2000L);
    }

    @Test
    void 입찰이_없는_경매의_최고_입찰_스냅샷은_비어있다() {
        User seller = persistUser("bid_seller3", "판매자3");
        Auction auction = persistAuction(seller, 8303);
        em.flush();
        em.clear();

        assertThat(bidRepository.findActiveByAuctionId(auction.getId())).isEmpty();
    }

    @Test
    void OUTBID_CAS는_ACTIVE만_전이하고_반복은_0행() {
        User seller = persistUser("bid_seller4", "판매자4");
        User bidder = persistUser("bid_bidder4", "입찰자4");
        Auction auction = persistAuction(seller, 8304);
        Bid target = bidRepository.saveAndFlush(bid(auction, bidder, 3000L));

        int first = bidRepository.markOutbidIfActive(target.getId());
        int second = bidRepository.markOutbidIfActive(target.getId());
        em.clear();

        assertThat(first).isEqualTo(1); // ACTIVE → OUTBID 전이 성공
        assertThat(second).isZero(); // 이미 OUTBID — 이중 전이 불가(불변식 I1 방어)
        assertThat(bidRepository.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(BidStatus.OUTBID);
        // 최고 입찰이 사라졌으므로 스냅샷도 비어야 한다.
        assertThat(bidRepository.findActiveByAuctionId(auction.getId())).isEqualTo(Optional.empty());
    }

    private Bid bid(Auction auction, User bidder, long amount) {
        return Bid.builder().auction(auction).bidder(bidder).amount(amount).build();
    }

    private Auction persistAuction(User seller, int typeCode) {
        Instant endAt = Instant.now().plus(1, ChronoUnit.HOURS);
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(persistListedItem(seller, typeCode)).startPrice(1000L)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("입찰템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
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
            .typeCode(typeCode).displayName("입찰템플릿").build();
        em.persist(template);
        return template;
    }

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }
}
