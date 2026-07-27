package com.finalcall.domain.member.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.member.entity.User;

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

    /**
     * 이메일 인증 성공 확정 — <b>검증한 이메일이 여전히 현재 이메일일 때만</b> {@code email_verified=true} 를
     * 조건부 원자 UPDATE 한다(FC-132 M-1). detached 전체 컬럼 blind merge 는 검증~커밋 사이 {@code setEmail} 경쟁 시
     * 구 이메일을 verified 로 덮어쓰는 lost update 구멍이 있어, {@code email} 을 {@code WHERE} 에 담아 DB 행 락 아래
     * 원자적으로 평가한다. {@code @Version} 없이도 조건부 CAS 로 lost update 를 차단한다.
     *
     * <p>{@code @Modifying} 쿼리는 트랜잭션이 필요하므로 {@code @Transactional}(REQUIRED)로 리포지토리 메서드 자체를
     * 짧은 쓰기 트랜잭션에 담는다 — 호출 측 서비스 verify 가 {@code NOT_SUPPORTED}(SMTP/Redis tx 밖)라도 이 UPDATE 만
     * 별도 tx 에서 적용된다.
     *
     * @param id    대상 사용자 PK
     * @param email 검증 시점의 현재 이메일(정규화) — 이 값과 저장값이 같을 때만 반영
     * @return 영향 행 수 — 1 성공, 0 = 검증~커밋 사이 이메일 변경(호출 측이 {@code EMAIL_002} 로 매핑)
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.emailVerified = true "
        + "WHERE u.id = :id AND u.email = :email AND u.isDeleted = false")
    int markEmailVerified(@Param("id") Long id, @Param("email") String email);
}
