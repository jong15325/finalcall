package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.hibernate.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.shop.dto.ShopRecommendationsResponse;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.service.ShopRecommendationService;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;

/** 홈 추천 후보 쿼리의 운영 규모 실행계획을 실제 MySQL EXPLAIN ANALYZE로 재현한다. */
class ShopRecommendationQueryPlanIntegrationTest extends IntegrationTest {

    private static final int SHOP_COUNT = 10_000;
    private static final int SELLER_COUNT = 100;

    @Autowired
    private EntityManager em;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ShopRecommendationService shopRecommendationService;

    @AfterEach
    void cleanPlanFixture() {
        jdbcTemplate.update("""
            DELETE FROM sale_order
            WHERE seller_id IN (SELECT id FROM user WHERE login_id LIKE 'plan_%')
               OR buyer_id IN (SELECT id FROM user WHERE login_id LIKE 'plan_%')
            """);
        jdbcTemplate.update("""
            DELETE FROM shop
            WHERE seller_id IN (SELECT id FROM user WHERE login_id LIKE 'plan_%')
            """);
        jdbcTemplate.update("""
            DELETE FROM item_instance
            WHERE owner_id IN (SELECT id FROM user WHERE login_id LIKE 'plan_%')
            """);
        jdbcTemplate.update("DELETE FROM item_template WHERE type_code BETWEEN 9800 AND 9809");
        jdbcTemplate.update("DELETE FROM user WHERE login_id LIKE 'plan_%'");
    }

    @Test
    void 신규_마감_검증판매자_후보의_실제_실행계획을_남긴다() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        transactionTemplate.executeWithoutResult(status -> seedFixture(now));
        jdbcTemplate.execute("ANALYZE TABLE shop, sale_order");

        String newest = explain("""
            SELECT s.id
            FROM shop s
            WHERE s.status = 'ACTIVE'
              AND (s.end_at IS NULL OR s.end_at > ?)
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 30
            """, now);
        String newestWithoutIndex = explain("""
            SELECT s.id
            FROM shop s IGNORE INDEX (ix_shop_status_created_at_id)
            WHERE s.status = 'ACTIVE'
              AND (s.end_at IS NULL OR s.end_at > ?)
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 30
            """, now);
        Long newestShopId = jdbcTemplate.queryForObject(
            "SELECT id FROM shop WHERE status = 'ACTIVE' ORDER BY created_at DESC, id DESC LIMIT 1", Long.class);
        String fetchJoinNewest = explain("""
            SELECT s.id, ii.id, it.id, skill1.id, skill2.id, seller.id
            FROM shop s
            JOIN item_instance ii ON ii.id = s.item_instance_id
            JOIN item_template it ON it.id = ii.template_id
            LEFT JOIN skill_definition skill1 ON skill1.id = ii.skill1_id
            LEFT JOIN skill_definition skill2 ON skill2.id = ii.skill2_id
            JOIN user seller ON seller.id = s.seller_id
            WHERE s.id = ?
            """, newestShopId);
        String forcedNewest = explain("""
            SELECT s.id
            FROM shop s FORCE INDEX (ix_shop_status_created_at_id)
            WHERE s.status = 'ACTIVE'
              AND (s.end_at IS NULL OR s.end_at > ?)
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 30
            """, now);
        String endingSoon = explain("""
            SELECT s.id
            FROM shop s
            WHERE s.status = 'ACTIVE'
              AND s.end_at > ?
              AND s.end_at <= ?
            ORDER BY s.end_at ASC, s.id ASC
            LIMIT 30
            """, now, now.plus(24, ChronoUnit.HOURS));
        String trusted = explain("""
            SELECT s.id
            FROM shop s
            JOIN sale_order so ON so.seller_id = s.seller_id
            WHERE s.status = 'ACTIVE'
              AND (s.end_at IS NULL OR s.end_at > ?)
            GROUP BY s.id
            HAVING COUNT(so.id) >= 5
            ORDER BY COUNT(so.id) DESC, s.created_at DESC, s.id DESC
            LIMIT 30
            """, now);
        List<Map<String, Object>> indexes = jdbcTemplate.queryForList("""
            SHOW INDEX FROM shop
            WHERE Key_name = 'ix_shop_status_created_at_id'
            """);

