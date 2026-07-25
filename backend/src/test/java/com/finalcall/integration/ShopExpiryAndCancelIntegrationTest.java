package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.shop.Shop;
import com.finalcall.domain.shop.ShopErrorCode;
import com.finalcall.domain.shop.ShopStatus;
import com.finalcall.support.ShopTestBase;

/**
 * 고정가 만료 워커·판매자 취소 통합 검증(shop, FC-093) — 실제 MySQL(Testcontainers), 실제 커밋. shop-spec §4.3
 * (취소)·§4.4(만료 워커)·불변식 S-E·S-F·S-G 를 DB 상태로 고정한다. 만료=TEMP 직행(소유자 불변)·취소=인벤토리
 * 복귀의 비대칭, 무기한 스캔 제외, IDOR 을 검사한다. <b>941x 대역</b>을 쓴다.
 */
class ShopExpiryAndCancelIntegrationTest extends ShopTestBase {

    @Test
    void 기한이_지난_리스팅은_워커가_만료시키고_아이템을_TEMP로_직행_회수한다() {
        User seller = persistUser("shop_e1", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9411);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));
        expireShopEndAt(shop.getId(), now().minusSeconds(5)); // 만료 시각을 과거로 당긴다.

        int expired = shopExpiryWorker.sweepOnce();

        assertThat(expired).isEqualTo(1);
        // S-E·S-G: EXPIRED · 아이템 TEMP 직행 · 소유자 불변 · sale_order 0건 · temp_storage 행 존재.
        assertShopExpiredToTemp(shop.getId(), seller);
    }

    @Test
    void 무기한_리스팅은_만료_스캔에서_제외된다() {
        User seller = persistUser("shop_e2", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9412);
        Shop shop = persistIndefiniteShop(seller, item, 1_000_000L); // end_at NULL.

        int expired = shopExpiryWorker.sweepOnce();

        assertThat(expired).isZero();
        // 무기한은 여전히 ACTIVE · 아이템 LISTED 불변.
        assertThat(reloadShop(shop.getId()).getStatus()).isEqualTo(ShopStatus.ACTIVE);
        assertThat(itemInstanceRepository.findById(item.getId()).orElseThrow().getLocation())
            .isEqualTo(ItemLocation.LISTED);
    }

    @Test
    void 만료_워커는_멱등하다_두번_실행해도_한번분_효과만_남는다() {
        User seller = persistUser("shop_e3", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9413);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));
        expireShopEndAt(shop.getId(), now().minusSeconds(5));

        assertThat(shopExpiryWorker.sweepOnce()).isEqualTo(1);
        // 2회차: 이미 EXPIRED 라 후보 스캔에서 빠져 무부작용(S-F).
        assertThat(shopExpiryWorker.sweepOnce()).isZero();
        assertShopExpiredToTemp(shop.getId(), seller);
    }

    @Test
    void 판매자가_취소하면_CANCELLED_되고_아이템이_인벤토리로_복귀한다() {
        User seller = persistUser("shop_c1", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9414);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));

        ShopStatus result = cancelShop(seller, shop.getPublicId());

        assertThat(result).isEqualTo(ShopStatus.CANCELLED);
        // S-E: CANCELLED · sale_order 0건 · 소유자 불변. 취소는 인벤토리 복귀 우선(빈 슬롯 존재).
        assertShopClosedWithoutSale(shop.getId(), seller, ShopStatus.CANCELLED);
        assertThat(itemInstanceRepository.findById(item.getId()).orElseThrow().getLocation())
            .isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void 타인은_판매자의_고정가를_취소할_수_없다() {
        User seller = persistUser("shop_c2", "판매자", 0L);
        User stranger = persistUser("shop_c2x", "타인", 0L);
        ItemInstance item = persistListedItem(seller, 9415);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));

        assertThatThrownBy(() -> cancelShop(stranger, shop.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_ITEM_NOT_SELLABLE);
        assertThat(reloadShop(shop.getId()).getStatus()).isEqualTo(ShopStatus.ACTIVE);
    }

    @Test
    void 이미_만료된_고정가는_취소할_수_없다() {
        User seller = persistUser("shop_c3", "판매자", 0L);
        ItemInstance item = persistListedItem(seller, 9416);
        Shop shop = persistActiveShop(seller, item, 1_000_000L, now().plusSeconds(3600));
        expireShopEndAt(shop.getId(), now().minusSeconds(5));
        shopExpiryWorker.sweepOnce(); // EXPIRED 로 종결.

        assertThatThrownBy(() -> cancelShop(seller, shop.getPublicId()))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(ShopErrorCode.SHOP_ALREADY_SOLD_OR_CLOSED);
    }
}
