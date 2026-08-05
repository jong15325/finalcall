package com.finalcall.domain.delivery.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;

import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
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
 * 배송(우편함) 리포지토리 슬라이스 테스트(delivery, FC-186) — 실제 MySQL(Testcontainers, H2 대체 금지).
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL 을 써야 Flyway V21 DDL·
 * sale_order/item_uuid UK·CHAR 매핑·(status, created_at)·(recipient_user_id, status) 인덱스 조회·FK 가 실제로
 * 검증된다. @DataJpaTest 는 기본 {@code @Transactional} → 각 테스트 롤백.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class ItemDeliveryRepositorySliceTest {

    @Autowired
    private ItemDeliveryRepository deliveryRepository;

    @Autowired
    private EntityManager em;

    @Test
    void enqueue는_PENDING과_public_id_자족_스냅샷을_기록한다() {
        SaleOrder order = persistSaleOrder(7001);
        ItemDelivery saved = deliveryRepository.save(delivery(order, "안녕수령자").itemUuid("uuid-snap").build());
        em.flush();
        em.clear();

        ItemDelivery found = deliveryRepository.findByPublicId(saved.getPublicId()).orElseThrow();
        assertThat(found.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(found.getPublicId()).hasSize(26);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getItemUuid()).isEqualTo("uuid-snap");
        assertThat(found.getRecipientNickname()).isEqualTo("안녕수령자");
        assertThat(found.getTypeCode()).isEqualTo(7001);
        assertThat(found.getClaimToken()).isNull();
    }

    @Test
    void sale_order_id_UK가_이중_배송을_DB에서_차단한다() {
        SaleOrder order = persistSaleOrder(7002);
        deliveryRepository.saveAndFlush(delivery(order, "수령").itemUuid(uuid()).build());

        // 같은 sale_order 로 두 번째 배송 → uk_item_delivery_sale_order 위반.
        assertThatThrownBy(() -> deliveryRepository.saveAndFlush(delivery(order, "수령").itemUuid(uuid()).build()))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void item_uuid_UK가_중복_멱등키를_DB에서_차단한다() {
        SaleOrder order1 = persistSaleOrder(7003);
        SaleOrder order2 = persistSaleOrder(7004);
        deliveryRepository.saveAndFlush(delivery(order1, "수령").itemUuid("dup-uuid").build());

        assertThatThrownBy(() -> deliveryRepository.saveAndFlush(delivery(order2, "수령").itemUuid("dup-uuid").build()))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void poller는_상태별로_오래된_순으로_조회한다() {
        ItemDelivery pending = deliveryRepository.save(delivery(persistSaleOrder(7005), "수령").itemUuid(uuid()).build());
        ItemDelivery deferred = deliveryRepository
            .save(delivery(persistSaleOrder(7006), "수령").itemUuid(uuid()).build());
        deferred.claim("t", Instant.now());
        deferred.defer("t");
        ItemDelivery applied = deliveryRepository.save(delivery(persistSaleOrder(7007), "수령").itemUuid(uuid()).build());
        applied.claim("t", Instant.now());
        applied.apply("t", Instant.now());
        em.flush();
        em.clear();

        List<ItemDelivery> waiting = deliveryRepository.findByStatusInOrderByCreatedAtAsc(
            List.of(DeliveryStatus.PENDING, DeliveryStatus.DEFERRED), Limit.of(50));

        assertThat(waiting).extracting(ItemDelivery::getId)
            .contains(pending.getId(), deferred.getId())
            .doesNotContain(applied.getId()); // APPLIED 는 대기분 아님
    }

    @Test
    void 수령자별_대기_배송을_상태로_필터해_조회한다() {
        User recipient = persistUser("dlv_recv", "수령자");
        User other = persistUser("dlv_other", "타인");
        ItemDelivery mine = deliveryRepository.save(
            delivery(persistSaleOrder(7008, recipient), "수령자").recipientUserId(recipient.getId())
                .itemUuid(uuid()).build());
        deliveryRepository.save(
            delivery(persistSaleOrder(7009, other), "타인").recipientUserId(other.getId()).itemUuid(uuid()).build());
        em.flush();
        em.clear();

        List<ItemDelivery> mineWaiting = deliveryRepository.findByRecipientUserIdAndStatusInOrderByCreatedAtAsc(
            recipient.getId(), List.of(DeliveryStatus.PENDING, DeliveryStatus.DEFERRED));

        assertThat(mineWaiting).extracting(ItemDelivery::getId).containsExactly(mine.getId());
    }

    private String uuid() {
        return UUID.randomUUID().toString();
    }

    /** 기본 수령자(buyer)로 배송 빌더를 만든다 — 호출 측이 itemUuid·recipientUserId 를 오버라이드할 수 있다. */
    private ItemDelivery.ItemDeliveryBuilder delivery(SaleOrder order, String recipientNickname) {
        return ItemDelivery.builder()
            .saleOrderId(order.getId())
            .itemInstanceId(order.getItemInstance().getId())
            .recipientUserId(order.getBuyer().getId())
            .recipientNickname(recipientNickname)
            .typeCode(order.getItemInstance().getTemplate().getTypeCode())
            .level(1)
            .skillPercent(0);
    }

    private SaleOrder persistSaleOrder(int typeCode) {
        return persistSaleOrder(typeCode, persistUser("dlv_buy_" + typeCode, "구매자" + typeCode));
    }

    private SaleOrder persistSaleOrder(int typeCode, User buyer) {
        User seller = persistUser("dlv_sell_" + typeCode, "판매자" + typeCode);
        ItemInstance item = persistItem(buyer, typeCode);
        SaleOrder order = SaleOrder.builder()
            .sourceType(SaleOrderSourceType.AUCTION).sourceId((long)typeCode)
            .buyer(buyer).seller(seller).itemInstance(item)
            .finalPrice(1_000_000L).feeAmount(50_000L).settleAmount(950_000L)
            .feePolicyVersion("v1").settledAt(Instant.now())
            .build();
        em.persist(order);
        return order;
    }

    /** LISTED(slot NULL)로 만든다 — INVENTORY slot_key UK 충돌 회피(배송은 location 무관). */
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
                    .typeCode(typeCode).displayName("배송템플릿").build();
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
