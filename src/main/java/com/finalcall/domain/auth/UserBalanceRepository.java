package com.finalcall.domain.auth;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자 잔액 리포지토리(auth). 가입 시 {@link User} 와 1:1 잔액 행을 함께 생성한다.
 * 잔액 조회·원자적 증감 쿼리는 화폐 도메인 후속 단위에서 확장한다.
 */
public interface UserBalanceRepository extends JpaRepository<UserBalance, Long> {
}
