package com.finalcall.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.shop.dto.ShopPurchaseResult;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.repository.ShopRepository;
import com.finalcall.domain.shop.service.ShopExpiryService;
import com.finalcall.domain.shop.service.ShopExpiryWorker;
import com.finalcall.domain.shop.service.ShopPurchaseService;
import com.finalcall.domain.shop.service.ShopService;

/**
 * 고정가 통합 테스트 공통 기반(FC-093) — {@link ClosingTestBase} 픽스처/정리/총량 단언을 승계하고 고정가 전용
 * 픽스처·헬퍼(구매·취소·만료)·불변식 단언(S-A~S-H, shop-spec §5)을 더한다.
 *
 * <p><b>단언 대상은 API 응답이 아니라 테이블 상태다.</b> {@code @Transactional} 을 걸지 않으므로 각 구매·만료가
 * 실제 커밋돼 이중판매 차단·총량 보존을 검증할 수 있다.
 *
 * <p>정리 순서: shop 은 item_instance 를 FK 로 참조하므로 부모({@link ClosingTestBase#cleanClosingData})의 아이템
 * 삭제 <b>전에</b> shop 을 지워야 한다. JUnit 은 하위 클래스 {@code @AfterEach} 를 상위보다 먼저 실행하므로
 * {@link #cleanShopData} 가 부모 정리보다 앞서 돈다(shop → 부모의 sale_order/item 순).
 */
public abstract class ShopTestBase extends ClosingTestBase {

    @Autowired
    protected ShopService shopService;

    @Autowired
    protected ShopPurchaseService shopPurchaseService;

    @Autowired
    protected ShopExpiryService shopExpiryService;

    @Autowired
    protected ShopExpiryWorker shopExpiryWorker;

    @Autowired
    protected ShopRepository shopRepository;

    @BeforeEach
    @AfterEach
    void cleanShopData() {
        transactionTemplate.executeWithoutResult(status -> shopRepository.deleteAllInBatch());
    }

    // ---------------- 픽스처 ----------------

