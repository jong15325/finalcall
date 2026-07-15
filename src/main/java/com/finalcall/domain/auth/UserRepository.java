package com.finalcall.domain.auth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.member.User;

/**
 * 회원 리포지토리(auth). 가입 중복 검사·로그인 조회에 쓰는 파생 쿼리를 제공한다.
 * 커스텀 쿼리가 필요해지면 {@code UserRepositoryCustom}(QueryDSL)로 분리한다(현재 불요).
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /** 로그인 아이디 중복 검사(가입, AUTH_001). */
    boolean existsByLoginId(String loginId);

    /** 닉네임 중복 검사(가입, AUTH_002). */
    boolean existsByNickname(String nickname);

    /** 로그인 아이디로 회원 조회(로그인·refresh). */
    Optional<User> findByLoginId(String loginId);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default User findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
