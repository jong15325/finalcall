package com.finalcall.domain.delivery.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

/**
 * 배송 엔티티 상태 머신 단위 테스트(delivery) — delivery-domain-spec §5.1·§9.1 전이표 검증.
 *
 * <p>각 전이 메서드가 현재상태(+토큰) 가드를 지키는지(CAS WHERE 대응), 종착(APPLIED·FAILED)이 불변인지, 재청구가
 * 리스를 초기화하는지 확인한다. DB 없이 엔티티 단독으로 상태 머신 정확성을 격리 검증한다.
 */
class ItemDeliveryTest {

    private static final Instant NOW = Instant.parse("2026-08-05T00:00:00Z");

    @Test
    void enqueue는_PENDING으로_태어난다() {
        ItemDelivery delivery = delivery();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getPublicId()).hasSize(26);
        assertThat(delivery.getClaimToken()).isNull();
        assertThat(delivery.getClaimedAt()).isNull();
        assertThat(delivery.getAppliedAt()).isNull();
    }

    @Test
    void claim은_PENDING에서_CLAIMED로_리스를_획득한다() {
        ItemDelivery delivery = delivery();

        boolean claimed = delivery.claim("token-1", NOW);

        assertThat(claimed).isTrue();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.CLAIMED);
        assertThat(delivery.getClaimToken()).isEqualTo("token-1");
        assertThat(delivery.getClaimedAt()).isEqualTo(NOW);
    }

    @Test
    void 이미_CLAIMED면_재청구_경합_패자는_skip한다() {
        ItemDelivery delivery = delivery();
        delivery.claim("token-1", NOW);

        assertThat(delivery.claim("token-2", NOW)).isFalse(); // 단일 승자 — 패자 무부작용
        assertThat(delivery.getClaimToken()).isEqualTo("token-1");
    }

    @Test
    void apply는_토큰이_일치할_때만_APPLIED로_종착한다() {
        ItemDelivery delivery = delivery();
        delivery.claim("token-1", NOW);

        assertThat(delivery.apply("token-2", NOW)).isFalse(); // 만료 토큰의 뒤늦은 ack 무시
        assertThat(delivery.apply("token-1", NOW)).isTrue();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.APPLIED);
        assertThat(delivery.getAppliedAt()).isEqualTo(NOW);
    }

    @Test
    void 종착_APPLIED는_더_전이하지_않는다() {
        ItemDelivery delivery = delivery();
        delivery.claim("token-1", NOW);
        delivery.apply("token-1", NOW);

        assertThat(delivery.claim("token-2", NOW)).isFalse();
        assertThat(delivery.reclaim()).isFalse();
        assertThat(delivery.fail()).isFalse();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.APPLIED);
    }

    @Test
    void defer는_만실_보류_후_재청구를_허용한다() {
        ItemDelivery delivery = delivery();
        delivery.claim("token-1", NOW);

        assertThat(delivery.defer("token-1")).isTrue();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.DEFERRED);
        assertThat(delivery.claim("token-2", NOW)).isTrue(); // DEFERRED → CLAIMED 재청구
        assertThat(delivery.getClaimToken()).isEqualTo("token-2");
    }

    @Test
    void reclaim은_리스를_회수하고_PENDING으로_되돌린다() {
        ItemDelivery delivery = delivery();
        delivery.claim("token-1", NOW);

        assertThat(delivery.reclaim()).isTrue();
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getClaimToken()).isNull();
        assertThat(delivery.getClaimedAt()).isNull();
    }

    @Test
    void fail은_비종착에서만_격리한다() {
        ItemDelivery pending = delivery();
        assertThat(pending.fail()).isTrue();
        assertThat(pending.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(pending.fail()).isFalse(); // FAILED 도 종착
    }

    private ItemDelivery delivery() {
        return ItemDelivery.builder()
            .saleOrderId(1L)
            .itemInstanceId(2L)
            .recipientUserId(3L)
            .recipientNickname("수령자")
            .itemUuid("uuid-0001")
            .typeCode(1111)
            .level(1)
            .skillPercent(0)
            .build();
    }
}
