package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.support.ShopTestBase;

/**
 * 고정가 구매 동시성 통합 검증(shop, FC-093) — 실제 MySQL(Testcontainers), 실제 커밋. shop-spec §4.1(shop 행 배타
 * 락 + 종료성 CAS 단일 승자)·불변식 S-C(이중판매 차단)·S-F·S-H 를 경합으로 고정한다. 두 구매자 동시 구매·구매 vs
 * 취소 경합에서 <b>단일 승자</b>와 총량 보존을 검사한다. <b>942x 대역</b>을 쓴다.
 */
class ShopPurchaseConcurrencyIntegrationTest extends ShopTestBase {

    @Test
    void 두_구매자가_동시에_구매해도_정확히_한명만_사고_이중판매가_차단된다() throws InterruptedException {
        User seller = persistUser("shop_cc_s", "판매자", 0L);
        User buyer1 = persistUser("shop_cc_b1", "구매자1", BALANCE);
        User buyer2 = persistUser("shop_cc_b2", "구매자2", BALANCE);
        ItemInstance item = persistListedItem(seller, 9421);
        long price = 1_000_000L;
        Shop shop = persistActiveShop(seller, item, price, now().plusSeconds(3600));
        long totalBefore = totalGameMoneyPlusRevenue();

        User[] buyers = {buyer1, buyer2};
        AtomicInteger success = new AtomicInteger();
        runConcurrently(2, index -> {
            try {
                purchaseShop(buyers[index], shop.getPublicId());
                success.incrementAndGet();
            } catch (RuntimeException ignored) {
                // 패자는 SHOP_004(이미 판매·종료) — 정상 경합 결과.
            }
        });

        // S-C: 정확히 한 명만 성공, sale_order 1건, 리스팅 SOLD. 재고 하나가 두 번 팔리지 않는다.
        assertThat(success.get()).isEqualTo(1);
        assertThat(shopSaleOrders(shop.getId())).hasSize(1);
        assertThat(reloadShop(shop.getId()).getStatus()).isEqualTo(ShopStatus.SOLD);
        // S-H: 게임머니 총량 불변(승자 −price·판매자 +settle·원장 +fee, 합 0).
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
        // 아이템은 정확히 한 구매자에게만 이전된다.
        Shop sold = reloadShop(shop.getId());
        Long buyerId = shopSaleOrders(shop.getId()).get(0).getBuyer().getId();
        assertThat(itemInstanceRepository.findById(sold.getItemInstance().getId()).orElseThrow()
            .getOwner().getId()).isEqualTo(buyerId);
    }

    @Test
    void 구매와_취소가_동시에_일어나도_한쪽만_성립한다() throws InterruptedException {
        User seller = persistUser("shop_pc_s", "판매자", 0L);
        User buyer = persistUser("shop_pc_b", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9422);
        long price = 1_000_000L;
        Shop shop = persistActiveShop(seller, item, price, now().plusSeconds(3600));
        long totalBefore = totalGameMoneyPlusRevenue();

        runConcurrently(2, index -> {
            try {
                if (index == 0) {
                    purchaseShop(buyer, shop.getPublicId());
                } else {
                    cancelShop(seller, shop.getPublicId());
                }
            } catch (RuntimeException ignored) {
                // 후착 경로는 SHOP_004 — 정상 경합 결과.
            }
        });

        // shop 행 락 + status CAS 단일 승자: 종결 상태는 SOLD 또는 CANCELLED 중 하나다(이중 종결 없음).
        Shop terminal = reloadShop(shop.getId());
        assertThat(terminal.getStatus()).isIn(ShopStatus.SOLD, ShopStatus.CANCELLED);
        if (terminal.getStatus() == ShopStatus.SOLD) {
            // 구매 성립: sale_order 1건 · 아이템 구매자 소유.
            assertThat(shopSaleOrders(shop.getId())).hasSize(1);
            assertThat(itemInstanceRepository.findById(item.getId()).orElseThrow().getOwner().getId())
                .isEqualTo(buyer.getId());
        } else {
            // 취소 성립: sale_order 0건 · 아이템 판매자 소유 불변.
            assertThat(shopSaleOrders(shop.getId())).isEmpty();
            assertThat(itemInstanceRepository.findById(item.getId()).orElseThrow().getOwner().getId())
                .isEqualTo(seller.getId());
        }
        // S-H: 어느 쪽이 이겨도 총량 보존(취소는 금전 이동 0, 구매는 합 0).
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
    }
}
