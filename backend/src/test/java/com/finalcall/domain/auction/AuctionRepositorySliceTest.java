package com.finalcall.domain.auction;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.member.User;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 경매 리포지토리 슬라이스 테스트(auction, FC-026·FC-027) — 실제 MySQL(Testcontainers, H2 대체 금지).
 *
 * <p>출품 CAS(INVENTORY→LISTED)·취소 CAS(→CANCELLED)의 조건부 영향행, 상세 fetch join, keyset cursor 목록을
 * 검증한다. 소유자로 격리된 자체 데이터를 만들어 시드와 섞이지 않게 한다(@DataJpaTest 롤백).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class AuctionRepositorySliceTest {

    @Autowired
    private AuctionRepository auctionRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 출품_CAS는_INVENTORY만_LISTED로_전이하고_반복은_0행() {
        User owner = persistUser("cas_owner1", "출품자1");
        ItemInstance item = persistInventoryItem(owner, 0, 9201);
        em.flush();

        int first = itemInstanceRepository.markListedIfInInventory(item.getId());
        int second = itemInstanceRepository.markListedIfInInventory(item.getId());
        em.clear();

        assertThat(first).isEqualTo(1); // 선점 성공
        assertThat(second).isZero(); // 이미 LISTED — 재출품 불가
        ItemInstance reloaded = itemInstanceRepository.findById(item.getId()).orElseThrow();
        assertThat(reloaded.getLocation()).isEqualTo(ItemLocation.LISTED);
        assertThat(reloaded.getSlotNo()).isNull();
    }

    @Test
    void 취소_CAS는_SCHEDULED_ACTIVE_입찰0만_전이하고_반복은_0행() {
        User owner = persistUser("cas_owner2", "출품자2");
        ItemInstance item = persistListedItem(owner, 9202);
        Auction auction = auctionRepository.save(activeAuction(owner, item));
        em.flush();

        int first = auctionRepository.cancelIfCancellable(auction.getId());
        int second = auctionRepository.cancelIfCancellable(auction.getId());
        em.clear();

        assertThat(first).isEqualTo(1); // ACTIVE & 입찰0 → 취소 성공
        assertThat(second).isZero(); // 이미 CANCELLED — 재취소 불가
        Auction reloaded = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(AuctionStatus.CANCELLED);
    }

    @Test
    void 상세조회는_아이템_템플릿_판매자를_fetch_join한다() {
        User owner = persistUser("detail_owner", "상세판매자");
        ItemInstance item = persistListedItem(owner, 9203);
        Auction auction = auctionRepository.save(activeAuction(owner, item));
        em.flush();
        em.clear();

        Auction found = auctionRepository.findDetailByPublicId(auction.getPublicId()).orElseThrow();

        assertThat(found.getItemInstance().getTemplate().getTypeCode()).isEqualTo(9203);
        assertThat(found.getSeller().getNickname()).isEqualTo("상세판매자");
        assertThat(found.getItemNameSnapshot()).isEqualTo("경매템플릿");
    }

    @Test
    void 목록은_기본노출_SCHEDULED_ACTIVE만_endAt_asc로_cursor_페이지한다() {
        User owner = persistUser("list_owner", "목록판매자");
        Instant base = Instant.now().plus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
        // endAt 이 서로 다른 3건(오름차순 base, base+1h, base+2h) + CANCELLED 1건(기본 노출 제외).
        Auction a1 = auctionRepository.save(auctionWithEnd(owner, persistListedItem(owner, 9211), base));
        Auction a2 = auctionRepository.save(
            auctionWithEnd(owner, persistListedItem(owner, 9212), base.plus(1, ChronoUnit.HOURS)));
        auctionRepository.save(auctionWithEnd(owner, persistListedItem(owner, 9213), base.plus(2, ChronoUnit.HOURS)));
        Auction cancelled = auctionRepository.save(auctionWithEnd(owner, persistListedItem(owner, 9214), base));
        auctionRepository.cancelIfCancellable(cancelled.getId());
        em.flush();
        em.clear();

        AuctionSearchCondition condition = defaultCondition();
        List<Auction> firstPage = auctionRepository.findByCursor(condition, AuctionCursor.first(), 2, Instant.now());

        assertThat(firstPage).hasSize(3); // size(2) + 1(hasNext 판단분). CANCELLED 는 제외.
        assertThat(firstPage.get(0).getId()).isEqualTo(a1.getId()); // endAt asc — 가장 임박
        assertThat(firstPage.get(1).getId()).isEqualTo(a2.getId());

        // 두 번째 페이지: 첫 페이지 마지막(a2)을 커서로.
        AuctionCursor next = new AuctionCursor(a2.getEndAt().toString(), a2.getId());
        List<Auction> secondPage = auctionRepository.findByCursor(condition, next, 2, Instant.now());
        assertThat(secondPage).extracting(a -> a.getItemInstance().getTemplate().getTypeCode()).containsExactly(9213);
    }

    @Test
    void 목록_대분류_필터는_해당_템플릿만_반환한다() {
        User owner = persistUser("filter_owner", "필터판매자");
        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        auctionRepository.save(auctionWithEnd(owner, persistItem(owner, 1221), end)); // typeCode 자리값 → mainCategory=1
        auctionRepository.save(auctionWithEnd(owner, persistItem(owner, 2221), end)); // mainCategory=2
        em.flush();
        em.clear();

        AuctionSearchCondition condition = new AuctionSearchCondition(
            1, null, null, null, null, null, null, null, null, null, null, null,
            AuctionSort.END_AT, true);
        List<Auction> result = auctionRepository.findByCursor(condition, AuctionCursor.first(), 10, Instant.now());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getItemInstance().getTemplate().getMainCategory()).isEqualTo(1);
    }

    private AuctionSearchCondition defaultCondition() {
        return new AuctionSearchCondition(
            null, null, null, null, null, null, null, null, null, null, null, null, AuctionSort.END_AT, true);
    }

    private Auction activeAuction(User seller, ItemInstance item) {
        return auctionWithEnd(seller, item, Instant.now().plus(1, ChronoUnit.HOURS));
    }

    private Auction auctionWithEnd(User seller, ItemInstance item, Instant endAt) {
        return Auction.builder()
            .seller(seller).itemInstance(item).startPrice(1000L)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("경매템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
    }

    private ItemInstance persistInventoryItem(User owner, int slotNo, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(persistTemplate(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.INVENTORY).slotNo(slotNo).build();
        em.persist(item);
        return item;
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
        return persistItem(owner, typeCode);
    }

    private ItemInstance persistItem(User owner, int typeCode) {
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
            .typeCode(typeCode).displayName("경매템플릿").build();
        em.persist(template);
        return template;
    }

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }
}
