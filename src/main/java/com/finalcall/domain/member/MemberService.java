package com.finalcall.domain.member;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;

import lombok.RequiredArgsConstructor;

/**
 * 회원(member) 서비스 — 내 잔액 조회(계약 [4.4]). 클래스 레벨 {@code @Transactional(readOnly = true)}(CLAUDE.md [5]).
 *
 * <p>인증 주체 식별은 SecurityContext 기준이다(B-009) — JWT 필터가 적재한 userId(내부 PK)를 읽고,
 * {@code X-User-Id} 헤더는 신뢰하지 않는다(D-065). 타인 잔액 조회는 불가하며 경로에 사용자 식별자를 받지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final UserBalanceRepository userBalanceRepository;

    /**
     * 인증 사용자의 잔액을 조회한다. 잔액 행 부재는 비즈니스 상태가 아니라 깨진 불변식이므로
     * (signup 이 user 와 user_balance 를 1:1 로 함께 생성, V3 UK+FK) {@code COMMON_999}(500)로 처리한다(B-029).
     *
     * @return 표현 변환 전 {@link UserBalance} 엔티티(엔티티→응답 DTO 변환은 api 계층 담당)
     */
    @ServiceLog
    public UserBalance getMyBalance() {
        Long userId = currentUserId();
        return userBalanceRepository.findByUserId(userId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
    }

    /** 인증 주체(principal)를 userId(내부 PK)로 해석한다. JWT 필터가 subject=userId 로 적재한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
