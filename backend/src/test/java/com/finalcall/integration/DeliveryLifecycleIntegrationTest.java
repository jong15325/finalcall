package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auction.dto.AuctionRegisterRequest;
import com.finalcall.domain.auction.service.AuctionService;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.delivery.service.DeliveryLifecycleService;
import com.finalcall.domain.delivery.service.DeliveryLifecycleWorker;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.TempStorage;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.shop.dto.ShopRegisterRequest;
import com.finalcall.domain.shop.service.ShopService;
import com.finalcall.support.PurchaseTestBase;

/**
 * 배송 소유 이동·재판매 차단·실패 안전보관 통합 검증(delivery, FC-188) — 실제 MySQL(Testcontainers), 실제 커밋.
 *
 * <p>delivery-domain-spec §5.4·§6.1·§7.1·§9 불변식 D-D·D-F·D-G·D-H 를 DB 상태로 고정한다. 게임 소유 전이
 * (claim/apply/defer)는 후속 별건(게임 서버 DB-direct CAS §12.2)이라 여기서는 <b>엔티티 상태 전이로 시뮬레이션</b>하고,
 * 웹이 소유하는 reconciler(APPLIED→IN_GAME)·sweeper(리스 만료 재청구)·하드 실패 격리·재판매 가드를 검증한다.
 * 단언 대상은 API 응답이 아니라 테이블 상태다. 다른 테스트와 충돌하지 않도록 <b>95xx 대역</b>을 쓴다.
 */
class DeliveryLifecycleIntegrationTest extends PurchaseTestBase {

    @Autowired
    private DeliveryLifecycleService deliveryLifecycleService;

    @Autowired
    private DeliveryLifecycleWorker deliveryLifecycleWorker;

    @Autowired
    private AuctionService auctionService;

    @Autowired
    private ShopService shopService;

    @Test
    void reconciler는_APPLIED_배송의_아이템을_INVENTORY에서_IN_GAME으로_이동한다() {
        User seller = persistUser("dl_ig_seller", "판매자", 0L);
        User buyer = persistUser("dl_ig_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9501);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        // 구매 직후: 아이템은 구매자 소유·INVENTORY(P-E), 배송 PENDING.
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
        simulateGameApplied(deliveryOf(item));

        int processed = deliveryLifecycleWorker.reconcileOnce();

        // D-F: APPLIED 관측 후 아이템이 IN_GAME 으로 이동(slot_no NULL). 배송 행은 APPLIED 유지(소멸 아님).
        assertThat(processed).isGreaterThanOrEqualTo(1);
        ItemInstance moved = reloadItem(item.getId());
        assertThat(moved.getLocation()).isEqualTo(ItemLocation.IN_GAME);
        assertThat(moved.getSlotNo()).isNull();
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.APPLIED);
    }

    @Test
    void reconciler는_TEMP_아이템을_IN_GAME으로_이동하며_temp_storage_행을_제거한다() {
        User seller = persistUser("dl_temp_seller", "판매자", 0L);
        User buyer = persistUser("dl_temp_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9502);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        forceToTemp(item, buyer); // 구매자 커스터디를 TEMP 로 옮겨 temp_storage 1:1 행을 만든다.
        assertThat(tempStorageRepository.findByInstanceId(item.getId())).isPresent();
        simulateGameApplied(deliveryOf(item));

        deliveryLifecycleService.reconcileOne(deliveryOf(item).getId());

        // D-F XOR: IN_GAME ⇒ slot_no NULL·temp_storage 행 없음.
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.IN_GAME);
        assertThat(tempStorageRepository.findByInstanceId(item.getId())).isEmpty();
    }

