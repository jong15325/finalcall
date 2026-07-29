package com.finalcall.domain.member.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.SocialAccountRepository;

import lombok.RequiredArgsConstructor;

/**
 * 소셜 신원 find-or-create 오케스트레이션(member, EPIC-OAUTH FC-153). provider 가 확정해 준 소셜 신원
 * ({@code provider}, {@code providerUserId})과 프로필 닉네임을 받아 <b>연결 회원을 조회하거나 자동가입</b>한다.
 *
 * <p>이 서비스는 <b>FC-154(OAuthService)의 진입점</b>이다 — 인가코드 교환·userinfo 조회·엔드포인트·provider HTTP
 * 호출은 FC-154 소유이며, 여기서는 provider 결과를 받는 지점부터 DB·도메인만 다룬다.
 *
 * <p><b>트랜잭션 구성(FC-157 M-1):</b> 조회 → 신규 등록({@link SocialAccountRegistrar#register}, 쓰기 단일 tx)
 * → 경쟁 재조회를 <b>독립 트랜잭션들</b>로 오케스트레이션한다. 동시 최초 로그인 경쟁에서
 * {@code (provider, provider_user_id)} UK 위반으로 등록이 실패하면(등록 tx 만 롤백), 승자가 커밋한 신원을
 * <b>새 트랜잭션</b>에서 재조회해 멱등 수렴시킨다(진 쪽도 로그인 성공). 이 재수렴은 등록 tx 롤백 이후의
 * 신선한 스냅샷이 필요하므로 등록과 같은 트랜잭션에 묶지 않는다(MySQL REPEATABLE_READ 정합).
 */
@Service
@RequiredArgsConstructor
public class SocialAccountService {

    private final SocialAccountRepository socialAccountRepository;
    private final SocialAccountRegistrar socialAccountRegistrar;

    /**
     * 소셜 신원으로 회원을 find-or-create 한다(로그인·가입 통합, 결정 1). 기존 신원이면 연결 {@link User} 를 반환하고,
     * 신규 신원이면 자동가입한다. <b>이메일 미저장(결정 2):</b> 이메일을 인자로 받지 않아 신원 결합이 구조적으로 불가.
     *
     * @return 연결(또는 신규 생성)된 {@link User}. 표현 변환·토큰 발급은 호출 측(FC-154)이 담당한다.
     */
    @ServiceLog
    public User findOrCreate(SocialProvider provider, String providerUserId, String nickname) {
        return socialAccountRepository.findUserByProviderAndProviderUserId(provider, providerUserId)
            .orElseGet(() -> registerOrConverge(provider, providerUserId, nickname));
    }

    /**
     * 신규 등록을 시도하되, 동시 최초 로그인 경쟁에서 UK 위반으로 진 경우 승자 행을 재조회해 멱등 수렴한다.
     * 재조회는 등록 트랜잭션 롤백 후의 독립 조회라 승자의 커밋을 관측한다. UK 외 무결성 위반이면(재조회 부재)
     * 원인 예외를 유지해 상위(전역 핸들러)가 처리한다.
     */
    private User registerOrConverge(SocialProvider provider, String providerUserId, String nickname) {
        try {
            return socialAccountRegistrar.register(provider, providerUserId, nickname);
        } catch (DataIntegrityViolationException e) {
            return socialAccountRepository.findUserByProviderAndProviderUserId(provider, providerUserId)
                .orElseThrow(() -> e);
        }
    }
}