    /** 판매 중(ACTIVE) 유한 기한 고정가. */
    protected Shop persistActiveShop(User seller, ItemInstance item, long price, Instant endAt) {
        return shopRepository.save(Shop.builder()
            .seller(seller).itemInstance(item).price(price).status(ShopStatus.ACTIVE).endAt(endAt)
            .itemNameSnapshot("고정가템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    /** 판매 중(ACTIVE) 무기한(end_at NULL) 고정가 — 만료 스캔 제외 검증용(향후 캐시아이템 경로 시뮬레이션). */
    protected Shop persistIndefiniteShop(User seller, ItemInstance item, long price) {
        return shopRepository.save(Shop.builder()
            .seller(seller).itemInstance(item).price(price).status(ShopStatus.ACTIVE).endAt(null)
            .itemNameSnapshot("무기한템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build());
    }

    /** 고정가 구매를 독립 트랜잭션으로 커밋한다(테스트가 비-트랜잭션이라 명시적 경계가 필요하다). */
    protected ShopPurchaseResult purchaseShop(User buyer, String shopPublicId) {
        authenticateAs(buyer.getId());
        try {
            return transactionTemplate.execute(status -> shopPurchaseService.purchase(shopPublicId));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** 판매자 취소를 독립 트랜잭션으로 커밋한다. */
    protected ShopStatus cancelShop(User seller, String shopPublicId) {
        authenticateAs(seller.getId());
        try {
            return transactionTemplate.execute(status -> shopService.cancel(shopPublicId));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** shop 의 end_at 을 과거로 당긴다(만료 시각이 지난 상태를 결정적으로 만든다). */
    protected void expireShopEndAt(Long shopId, Instant endAt) {
        transactionTemplate
            .executeWithoutResult(status -> em.createQuery("UPDATE Shop s SET s.endAt = :endAt WHERE s.id = :id")
                .setParameter("endAt", endAt)
                .setParameter("id", shopId)
                .executeUpdate());
    }

    // ---------------- 불변식 단언(shop-spec §5) ----------------

    /**
     * S-A·S-B·S-D·S-E·S-H(부분) — 고정가 구매(SOLD) 성립 상태를 검사한다. shop·sale_order·user_balance·item 이
     * 하나의 구매를 정합하게 가리키는지 본다(구매자 직접 차감, 홀드 미경유).
     *
     * @param shopId       구매된 고정가 PK
     * @param buyer        구매자
     * @param seller       판매자
     * @param sellerBefore 정산 전 판매자 잔액
     * @param buyerBefore  구매 전 구매자 잔액
     * @param price        고정 판매가(= final_price)
     */
    protected void assertShopSold(Long shopId, User buyer, User seller,
        long sellerBefore, long buyerBefore, long price) {
        em.clear();
        Shop shop = shopRepository.findById(shopId).orElseThrow();
        // S-A: SOLD ∧ sale_order 1건(source=SHOP, final=price).
        assertThat(shop.getStatus()).isEqualTo(ShopStatus.SOLD);

        List<SaleOrder> orders = shopSaleOrders(shopId);
        assertThat(orders).hasSize(1);
        SaleOrder order = orders.get(0);
        // S-B: final = settle + fee, final = 고정 판매가.
        assertThat(order.getFinalPrice()).isEqualTo(price);
        assertThat(order.getSettleAmount() + order.getFeeAmount()).isEqualTo(price);
        assertThat(order.getSourceType()).isEqualTo(SaleOrderSourceType.SHOP);
        assertThat(order.getBuyer().getId()).isEqualTo(buyer.getId());
        assertThat(order.getSeller().getId()).isEqualTo(seller.getId());
        long fee = order.getFeeAmount();
        long settle = order.getSettleAmount();

        // S-D: 구매자 balance −price(홀드 미경유, held 불변 0) · 판매자 +settle. 홀드·money_hold 관여 0(입찰 부재).
        UserBalance buyerBalance = balanceOf(buyer);
        assertThat(buyerBalance.getGameMoneyBalance()).isEqualTo(buyerBefore - price);
        assertThat(buyerBalance.getGameMoneyHeld()).isZero();
        assertThat(balanceOf(seller).getGameMoneyBalance()).isEqualTo(sellerBefore + settle);

        // S-E: 아이템 소유가 구매자로 이전 · 위치 INVENTORY/TEMP · 이력 append(seller→buyer, TRADE, sale_order_id).
        ItemInstance item = itemInstanceRepository.findById(shop.getItemInstance().getId()).orElseThrow();
        assertThat(item.getOwner().getId()).isEqualTo(buyer.getId());
        assertThat(item.getLocation()).isIn(ItemLocation.INVENTORY, ItemLocation.TEMP);
        List<Object[]> history = tradeHistory(item.getId());
        assertThat(history).hasSize(1);
        assertThat((Long)history.get(0)[0]).isEqualTo(seller.getId()); // from_owner
        assertThat((Long)history.get(0)[1]).isEqualTo(buyer.getId()); // to_owner
        assertThat((Long)history.get(0)[2]).isEqualTo(order.getId()); // sale_order_id

        // S-B 재현: fee 가 수익 원장에도 동일 값 1행.
        assertThat(revenueLedgerAmount(order.getId())).isEqualTo(fee);
    }

    /**
     * S-E·S-F/S-G — 취소(CANCELLED)·만료(EXPIRED) 종결 상태를 검사한다. sale_order 0건, 아이템은 판매자 소유
     * 불변, 금전 이동·이력 없음. 위치는 취소=인벤토리 복귀(만실 TEMP)·만료=TEMP 직행이라 둘 다 INVENTORY/TEMP 허용
     * 하되, 만료는 TEMP 직행을 별도로 단언한다({@link #assertShopExpiredToTemp}).
     */
    protected void assertShopClosedWithoutSale(Long shopId, User seller, ShopStatus expectedStatus) {
        em.clear();
        Shop shop = shopRepository.findById(shopId).orElseThrow();
        assertThat(shop.getStatus()).isEqualTo(expectedStatus);
        assertThat(shopSaleOrders(shopId)).isEmpty();

        ItemInstance item = itemInstanceRepository.findById(shop.getItemInstance().getId()).orElseThrow();
        assertThat(item.getOwner().getId()).isEqualTo(seller.getId());
        assertThat(item.getLocation()).isIn(ItemLocation.INVENTORY, ItemLocation.TEMP);
        assertThat(tradeHistory(item.getId())).isEmpty();
    }

    /** 만료 고유(shop-spec §4.4) — EXPIRED + 아이템 TEMP <b>직행</b>(소유자 불변) + temp_storage 행 존재. */
    protected void assertShopExpiredToTemp(Long shopId, User seller) {
        assertShopClosedWithoutSale(shopId, seller, ShopStatus.EXPIRED);
        em.clear();
        Shop shop = shopRepository.findById(shopId).orElseThrow();
        ItemInstance item = itemInstanceRepository.findById(shop.getItemInstance().getId()).orElseThrow();
        assertThat(item.getLocation()).isEqualTo(ItemLocation.TEMP);
        assertThat(item.getOwner().getId()).isEqualTo(seller.getId());
        assertThat(tempStorageRepository.findByInstanceId(item.getId())).isPresent();
    }

    // ---------------- DB 상태 조회(1차 캐시 우회) ----------------

    protected List<SaleOrder> shopSaleOrders(Long shopId) {
        em.clear();
        return em.createQuery(
            "SELECT o FROM SaleOrder o WHERE o.sourceType = :type AND o.sourceId = :id", SaleOrder.class)
            .setParameter("type", SaleOrderSourceType.SHOP)
            .setParameter("id", shopId)
            .getResultList();
    }

    protected Shop reloadShop(Long shopId) {
        em.clear();
        return shopRepository.findById(shopId).orElseThrow();
    }
}
