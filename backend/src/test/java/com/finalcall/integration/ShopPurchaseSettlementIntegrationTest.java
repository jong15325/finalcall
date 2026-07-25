package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.shop.Shop;
import com.finalcall.domain.shop.ShopErrorCode;
import com.finalcall.support.ShopTestBase;

/**
 * 고정가 구매 정산 통합 검증(shop, FC-093) — 실제 MySQL(Testcontainers), 실제 커밋. shop-spec §4.1(구매 절차)·
 * §5(불변식 S-A~S-H)를 DB 상태로 고정한다. 구매자 직접 차감(홀드 미경유)·정산 꼬리 재사용(source=SHOP)·거부 경로
 * (자기구매·잔액·미존재·종료)·게임머니 총량 보존을 검사한다. 다른 테스트 템플릿과 충돌하지 않도록 <b>940x 대역</b>을 쓴다.
 */
class ShopPurchaseSettlementIntegrationTest extends ShopTestBase {

    @Test
    void 고정가를_구매하면_구매자_직접차감으로_정산되고_정산꼬리가_재사용된다() {
        User seller = persistUser("shop_s1", "판매자", 0L);
        User buyer = persistUser("shop_b1", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9401);
        long price = 2_480_000L; // fee 110,200 · settle 2,369,800.
        Shop shop = persistActiveShop(seller, item, price, now().plusSeconds(3600));

        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore = balanceOf(buyer).getGameMoneyBalance();
        long totalBefore = totalGameMoneyPlusRevenue();

        purchaseShop(buyer, shop.getPublicId());

        // S-A·S-B·S-D·S-E: 구매 상태·정산 금액·직접 차감·소유 이전이 하나의 구매를 정합하게 가리킨다(source=SHOP).
        assertShopSold(shop.getId(), buyer, seller, sellerBefore, buyerBefore, price);
        assertThat(shopSaleOrders(shop.getId()).get(0).getFeeAmount()).isEqualTo(110_200L);
        assertThat(shopSaleOrders(shop.getId()).get(0).getSettleAmount()).isEqualTo(2_369_800L);
        // S-H: 게임머니 총량(잔액 합 + 수익 원장 합) 불변.
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }

    @Test
    void 무기한_고정가도_구매할_수_있다() {
        User seller = persistUser("shop_s2", "판매자", 0L);
        User buyer = persistUser("shop_b2", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9402);
        long price = 1_000_000L;
        Shop shop = persistIndefiniteShop(seller, item, price);

        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore = balanceOf(buyer).getGameMoneyBalance();

        purchaseShop(buyer, shop.getPublicId());

        assertShopSold(shop.getId(), buyer, seller, sellerBefore, buyerBefore, price);
    }

    @Test
    void 판매자_본인은_자기_고정가를_구매할_수_없다() {
        User seller = persistUser("shop_s3", "판매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9403);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> purchaseShop(seller, shop.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_SELF_PURCHASE);
        assertThat(reloadShop(shop.getId()).getStatus().name()).isEqualTo("ACTIVE");
    }

    @Test
    void 가용_게임머니가_부족하면_구매가_거부된다() {
        User seller = persistUser("shop_s4", "판매자", 0L);
        User buyer = persistUser("shop_b4", "구매자", 500_000L);
        ItemInstance item = persistListedItem(seller, 9404);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> purchaseShop(buyer, shop.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_INSUFFICIENT_BALANCE);
        // 거부는 부작용이 없어야 한다 — 잔액 불변·리스팅 미종결.
        assertThat(balanceOf(buyer).getGameMoneyBalance()).isEqualTo(500_000L);
        assertThat(reloadShop(shop.getId()).getStatus().name()).isEqualTo("ACTIVE");
    }

    @Test
    void 존재하지_않는_고정가_구매는_404다() {
        User buyer = persistUser("shop_b5", "구매자", BALANCE);

        assertThatThrownBy(() -> purchaseShop(buyer, "00000000000000000000000000"))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_NOT_FOUND);
    }

    @Test
    void 이미_판매된_고정가는_다시_구매할_수_없다() {
        User seller = persistUser("shop_s6", "판매자", 0L);
        User buyer1 = persistUser("shop_b6a", "구매자1", BALANCE);
        User buyer2 = persistUser("shop_b6b", "구매자2", BALANCE);
        ItemInstance item = persistListedItem(seller, 9406);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));

        purchaseShop(buyer1, shop.getPublicId());

        assertThatThrownBy(() -> purchaseShop(buyer2, shop.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_ALREADY_SOLD_OR_CLOSED);
        // S-C: 이중 SOLD 없음 — sale_order 는 여전히 1건.
        assertThat(shopSaleOrders(shop.getId())).hasSize(1);
    }

    @Test
    void cap_저촉_고액과_최소수수료_저촉_소액_모두_총량이_보존된다() {
        User seller = persistUser("shop_s7", "판매자", 0L);
        User buyer = persistUser("shop_b7", "구매자", BALANCE);
        ItemInstance capItem = persistListedItem(seller, 9407);
        long capPrice = 20_000_000L; // fee raw 641,000 → cap 300,000.
        Shop capShop = persistActiveShop(seller, capItem, capPrice, now().plusSeconds(3600));
        long total1 = totalGameMoneyPlusRevenue();
        long sellerBefore = balanceOf(seller).getGameMoneyBalance();
        long buyerBefore = balanceOf(buyer).getGameMoneyBalance();

        purchaseShop(buyer, capShop.getPublicId());
        assertShopSold(capShop.getId(), buyer, seller, sellerBefore, buyerBefore, capPrice);
        assertThat(shopSaleOrders(capShop.getId()).get(0).getFeeAmount()).isEqualTo(300_000L);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(total1);
    }
}
