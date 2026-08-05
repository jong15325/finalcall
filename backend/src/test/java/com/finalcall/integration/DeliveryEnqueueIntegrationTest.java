package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.SkillDefinition;
import com.finalcall.domain.item.repository.SkillDefinitionRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.settlement.service.SettlementRecorder;
import com.finalcall.support.PurchaseTestBase;

/**
 * 정산 TX 내 배송 enqueue 통합 검증(delivery, FC-187) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>delivery-domain-spec §7.3(트랜잭셔널 아웃박스)·§8 불변식 D-A·D-B·D-C 를 DB 상태로 고정한다. 낙찰(closing)·
 * 즉시구매(purchase) 양 경로가 {@link SettlementRecorder} 공통 꼬리에서 배송 1행(PENDING)을 <b>정산과 같은 TX</b> 로
 * 생성하고(D-A·D-B), 자족 스냅샷(type_code·level 1-based·skill 3필드·gf·item_uuid·수령자)을 행에 싣고(D-C),
 * {@code sale_order_id} 1:1 UK 가 이중 배송을 DB 에서 차단하며, 정산 롤백 시 배송도 함께 롤백됨(고아 배송 없음)을
 * 검사한다. 단언 대상은 API 응답이 아니라 테이블 상태다. 다른 테스트와 충돌하지 않도록 <b>94xx 대역</b>을 쓴다.
 */
class DeliveryEnqueueIntegrationTest extends PurchaseTestBase {

    @Autowired
    private SettlementRecorder settlementRecorder;

    @Autowired
    private SkillDefinitionRepository skillDefinitionRepository;

