package com.finalcall.domain.currency.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.domain.currency.entity.MoneyExchange;

/**
 * 교환 원장 리포지토리(currency).
 *
 * <p>멱등성 조회({@link #findByUserIdAndIdempotencyKey})는 두 곳에서 쓰인다: 처리 전 replay 선검사(대다수 재요청을
 * 빠르게 최초 결과로 응답)와, 동시 중복 제출 경쟁에서 UK 를 뺏긴 트랜잭션이 롤백된 뒤 승자 행을 재조회하는 경로다.
 * {@code (user_id, idempotency_key)} UK(V5) 로 최대 1건이다.
 */
public interface MoneyExchangeRepository extends JpaRepository<MoneyExchange, Long> {

    /** (사용자, 멱등키)로 교환 원장을 조회한다. 복합 UK 라 최대 1건 — replay 선검사·경쟁 승자 재조회에 쓴다. */
    Optional<MoneyExchange> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);
}
