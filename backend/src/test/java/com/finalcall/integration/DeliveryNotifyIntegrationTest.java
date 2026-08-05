package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.settlement.service.SettlementRecorder;
import com.finalcall.support.PurchaseTestBase;

/**
 * 커밋 후 best-effort 배송 알림 발행 통합 검증(delivery, FC-189 · delivery-domain-spec §3.3) — 실제 MySQL
 * (Testcontainers), 실제 커밋. Redis {@link StringRedisTemplate} 만 {@code @MockBean} 으로 대체해 발행 성공/실패/
 * 미발행 3경로를 결정적으로 주입한다(다른 Redis 빈은 이 시나리오에서 미사용).
 *
 * <p>고정하는 계약:
 * <ul>
 *   <li><b>커밋 후 발행</b> — 정산이 커밋되면(AFTER_COMMIT) {@code delivery:{recipientUserId}} 채널로 신호가 1회 발행된다.</li>
 *   <li><b>실패 무해</b> — 발행 실패(Redis 다운 주입)가 정산 커밋에 전파되지 않는다(정본=DB, 배송 PENDING 유지).</li>
 *   <li><b>유령 신호 방지</b> — 정산 TX 가 롤백되면 발행은 아예 시도되지 않는다(TX 내 발행 금지).</li>
 * </ul>
 * 다른 테스트와 충돌하지 않도록 <b>945x 대역</b>을 쓴다.
 */
class DeliveryNotifyIntegrationTest extends PurchaseTestBase {

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private SettlementRecorder settlementRecorder;

    @Test
    void 정산이_커밋되면_수령자_채널로_배송_신호가_커밋후_1회_발행된다() {
        User seller = persistUser("dn_ok_seller", "판매자", 0L);
        User buyer = persistUser("dn_ok_buyer", "구매자닉", BALANCE);
        ItemInstance item = persistListedItem(seller, 9451);
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        purchase(buyer, auction.getPublicId());

        // AFTER_COMMIT: 커밋된 뒤 수령자(buyer) 채널로 정확히 1회 발행된다(빈 폴 제거 신호).
        verify(stringRedisTemplate).convertAndSend(eq("delivery:" + buyer.getId()), any());
    }

    @Test
    void 배송_알림_발행_실패는_정산_커밋에_전파되지_않는다() {
        // Redis 다운을 주입 — 발행이 예외를 던진다.
        given(stringRedisTemplate.convertAndSend(anyString(), any()))
            .willThrow(new RedisConnectionFailureException("주입: Redis 다운(발행 실패 시뮬레이션)"));

        User seller = persistUser("dn_fail_seller", "판매자", 0L);
        User buyer = persistUser("dn_fail_buyer", "구매자닉", BALANCE);
        ItemInstance item = persistListedItem(seller, 9452);
        long buyNow = 2_480_000L;
        Auction auction = persistBuyNowAuction(seller, item, 100_000L, buyNow, now().plusSeconds(3600));

        // 발행 실패가 주입돼도 즉시구매(정산)는 예외 없이 성립한다(실패 무해, §3.3). AFTER_COMMIT 콜백 예외를 Notifier 가
        // 삼키지 않으면 이미 커밋된 TX 위로 예외가 relay 돼 여기서 터진다 — 그렇지 않음을 검증한다.
        assertThatCode(() -> purchase(buyer, auction.getPublicId())).doesNotThrowAnyException();

        // 커밋은 유지된다 — 정본=DB. 배송 우편함 1행이 PENDING 으로 존재한다(발행 실패와 무관).
        List<ItemDelivery> deliveries = deliveriesForRecipient(buyer.getId());
        assertThat(deliveries).hasSize(1);
        assertThat(deliveries.get(0).getStatus()).isEqualTo(DeliveryStatus.PENDING);

        // 발행은 커밋 후 실제로 시도됐다(실패했을 뿐 경로가 죽지 않았다).
        verify(stringRedisTemplate).convertAndSend(eq("delivery:" + buyer.getId()), any());
    }

    @Test
    void 정산이_롤백되면_유령_신호가_발행되지_않는다() {
        User seller = persistUser("dn_rb_seller", "판매자", 0L);
        User buyer = persistUser("dn_rb_buyer", "구매자", BALANCE);
        ItemInstance item = persistListedItem(seller, 9453);
        long fakeSourceId = 945_300L; // 실제 경매 없이 recorder 꼬리만 독립 호출 후 강제 롤백.

        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            settlementRecorder.record(SaleOrderSourceType.AUCTION, fakeSourceId, buyer.getId(), seller.getId(),
                item.getId(), 500_000L, 25_000L, 475_000L, "v1", now());
            throw new IllegalStateException("정산 실패 시뮬레이션 — 커밋 직전 강제 롤백");
        })).isInstanceOf(IllegalStateException.class);

        // TX 내 발행 금지: 롤백된 정산은 신호를 아예 쏘지 않는다(AFTER_COMMIT 이라 커밋이 없으면 리스너 미실행).
        verify(stringRedisTemplate, never()).convertAndSend(anyString(), any());
        assertThat(deliveriesForRecipient(buyer.getId())).isEmpty();
    }

    private List<ItemDelivery> deliveriesForRecipient(Long recipientUserId) {
        em.clear();
        return em.createQuery("SELECT d FROM ItemDelivery d WHERE d.recipientUserId = :id", ItemDelivery.class)
            .setParameter("id", recipientUserId)
            .getResultList();
    }
}