    @Test
    void 낙찰_정산은_배송_우편함_1행을_PENDING으로_같은TX에_생성한다() {
        User seller = persistUser("dq_sold_seller", "판매자", 0L);
        User winner = persistUser("dq_sold_winner", "낙찰자닉", BALANCE);
        ItemInstance item = persistListedItem(seller, 9401);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));
        long price = 500_000L;
        placeBid(winner, auction.getPublicId(), price);
        expireAuction(auction.getId(), now().minusSeconds(5));

        closeService.closeOne(auction.getId(), now());

        // D-A·D-B: 낙찰 정산 커밋과 함께 sale_order 1건에 대응하는 배송 1행이 PENDING 으로 존재한다.
        SaleOrder order = saleOrders(auction.getId()).get(0);
        List<ItemDelivery> deliveries = deliveriesForSaleOrder(order.getId());
        assertThat(deliveries).hasSize(1);
        ItemDelivery delivery = deliveries.get(0);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        // D-C: 수령자·대상 링크가 낙찰자·낙찰 아이템을 가리킨다.
        assertThat(delivery.getItemInstanceId()).isEqualTo(item.getId());
        assertThat(delivery.getRecipientUserId()).isEqualTo(winner.getId());
        assertThat(delivery.getRecipientNickname()).isEqualTo("낙찰자닉");
        // 멱등키: 표준 UUID 36자를 웹이 발급해 심는다(§5·§7.3).
        assertThat(delivery.getItemUuid()).hasSize(36);
        assertThat(UUID.fromString(delivery.getItemUuid())).isNotNull();
    }

    @Test
    void 즉시구매_정산도_같은_공통꼬리에서_배송_1행을_PENDING으로_생성한다() {
        User seller = persistUser("dq_buy_seller", "판매자", 0L);
        User buyer = persistUser("dq_buy_buyer", "구매자닉", BALANCE);
        ItemInstance item = persistListedItem(seller, 9402);
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        purchase(buyer, auction.getPublicId());

        // D-A·D-B(양 경로 공통 꼬리): 즉시구매 정산에서도 배송 1행 PENDING.
        SaleOrder order = saleOrders(auction.getId()).get(0);
        List<ItemDelivery> deliveries = deliveriesForSaleOrder(order.getId());
        assertThat(deliveries).hasSize(1);
        ItemDelivery delivery = deliveries.get(0);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getRecipientUserId()).isEqualTo(buyer.getId());
        assertThat(delivery.getRecipientNickname()).isEqualTo("구매자닉");
        assertThat(delivery.getItemUuid()).hasSize(36);
    }

    @Test
    void 배송행은_게임번역에_필요한_자족_스냅샷을_행에_싣는다() {
        User seller = persistUser("dq_snap_seller", "판매자", 0L);
        User buyer = persistUser("dq_snap_buyer", "스냅닉", BALANCE);
        // level 1-based(5) 그대로 · skill 2슬롯 · 발동확률 · 골드포스 만료를 실은 아이템.
        SkillDefinition skill1 = skill(9411);
        SkillDefinition skill2 = skill(9412);
        Instant gfExpire = now().plusSeconds(86_400).truncatedTo(ChronoUnit.MICROS);
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template(9403)).owner(seller).level(5).skill1(skill1).skill2(skill2).skillPercent(30)
            .gfExpireAt(gfExpire).location(ItemLocation.LISTED).slotNo(null).build());
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        purchase(buyer, auction.getPublicId());

        SaleOrder order = saleOrders(auction.getId()).get(0);
        ItemDelivery delivery = deliveriesForSaleOrder(order.getId()).get(0);
        // D-C: 자족 스냅샷 = type_code·level(1-based 그대로, −1 번역 안 함)·skill1/2 코드·발동확률·gf.
        assertThat(delivery.getTypeCode()).isEqualTo(9403);
        assertThat(delivery.getLevel()).isEqualTo(5);
        assertThat(delivery.getSkill1Code()).isEqualTo(9411);
        assertThat(delivery.getSkill2Code()).isEqualTo(9412);
        assertThat(delivery.getSkillPercent()).isEqualTo(30);
        assertThat(delivery.getGfExpireAt()).isEqualTo(gfExpire);
    }

    @Test
    void 스킬_없는_아이템은_스킬코드_스냅샷이_NULL이다() {
        User seller = persistUser("dq_ns_seller", "판매자", 0L);
        User buyer = persistUser("dq_ns_buyer", "무스킬닉", BALANCE);
        ItemInstance item = persistListedItem(seller, 9404); // level 1·skill 없음·gf 없음.
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        purchase(buyer, auction.getPublicId());

        SaleOrder order = saleOrders(auction.getId()).get(0);
        ItemDelivery delivery = deliveriesForSaleOrder(order.getId()).get(0);
        assertThat(delivery.getSkill1Code()).isNull();
        assertThat(delivery.getSkill2Code()).isNull();
        assertThat(delivery.getGfExpireAt()).isNull();
        assertThat(delivery.getLevel()).isEqualTo(1);
    }

    @Test
    void 정산이_롤백되면_배송도_함께_롤백되어_고아_배송이_남지_않는다() {
        User seller = persistUser("dq_rb_seller", "판매자", 0L);
        User buyer = persistUser("dq_rb_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9405);
        long fakeSourceId = 940_500L; // 실제 경매 없이 recorder 꼬리만 독립 호출(폴리모픽 source_id, FK 없음).

        // D-B: recorder(MANDATORY)를 부른 TX 를 롤백하면 sale_order·배송이 모두 사라진다(exactly-once 결합).
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            settlementRecorder.record(SaleOrderSourceType.AUCTION, fakeSourceId, buyer.getId(), seller.getId(),
                item.getId(), 500_000L, 25_000L, 475_000L, "v1", now());
            throw new IllegalStateException("정산 실패 시뮬레이션 — 커밋 직전 강제 롤백");
        })).isInstanceOf(IllegalStateException.class);

        // 롤백 후: 그 source 의 sale_order 도, 그 수령자의 배송도 남지 않는다(고아 배송 없음).
        assertThat(auctionSaleOrders(fakeSourceId)).isEmpty();
        assertThat(deliveriesForRecipient(buyer.getId())).isEmpty();
    }

    @Test
    void 같은_sale_order에_대한_이중_배송은_1대1_UK로_DB에서_차단된다() {
        User seller = persistUser("dq_uk_seller", "판매자", 0L);
        User buyer = persistUser("dq_uk_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9406);
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));
        purchase(buyer, auction.getPublicId());
        SaleOrder order = saleOrders(auction.getId()).get(0);

        // D-A: 같은 sale_order_id 로 배송 1행을 더 심으려 하면 uk_item_delivery_sale_order 가 DB 에서 막는다.
        assertThatThrownBy(() -> transactionTemplate
            .executeWithoutResult(status -> itemDeliveryRepository.saveAndFlush(ItemDelivery.builder()
                .saleOrderId(order.getId())
                .itemInstanceId(item.getId())
                .recipientUserId(buyer.getId())
                .recipientNickname("구매자")
                .itemUuid(UUID.randomUUID().toString())
                .typeCode(9406).level(1).skillPercent(0)
                .build())))
            .isInstanceOf(DataIntegrityViolationException.class);

        // 배송은 여전히 최초 1행뿐.
        assertThat(deliveriesForSaleOrder(order.getId())).hasSize(1);
    }

    @Test
    void 같은_경매를_동시에_N회_마감해도_배송은_정확히_1행이다() throws Exception {
        User seller = persistUser("dq_cc_seller", "판매자", 0L);
        User winner = persistUser("dq_cc_winner", "낙찰자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9407);
        Auction auction = persistActiveAuction(seller, item, 100_000L, now().plusSeconds(3600));
        long price = 500_000L;
        placeBid(winner, auction.getPublicId(), price);
        expireAuction(auction.getId(), now().minusSeconds(5));

        Instant sweepNow = now();
        runConcurrently(16, index -> {
            try {
                closeService.closeOne(auction.getId(), sweepNow);
            } catch (RuntimeException ignored) {
                // 뒤늦게 락을 얻은 호출의 무부작용 return 은 정상 — 배송 이중 생성이 없음이 관심사다.
            }
        });

        // D-A: sale_order 1건 → 배송 1행. 동시 마감에도 이중 배송이 생기지 않는다.
        assertThat(saleOrders(auction.getId())).hasSize(1);
        assertThat(deliveriesForRecipient(winner.getId())).hasSize(1);
    }

    // ---------------- DB 상태 조회·픽스처(1차 캐시 우회) ----------------

    private List<ItemDelivery> deliveriesForSaleOrder(Long saleOrderId) {
        em.clear();
        return em.createQuery("SELECT d FROM ItemDelivery d WHERE d.saleOrderId = :id", ItemDelivery.class)
            .setParameter("id", saleOrderId)
            .getResultList();
    }

    private List<ItemDelivery> deliveriesForRecipient(Long recipientUserId) {
        em.clear();
        return em.createQuery("SELECT d FROM ItemDelivery d WHERE d.recipientUserId = :id", ItemDelivery.class)
            .setParameter("id", recipientUserId)
            .getResultList();
    }

    private List<SaleOrder> auctionSaleOrders(Long sourceId) {
        em.clear();
        return em.createQuery(
            "SELECT o FROM SaleOrder o WHERE o.sourceType = :type AND o.sourceId = :id", SaleOrder.class)
            .setParameter("type", SaleOrderSourceType.AUCTION)
            .setParameter("id", sourceId)
            .getResultList();
    }

    /** skill_code 로 find-or-create(마스터는 정리에서 보존되므로 재실행 UK 충돌을 피한다, template() 선례). */
    private SkillDefinition skill(int skillCode) {
        return skillDefinitionRepository.findAll().stream()
            .filter(definition -> definition.getSkillCode() == skillCode)
            .findFirst()
            .orElseGet(() -> skillDefinitionRepository.save(
                SkillDefinition.builder().skillCode(skillCode).name("테스트스킬" + skillCode).build()));
    }
}
