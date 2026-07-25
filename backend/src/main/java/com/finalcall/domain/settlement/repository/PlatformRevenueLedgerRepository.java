package com.finalcall.domain.settlement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.domain.settlement.entity.PlatformRevenueLedger;

/**
 * 사업자 수익 원장 리포지토리(settlement) — append-only.
 *
 * <p>수익 적립은 fresh INSERT({@code saveAndFlush})로만 쓴다. {@code sale_order_id} UK 가 수수료 이중 적립을 DB 에서
 * 차단하므로(I-C·I-H), {@code saveAndFlush} 로 그 위반을 정산 TX 안에서 즉시 표면화한다.
 */
public interface PlatformRevenueLedgerRepository extends JpaRepository<PlatformRevenueLedger, Long> {
}
