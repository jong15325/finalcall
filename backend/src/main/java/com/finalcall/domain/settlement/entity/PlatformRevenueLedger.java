package com.finalcall.domain.settlement.entity;

import com.finalcall.common.entity.BaseCreatedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사업자 수익 원장 엔티티(settlement, EPIC-CLOSING, 게이트2 #4=④-C) — SOLD 정산 1건당 수수료 1행 적립(erd §4.2).
 *
 * <p>플랫폼을 user 로 두지 않고(거래 주체 오염 회피) 전용 append-only 원장에 수익을 적립한다. 이 테이블이
 * "사업자 게임머니 총수익 = {@code SUM(amount)}" 의 정본이며, 게임머니 총량 보존(closing-domain-spec §6 I-H)의
 * 회계 한 축이다: SOLD 시 낙찰자에게서 유출된 {@code final_price} 가 판매자 {@code settle_amount}(잔액)와
 * {@code fee_amount}(이 원장)로 나뉘어 총량이 보존된다.
 *
 * <p>{@code sale_order_id} UK 가 정산 1:1 을 강제해 <b>수수료 이중 적립을 DB 에서 차단</b>한다(I-C·I-H 연동).
 * {@code amount} 는 그 정산의 {@code sale_order.fee_amount} 와 같은 값이다(계산기 1회 산출값 — 두 곳에서 재계산하지
 * 않는다). 불변 원장이라 {@link BaseCreatedEntity}(created_at 만)를 상속하고 {@code public_id} 를 두지 않는다
 * (내부 회계 원장, money_hold·money_exchange 선례).
 */
@Entity
@Getter
@Table(name = "platform_revenue_ledger")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlatformRevenueLedger extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_order_id", nullable = false, unique = true, updatable = false)
    private SaleOrder saleOrder;

    @Column(name = "amount", nullable = false, updatable = false)
    private long amount;

    @Column(name = "fee_policy_version", nullable = false, length = 10, updatable = false)
    private String feePolicyVersion;

    @Builder
    private PlatformRevenueLedger(SaleOrder saleOrder, long amount, String feePolicyVersion) {
        this.saleOrder = saleOrder;
        this.amount = amount;
        this.feePolicyVersion = feePolicyVersion;
    }
}