        System.out.println("HOME_RECOMMEND_NEWEST_PLAN=" + newest);
        System.out.println("HOME_RECOMMEND_NEWEST_WITHOUT_INDEX_PLAN=" + newestWithoutIndex);
        System.out.println("HOME_RECOMMEND_NEWEST_FETCH_JOIN_PLAN=" + fetchJoinNewest);
        System.out.println("HOME_RECOMMEND_NEWEST_FORCED_PLAN=" + forcedNewest);
        System.out.println("HOME_RECOMMEND_ENDING_PLAN=" + endingSoon);
        System.out.println("HOME_RECOMMEND_TRUSTED_PLAN=" + trusted);
        assertThat(indexes)
            .extracting(row -> row.get("Key_name"), row -> row.get("Seq_in_index"), row -> row.get("Column_name"))
            .containsExactly(
                tuple("ix_shop_status_created_at_id", 1L, "status"),
                tuple("ix_shop_status_created_at_id", 2L, "created_at"),
                tuple("ix_shop_status_created_at_id", 3L, "id"));
        assertThat(newest)
            .contains("actual time")
            .contains("ix_shop_status_created_at_id")
            .doesNotContain("Sort:")
            .doesNotContain("Table scan");
        assertThat(newestWithoutIndex).contains("Sort:").contains("Table scan");
        assertThat(fetchJoinNewest)
            .contains("actual time")
            .doesNotContain("Sort:")
            .doesNotContain("Table scan on s");
        assertThat(forcedNewest)
            .contains("actual time")
            .contains("ix_shop_status_created_at_id")
            .doesNotContain("Sort:")
            .doesNotContain("Table scan");
        assertThat(endingSoon).contains("actual time").contains("ix_shop_status_end_at");
        assertThat(trusted).contains("actual time").containsIgnoringCase("aggregate").contains("Sort");
    }

    @Test
    void 동질_매물_1만건에서도_추천_SQL은_결과_수에_비례하는_상한을_지킨다() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        transactionTemplate.executeWithoutResult(status -> seedHomogeneousFixture(now));

        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        sessionFactory.getStatistics().setStatisticsEnabled(true);
        sessionFactory.getStatistics().clear();
        ShopRecommendationsResponse response = shopRecommendationService.getRecommendations();
        long preparedStatements = sessionFactory.getStatistics().getPrepareStatementCount();
        System.out.println("HOME_RECOMMEND_HOMOGENEOUS_QUERY_COUNT=" + preparedStatements);

        assertThat(response.items()).hasSize(6);
        assertThat(response.items().get(0).reason().name()).isEqualTo("NEW");
        assertThat(response.items().subList(1, 6))
            .allMatch(item -> item.reason().name().equals("GENERAL"));
        assertThat(preparedStatements).isLessThanOrEqualTo(25L);
    }

    private void seedFixture(Instant now) {
        List<User> sellers = sellers();
        User buyer = user("plan_buyer", "계획구매자");
        List<ItemTemplate> templates = templates();
        List<ItemInstance> representativeItems = new ArrayList<>();

        for (int index = 0; index < SHOP_COUNT; index++) {
            User seller = sellers.get(index % SELLER_COUNT);
            ItemInstance item = item(seller, templates.get(index % templates.size()));
            if (index < SELLER_COUNT) {
                representativeItems.add(item);
            }
            shop(seller, item, now.plus(index % 3 == 0 ? 12 : 168, ChronoUnit.HOURS));
            if (index % 200 == 0) {
                em.flush();
                em.clear();
            }
        }
        for (int sellerIndex = 0; sellerIndex < 20; sellerIndex++) {
            for (int orderIndex = 0; orderIndex < 5; orderIndex++) {
                saleOrder(sellers.get(sellerIndex), buyer, representativeItems.get(sellerIndex),
                    sellerIndex * 10L + orderIndex + 1L, now);
            }
        }
        em.flush();
        em.clear();
    }

    private void seedHomogeneousFixture(Instant now) {
        User seller = user("plan_homogeneous", "동질판매자");
        ItemTemplate template = ItemTemplate.builder()
            .mainCategory(8).subGroup(0).element(0).kind(0)
            .typeCode(9800).displayName("동질 계획 템플릿").build();
        em.persist(template);
        for (int index = 0; index < SHOP_COUNT; index++) {
            ItemInstance item = item(seller, template);
            shop(seller, item, now.plus(7, ChronoUnit.DAYS));
            if (index % 200 == 0) {
                em.flush();
                em.clear();
            }
        }
        em.flush();
        em.clear();
    }

    private String explain(String sql, Object... args) {
        return String.join(" | ", jdbcTemplate.queryForList("EXPLAIN ANALYZE " + sql, String.class, args));
    }

    private List<User> sellers() {
        List<User> sellers = new ArrayList<>();
        for (int index = 0; index < SELLER_COUNT; index++) {
            sellers.add(user("plan_seller_" + index, "계획판매자" + index));
        }
        return sellers;
    }

    private List<ItemTemplate> templates() {
        List<ItemTemplate> templates = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            ItemTemplate template = ItemTemplate.builder()
                .mainCategory(8).subGroup(index).element(0).kind(0)
                .typeCode(9800 + index).displayName("계획 템플릿 " + index).build();
            em.persist(template);
            templates.add(template);
        }
        return templates;
    }

    private User user(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }

    private ItemInstance item(User owner, ItemTemplate template) {
        ItemInstance item = ItemInstance.builder()
            .template(template).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    private void shop(User seller, ItemInstance item, Instant endAt) {
        em.persist(Shop.builder()
            .seller(seller).itemInstance(item).price(1_000_000L).status(ShopStatus.ACTIVE).endAt(endAt)
            .itemNameSnapshot("계획 아이템").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    private void saleOrder(User seller, User buyer, ItemInstance item, long sourceId, Instant settledAt) {
        em.persist(SaleOrder.builder()
            .sourceType(SaleOrderSourceType.SHOP).sourceId(sourceId)
            .buyer(buyer).seller(seller).itemInstance(item)
            .finalPrice(1_000_000L).feeAmount(50_000L).settleAmount(950_000L)
            .feePolicyVersion("v1").settledAt(settledAt)
            .build());
    }
}
