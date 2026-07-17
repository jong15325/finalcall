package com.finalcall.domain.member;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 회원 리포지토리(member). 가입 중복 검사·로그인 조회에 쓰는 파생 쿼리를 제공한다.
 * 커스텀 쿼리가 필요해지면 {@code UserRepositoryCustom}(QueryDSL)로 분리한다(현재 불요).
 *
 * <p>재가입 허용(계약 [2.5], D-081): 동일 자연키에 탈퇴행+활성행이 공존할 수 있어, 중복 검사·로그인 조회는
 * 반드시 {@code AndIsDeletedFalse}(활성 한정)로 건다. 필터 없이 조회하면 다건이 반환돼
 * {@code Optional<User>} 바인딩이 {@code IncorrectResultSizeDataAccessException}으로 깨진다.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /** 로그인 아이디 중복 검사(가입, AUTH_001) — 활성 회원만 대상(재가입 허용). */
    boolean existsByLoginIdAndIsDeletedFalse(String loginId);

    /** 닉네임 중복 검사(가입, AUTH_002) — 활성 회원만 대상(재가입 허용). */
    boolean existsByNicknameAndIsDeletedFalse(String nickname);

    /** 로그인 아이디로 활성 회원 조회(로그인·refresh) — 탈퇴행 제외로 다건 반환을 방지한다. */
    Optional<User> findByLoginIdAndIsDeletedFalse(String loginId);

    /** PK로 활성 회원 조회(내 프로필·수정·탈퇴 주체) — 탈퇴행 제외(D-081). 탈퇴 계정은 조회에서 빠진다. */
    Optional<User> findByIdAndIsDeletedFalse(Long id);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default User findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