    @Test
    void reconciler는_멱등이다_두번_돌려도_IN_GAME_유지() {
        User seller = persistUser("dl_idem_seller", "판매자", 0L);
        User buyer = persistUser("dl_idem_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9503);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        simulateGameApplied(deliveryOf(item));
        Long deliveryId = deliveryOf(item).getId();

        deliveryLifecycleService.reconcileOne(deliveryId);
        deliveryLifecycleService.reconcileOne(deliveryId); // 두 번째는 이미 IN_GAME 이라 무부작용 skip.

        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.IN_GAME);
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.APPLIED);
    }

    @Test
    void 미완료_배송이_있는_아이템은_경매_출품이_차단된다() {
        User seller = persistUser("dl_rs_a_seller", "판매자", 0L);
        User buyer = persistUser("dl_rs_a_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9504);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        // 배송 PENDING(미완료) — 아이템은 구매자 소유·INVENTORY 지만 게임으로 배송 중이라 재출품 불가.
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.PENDING);

        assertThatThrownBy(() -> registerAuction(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
        // 가드가 CAS 이전에 막았으므로 아이템은 INVENTORY 그대로(LISTED 로 전이되지 않음).
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void 미완료_배송이_있는_아이템은_고정가_출품이_차단된다() {
        User seller = persistUser("dl_rs_s_seller", "판매자", 0L);
        User buyer = persistUser("dl_rs_s_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9505);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        // 게임 청구 진행(CLAIMED)도 미완료라 차단 대상이다.
        simulateGameClaimed(deliveryOf(item));

        assertThatThrownBy(() -> registerShop(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void IN_GAME으로_이관된_아이템은_다시_출품할_수_없다() {
        User seller = persistUser("dl_ig_block_seller", "판매자", 0L);
        User buyer = persistUser("dl_ig_block_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9506);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        simulateGameApplied(deliveryOf(item));
        deliveryLifecycleService.reconcileOne(deliveryOf(item).getId());
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.IN_GAME);

        // 배송은 APPLIED(미완료 아님)라 가드는 통과하나, 출품 CAS(WHERE location='INVENTORY')가 IN_GAME 을 자동 배제한다.
        assertThatThrownBy(() -> registerAuction(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.IN_GAME);
    }

    @Test
    void APPLIED_lag창_reconciler_전에도_경매_재출품이_차단된다() {
        // D-F lag 창: 게임 apply(APPLIED) 직후~웹 reconciler IN_GAME 전이 전. item_instance 는 아직 INVENTORY 다.
        User seller = persistUser("dl_lag_a_seller", "판매자", 0L);
        User buyer = persistUser("dl_lag_a_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9511);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        simulateGameApplied(deliveryOf(item)); // 배송 APPLIED, 그러나 reconciler 미실행.
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.APPLIED);
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY); // 아직 INVENTORY(lag)

        // 가드가 APPLIED 배송을 보고 차단해야 한다(가드가 뚫리면 CAS 성공→이중 존재). LISTING_BLOCKING_STATUSES 에 APPLIED 포함.
        assertThatThrownBy(() -> registerAuction(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
        // 아이템은 INVENTORY 그대로(LISTED 로 새지 않음 = 이중 존재 미발생).
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void APPLIED_lag창_reconciler_전에도_고정가_재출품이_차단된다() {
        User seller = persistUser("dl_lag_s_seller", "판매자", 0L);
        User buyer = persistUser("dl_lag_s_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9512);
        purchase(buyer, persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        simulateGameApplied(deliveryOf(item));
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);

        assertThatThrownBy(() -> registerShop(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void sweeper는_리스_만료된_CLAIMED만_PENDING으로_재청구한다() {
        User seller = persistUser("dl_sw_seller", "판매자", 0L);
        User buyer = persistUser("dl_sw_buyer", "구매자", BALANCE);
        ItemInstance stale = persistListedItem(seller, 9507);
        ItemInstance fresh = persistListedItem(seller, 9508);
        purchase(buyer, persistBuyNowAuction(seller, stale, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        purchase(buyer, persistBuyNowAuction(seller, fresh, 100_000L, 2_480_000L, now().plusSeconds(3600))
            .getPublicId());
        Instant claimBase = now().minusSeconds(600);
        simulateGameClaimed(deliveryOf(stale));
        backdateClaimedAt(deliveryOf(stale).getId(), claimBase); // 리스 만료(오래된 청구)
        simulateGameClaimed(deliveryOf(fresh));
        backdateClaimedAt(deliveryOf(fresh).getId(), now()); // 최신 청구(만료 전)

        // 경계 = claimBase + 1s: stale(claimBase)만 이전이라 회수, fresh(now)는 미회수.
        int reclaimed = deliveryLifecycleService.reclaimExpiredLeases(claimBase.plusSeconds(1));

        // D-D·D-H: 만료 리스만 PENDING 으로 단조 회수, 최신 리스는 CLAIMED 유지.
        assertThat(reclaimed).isEqualTo(1);
        ItemDelivery reclaimedDelivery = deliveryOf(stale);
        assertThat(reclaimedDelivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(reclaimedDelivery.getClaimToken()).isNull();
        assertThat(reclaimedDelivery.getClaimedAt()).isNull();
        assertThat(deliveryOf(fresh).getStatus()).isEqualTo(DeliveryStatus.CLAIMED);
    }

    @Test
    void 하드_실패_격리는_금전을_역전하지_않는다() {
        User seller = persistUser("dl_fail_seller", "판매자", 0L);
        User buyer = persistUser("dl_fail_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9509);
        Long auctionId = persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600)).getId();
        long price = 2_480_000L;
        purchase(buyer, auctionRepository.findById(auctionId).orElseThrow().getPublicId());
        long totalBefore = totalGameMoneyPlusRevenue();
        SaleOrder order = saleOrders(auctionId).get(0);

        boolean failed = deliveryLifecycleService.markFailed(deliveryOf(item).getId());

        // D-G: 배송 FAILED 격리에도 판매(sale_order·정산·수익 원장·잔액)는 불변, 총량 보존.
        assertThat(failed).isTrue();
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
        assertBuyNowSold(auctionId, buyer, seller, 0L, BALANCE, price);
        assertThat(order.getSettleAmount() + order.getFeeAmount()).isEqualTo(price);
        // 아이템은 유실이 아니라 구매자 커스터디에 안전 보관(IN_GAME 아님).
        assertThat(reloadItem(item.getId()).getLocation()).isEqualTo(ItemLocation.INVENTORY);
    }

    @Test
    void 만실_보류_DEFERRED도_금전을_역전하지_않고_재출품이_차단된다() {
        User seller = persistUser("dl_def_seller", "판매자", 0L);
        User buyer = persistUser("dl_def_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9510);
        Long auctionId = persistBuyNowAuction(seller, item, 100_000L, 2_480_000L, now().plusSeconds(3600)).getId();
        purchase(buyer, auctionRepository.findById(auctionId).orElseThrow().getPublicId());
        long totalBefore = totalGameMoneyPlusRevenue();

        simulateGameDeferred(deliveryOf(item)); // 게임 만실 → DEFERRED 안전 보관.

        // D-G: DEFERRED 는 금전 미역전, 판매 불변.
        assertThat(deliveryOf(item).getStatus()).isEqualTo(DeliveryStatus.DEFERRED);
        assertThat(totalGameMoneyPlusRevenue()).isEqualTo(totalBefore);
        // DEFERRED 도 미완료라 재출품 차단.
        assertThatThrownBy(() -> registerAuction(buyer, reloadItem(item.getId()).getPublicId()))
            .isInstanceOf(BusinessException.class);
    }

    // ---------------- 게임 전이 시뮬레이션(후속 별건 §12.2 의 DB-direct CAS 를 엔티티 전이로 대체) ----------------

    private void simulateGameClaimed(ItemDelivery delivery) {
        transactionTemplate.executeWithoutResult(status -> {
            ItemDelivery managed = itemDeliveryRepository.findById(delivery.getId()).orElseThrow();
            managed.claim("tok-" + managed.getId(), Instant.now());
        });
    }

    private void simulateGameApplied(ItemDelivery delivery) {
        transactionTemplate.executeWithoutResult(status -> {
            ItemDelivery managed = itemDeliveryRepository.findById(delivery.getId()).orElseThrow();
            String token = "tok-" + managed.getId();
            managed.claim(token, Instant.now());
            managed.apply(token, Instant.now());
        });
    }

    private void simulateGameDeferred(ItemDelivery delivery) {
        transactionTemplate.executeWithoutResult(status -> {
            ItemDelivery managed = itemDeliveryRepository.findById(delivery.getId()).orElseThrow();
            String token = "tok-" + managed.getId();
            managed.claim(token, Instant.now());
            managed.defer(token);
        });
    }

    /** 리스 만료를 결정적으로 만들기 위해 claimed_at 을 과거로 당긴다(벽시계 lease 의존 제거). */
    private void backdateClaimedAt(Long deliveryId, Instant claimedAt) {
        transactionTemplate.executeWithoutResult(
            status -> em.createQuery("UPDATE ItemDelivery d SET d.claimedAt = :t WHERE d.id = :id")
                .setParameter("t", claimedAt)
                .setParameter("id", deliveryId)
                .executeUpdate());
    }

    /** 구매자 커스터디를 INVENTORY→TEMP 로 옮기고 temp_storage 1:1 행을 만든다(만실 오버플로우 상황 대체). */
    private void forceToTemp(ItemInstance item, User owner) {
        transactionTemplate.executeWithoutResult(status -> {
            em.createQuery("UPDATE ItemInstance i "
                + "SET i.location = com.finalcall.domain.item.entity.ItemLocation.TEMP, i.slotNo = null "
                + "WHERE i.id = :id")
                .setParameter("id", item.getId())
                .executeUpdate();
            tempStorageRepository.save(TempStorage.builder()
                .instance(itemInstanceRepository.getReferenceById(item.getId()))
                .ownerId(owner.getId())
                .storedAt(Instant.now())
                .build());
        });
    }

    // ---------------- 출품 실행(주체 인증 + 독립 TX) ----------------

    private void registerAuction(User seller, String itemPublicId) {
        authenticateAs(seller.getId());
        try {
            transactionTemplate.executeWithoutResult(status -> auctionService.register(new AuctionRegisterRequest(
                itemPublicId, 100_000L, null, null, now().plusSeconds(3600), null, null, now().plusSeconds(7200))));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void registerShop(User seller, String itemPublicId) {
        authenticateAs(seller.getId());
        try {
            transactionTemplate.executeWithoutResult(
                status -> shopService.register(new ShopRegisterRequest(itemPublicId, 100_000L)));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ---------------- DB 상태 조회(1차 캐시 우회) ----------------

    /** item_instance 를 1차 캐시 우회로 다시 읽는다({@code ClosingTestBase#reload} 는 Auction 반환이라 별도 정의). */
    private ItemInstance reloadItem(Long instanceId) {
        em.clear();
        return itemInstanceRepository.findById(instanceId).orElseThrow();
    }

    /** 해당 item_instance 의 배송 행(미완료 최대 1건 규약, §6.1). */
    private ItemDelivery deliveryOf(ItemInstance item) {
        em.clear();
        return em.createQuery("SELECT d FROM ItemDelivery d WHERE d.itemInstanceId = :id", ItemDelivery.class)
            .setParameter("id", item.getId())
            .getResultList()
            .get(0);
    }
}
