package com.finalcall.domain.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.member.User;
import com.finalcall.domain.shop.Shop;
import com.finalcall.domain.shop.ShopRepository;
import com.finalcall.domain.shop.ShopStatus;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 화해 histogram 집계 쿼리 슬라이스 테스트(search, FC-110 · search-spec §12.5) — 실제 MySQL(Testcontainers, H2 대체
 * 금지). {@code countGroupByStatus}(GROUP BY status)·{@code countGroupByPriceBucket}(floor(price/size)*size 버킷)의
 * SQL 이 MySQL 에서 정확히 도는지 확인한다 — 특히 가격 버킷의 정수 floor 표현식.
 *
 * <p>집계는 전건 대상이라 시드(V12·V13)가 섞이므로 <b>삽입 전후 델타</b>로 단언한다(시드 절대값에 의존하지 않음).
 * @DataJpaTest 롤백으로 삽입분은 정리된다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class SearchReconciliationAggregationSliceTest {

    private static final long BUCKET = 100_000L;

    @Autowired
    private AuctionRepository auctionRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 경매_상태별_count_는_삽입한_상태분포만큼_증가한다() {
        User owner = persistUser("recon_a_status");
        Map<AuctionStatus, Long> before = auctionRepository.countGroupByStatus();
        persistAuction(owner, 9601, AuctionStatus.ACTIVE, 1_000L);
        persistAuction(owner, 9602, AuctionStatus.ACTIVE, 2_000L);
        persistAuction(owner, 9603, AuctionStatus.SOLD, 3_000L);
        em.flush();
        em.clear();

        Map<AuctionStatus, Long> after = auctionRepository.countGroupByStatus();

        assertThat(delta(after, before, AuctionStatus.ACTIVE)).isEqualTo(2L);
        assertThat(delta(after, before, AuctionStatus.SOLD)).isEqualTo(1L);
    }

    @Test
    void 경매_가격버킷_count_는_floor_하한키로_그룹핑한다() {
        User owner = persistUser("recon_a_price");
        Map<Long, Long> before = auctionRepository.countGroupByPriceBucket(BUCKET);
        // 150_000·170_000 → 버킷 100_000, 250_000 → 버킷 200_000.
        persistAuction(owner, 9611, AuctionStatus.ACTIVE, 150_000L);
        persistAuction(owner, 9612, AuctionStatus.ACTIVE, 170_000L);
        persistAuction(owner, 9613, AuctionStatus.ACTIVE, 250_000L);
        em.flush();
        em.clear();

        Map<Long, Long> after = auctionRepository.countGroupByPriceBucket(BUCKET);

        assertThat(delta(after, before, 100_000L)).isEqualTo(2L);
        assertThat(delta(after, before, 200_000L)).isEqualTo(1L);
    }

    @Test
    void 고정가_상태별_count_는_삽입한_상태분포만큼_증가한다() {
        User owner = persistUser("recon_s_status");
        Map<ShopStatus, Long> before = shopRepository.countGroupByStatus();
        persistShop(owner, 9701, ShopStatus.ACTIVE, 1_000L);
        persistShop(owner, 9702, ShopStatus.SOLD, 2_000L);
        em.flush();
        em.clear();

        Map<ShopStatus, Long> after = shopRepository.countGroupByStatus();

        assertThat(delta(after, before, ShopStatus.ACTIVE)).isEqualTo(1L);
        assertThat(delta(after, before, ShopStatus.SOLD)).isEqualTo(1L);
    }

    @Test
    void 고정가_가격버킷_count_는_floor_하한키로_그룹핑한다() {
        User owner = persistUser("recon_s_price");
        Map<Long, Long> before = shopRepository.countGroupByPriceBucket(BUCKET);
        persistShop(owner, 9711, ShopStatus.ACTIVE, 120_000L);
        persistShop(owner, 9712, ShopStatus.ACTIVE, 199_999L);
        persistShop(owner, 9713, ShopStatus.ACTIVE, 300_000L);
        em.flush();
        em.clear();

        Map<Long, Long> after = shopRepository.countGroupByPriceBucket(BUCKET);

        assertThat(delta(after, before, 100_000L)).isEqualTo(2L); // 120_000·199_999
        assertThat(delta(after, before, 300_000L)).isEqualTo(1L);
    }

    private static <K> long delta(Map<K, Long> after, Map<K, Long> before, K key) {
        return after.getOrDefault(key, 0L) - before.getOrDefault(key, 0L);
    }

    private void persistAuction(User owner, int typeCode, AuctionStatus status, long startPrice) {
        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        auctionRepository.save(Auction.builder()
            .seller(owner).itemInstance(persistItem(owner, typeCode)).startPrice(startPrice)
            .status(status).endAt(end).maxEndAt(end.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("집계경매").itemSpecSnapshot("Lv.1").build());
    }

    private void persistShop(User owner, int typeCode, ShopStatus status, long price) {
        shopRepository.save(Shop.builder()
            .seller(owner).itemInstance(persistItem(owner, typeCode)).price(price).status(status)
            .endAt(Instant.now().plus(1, ChronoUnit.HOURS))
            .itemNameSnapshot("집계고정가").itemSpecSnapshot("Lv.1").build());
    }

    private ItemInstance persistItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(persistTemplate(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    /** typeCode 자리값에서 축을 파생해 복합 UK 를 유일화(형제 슬라이스 테스트와 동일 규약). 9xxx 대역으로 시드와 격리. */
    private ItemTemplate persistTemplate(int typeCode) {
        return em.createQuery("select t from ItemTemplate t where t.typeCode = :typeCode", ItemTemplate.class)
            .setParameter("typeCode", typeCode)
            .getResultStream().findFirst()
            .orElseGet(() -> {
                ItemTemplate template = ItemTemplate.builder()
                    .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                    .element(typeCode / 10 % 10).kind(typeCode % 10)
                    .typeCode(typeCode).displayName("집계템플릿").build();
                em.persist(template);
                return template;
            });
    }

    private User persistUser(String loginId) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(loginId).build();
        em.persist(user);
        return user;
    }
}
