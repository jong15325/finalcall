package com.finalcall.domain.member.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.member.entity.SocialAccount;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;

/**
 * 소셜 신원 리포지토리(member). find-or-create(FC-153)의 조회 앵커를 제공한다.
 *
 * <p>신원 키 = (provider, provider_user_id) 복합 UK({@code uk_user_social_account_provider_puid}, erd §5)라
 * {@link #findByProviderAndProviderUserId} 는 최대 1건을 반환한다. soft delete 미보유라 활성 필터가 불요하다.
 * 커스텀 쿼리가 필요해지면 {@code SocialAccountRepositoryCustom}(QueryDSL)로 분리한다(현재 불요).
 */
public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {

    /** 특정 회원에 연결된 소셜 신원이 하나라도 있는지 확인한다. */
    boolean existsByUserId(Long userId);

    /** 소셜 신원(provider + providerUserId)으로 연결 계정 조회 — 복합 UK 라 최대 1건(find-or-create 조회 앵커). */
    Optional<SocialAccount> findByProviderAndProviderUserId(SocialProvider provider, String providerUserId);

    /**
     * 소셜 신원으로 연결 회원을 직접 조회한다(find-or-create·경쟁 재수렴). {@code join} 으로 {@link User} 를 즉시
     * 로드해 반환하므로(지연 프록시 아님) OSIV off({@code open-in-view=false}) 환경에서 호출 측이 트랜잭션 밖에서
     * 안전하게 사용한다 — 로그인 응답·토큰 발급이 nickname·publicId 를 필요로 한다.
     */
    @Query("SELECT sa.user FROM SocialAccount sa "
        + "WHERE sa.provider = :provider AND sa.providerUserId = :providerUserId")
    Optional<User> findUserByProviderAndProviderUserId(
        @Param("provider") SocialProvider provider, @Param("providerUserId") String providerUserId);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default SocialAccount findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
