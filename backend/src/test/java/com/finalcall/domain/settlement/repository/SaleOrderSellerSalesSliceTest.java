package com.finalcall.domain.settlement.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 판매자 완료 판매 건수 집계 슬라이스 테스트(settlement, FC-149) — 실제 MySQL(Testcontainers, H2 대체 금지).
 *
 * <p>{@code sale_order} seller_id 배치/단건 카운트가 (1) 경매(AUCTION)+마켓(SHOP) 두 채널을 합산하고, (2) 이력
 * 없는 판매자를 맵에서 배제(호출측 0 매핑)하며, (3) 목록 조립을 <b>페이지당 1쿼리</b>로 끝내(N+1 없음) 계약
 * (shop-spec §11)을 지키는지 검증한다. 셀러를 새로 만들어 시드 sale_order 와 섞이지 않게 격리한다(@DataJpaTest 롤백).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class SaleOrderSellerSalesSliceTest {

    @Autowired
    private SaleOrderRepository saleOrderRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 단건_카운트는_경매와_마켓_두_채널을_합산한다() {
        User seller = persistUser("scs_sum_s", "합산판매자");
        User buyer = persistUser("scs_sum_b", "구매자");
        // 경매 낙찰 2건 + 마켓 판매 1건 = 완료 3건(source_type 무관 합산).
        persistSaleOrder(seller, buyer, SaleOrderSourceType.AUCTION, 9601);
        persistSaleOrder(seller, buyer, SaleOrderSourceType.AUCTION, 9602);
        persistSaleOrder(seller, buyer, SaleOrderSourceType.SHOP, 9603);
        em.flush();
        em.clear();

        assertThat(saleOrderRepository.countCompletedSalesBySellerId(seller.getId())).isEqualTo(3);
    }

    @Test
    void 판매이력_없는_판매자는_0이다() {
        User seller = persistUser("scs_zero_s", "무이력판매자");
        em.flush();
        em.clear();

        assertThat(saleOrderRepository.countCompletedSalesBySellerId(seller.getId())).isZero();
    }

    @Test
    void 배치_집계는_판매자별로_묶고_미등장_판매자는_맵에_없다() {
        User s1 = persistUser("scs_b_s1", "판매자1");
        User s2 = persistUser("scs_b_s2", "판매자2");
        User s3 = persistUser("scs_b_s3", "판매자3"); // 판매 이력 없음 → 맵에서 배제
        User buyer = persistUser("scs_b_buy", "구매자");
        persistSaleOrder(s1, buyer, SaleOrderSourceType.AUCTION, 9611);
        persistSaleOrder(s1, buyer, SaleOrderSourceType.SHOP, 9612);
        persistSaleOrder(s2, buyer, SaleOrderSourceType.SHOP, 9613);
        em.flush();
        em.clear();

        Map<Long, Long> counts = saleOrderRepository.countCompletedSalesBySellerIds(
            List.of(s1.getId(), s2.getId(), s3.getId()));

        assertThat(counts).containsEntry(s1.getId(), 2L).containsEntry(s2.getId(), 1L);
        assertThat(counts).doesNotContainKey(s3.getId()); // 미등장 = 호출측이 0 으로 매핑
    }

    @Test
    void 빈_입력은_쿼리_없이_빈_맵이다() {
        Statistics statistics = statistics();
        statistics.clear();

        Map<Long, Long> counts = saleOrderRepository.countCompletedSalesBySellerIds(List.of());

        assertThat(counts).isEmpty();
        assertThat(statistics.getPrepareStatementCount()).isZero(); // IN () 렌더 회피 = 쿼리 자체 생략
    }

    @Test
    void 배치_집계는_판매자가_많아도_단_한_쿼리다() {
        User buyer = persistUser("scs_n1_buy", "구매자");
        User s1 = persistUser("scs_n1_s1", "판매자1");
        User s2 = persistUser("scs_n1_s2", "판매자2");
        User s3 = persistUser("scs_n1_s3", "판매자3");
        persistSaleOrder(s1, buyer, SaleOrderSourceType.SHOP, 9621);
        persistSaleOrder(s2, buyer, SaleOrderSourceType.AUCTION, 9622);
        persistSaleOrder(s3, buyer, SaleOrderSourceType.SHOP, 9623);
        em.flush();
        em.clear();

        Statistics statistics = statistics();
        statistics.clear();
        saleOrderRepository.countCompletedSalesBySellerIds(List.of(s1.getId(), s2.getId(), s3.getId()));

        // 판매자 3인데도 JDBC 준비 문장은 1개 — 행별(리스팅마다) 카운트가 아니라 배치 IN 집계임을 증명한다.
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
    }

    private Statistics statistics() {
        Statistics statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        return statistics;
    }

    private SaleOrder persistSaleOrder(User seller, User buyer, SaleOrderSourceType sourceType, int typeCode) {
        ItemInstance item = persistItem(seller, typeCode);
        SaleOrder order = SaleOrder.builder()
            .sourceType(sourceType).sourceId((long)typeCode)
            .buyer(buyer).seller(seller).itemInstance(item)
            .finalPrice(1_000_000L).feeAmount(50_000L).settleAmount(950_000L)
            .feePolicyVersion("v1").settledAt(Instant.now())
            .build();
        em.persist(order);
        return order;
    }

    /** LISTED(slot NULL)로 만든다 — INVENTORY slot_key UK(owner, slot_no) 충돌을 피한다(count 는 location 무관). */
    private ItemInstance persistItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(persistTemplate(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

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

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }
}
