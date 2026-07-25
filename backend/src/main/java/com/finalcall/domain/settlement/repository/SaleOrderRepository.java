package com.finalcall.domain.settlement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.settlement.entity.SaleOrder;

/**
 * 판매 성립 거래 리포지토리(settlement).
 *
 * <p>정산 기록은 fresh INSERT({@code saveAndFlush})로만 쓴다 — SOLD TX 는 잔액 조건부 UPDATE 가 영속성 컨텍스트를
 * clear 한 뒤 실행되므로(bid-domain-spec §4.2) 연관을 {@code getReferenceById} 프록시로 채운다. {@code saveAndFlush}
 * 로 {@code (source_type, source_id)} UK 위반(이중 SOLD)을 이 시점에 표면화한다(I-C, ExchangeWriter 선례).
 */
public interface SaleOrderRepository extends JpaRepository<SaleOrder, Long>, SaleOrderRepositoryCustom {

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default SaleOrder findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
