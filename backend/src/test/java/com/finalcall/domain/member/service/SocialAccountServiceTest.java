package com.finalcall.domain.member.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.SocialAccountRepository;

/**
 * {@link SocialAccountService} 단위 테스트 — find-or-create 오케스트레이션(조회·등록·경쟁 재수렴)을 검증한다.
 *
 * <p>생성 세부(닉네임 접미사·이메일 미저장·잔액 동반)는 협력 빈 {@link SocialAccountRegistrar} 소관이라
 * {@link SocialAccountRegistrarTest} 가 담당한다. 여기서는 오케스트레이션 분기만 본다.
 */
@ExtendWith(MockitoExtension.class)
class SocialAccountServiceTest {

    @Mock
    private SocialAccountRepository socialAccountRepository;

    @Mock
    private SocialAccountRegistrar socialAccountRegistrar;

    @InjectMocks
    private SocialAccountService socialAccountService;

    @Test
    void 기존_소셜신원이면_연결된_회원을_반환하고_등록하지_않는다() {
        User linked = userWith(7L, "기존회원");
        when(socialAccountRepository.findUserByProviderAndProviderUserId(SocialProvider.NAVER, "naver-abc"))
            .thenReturn(Optional.of(linked));

        User result = socialAccountService.findOrCreate(SocialProvider.NAVER, "naver-abc", "무시될닉네임");

        assertThat(result).isSameAs(linked);
        verify(socialAccountRegistrar, never()).register(any(), any(), any());
    }

    @Test
    void 신규_소셜신원이면_등록에_위임하고_생성된_회원을_반환한다() {
        User created = userWith(11L, "카카오유저");
        when(socialAccountRepository.findUserByProviderAndProviderUserId(SocialProvider.KAKAO, "kakao-123"))
            .thenReturn(Optional.empty());
        when(socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-123", "카카오유저")).thenReturn(created);

        User result = socialAccountService.findOrCreate(SocialProvider.KAKAO, "kakao-123", "카카오유저");

        assertThat(result).isSameAs(created);
        verify(socialAccountRegistrar).register(SocialProvider.KAKAO, "kakao-123", "카카오유저");
    }

    @Test
    void 동시_최초로그인_경쟁에서_UK위반이면_승자행을_재조회해_멱등_수렴한다() {
        User winner = userWith(99L, "먼저가입");
        // 1차 조회는 부재 → 등록 시도 → 경쟁에서 진 쪽이 (provider, provider_user_id) UK 위반으로 DIVE.
        // 등록 tx 롤백 후 재조회(2차)는 승자가 커밋한 신원을 관측한다.
        when(socialAccountRepository.findUserByProviderAndProviderUserId(SocialProvider.NAVER, "naver-race"))
            .thenReturn(Optional.empty(), Optional.of(winner));
        when(socialAccountRegistrar.register(SocialProvider.NAVER, "naver-race", "레이서"))
            .thenThrow(new DataIntegrityViolationException("duplicate uk_user_social_account_provider_puid"));

        User result = socialAccountService.findOrCreate(SocialProvider.NAVER, "naver-race", "레이서");

        // 경쟁에서 진 쪽도 500 없이 로그인 성공(승자와 동일 회원으로 수렴).
        assertThat(result).isSameAs(winner);
        verify(socialAccountRegistrar).register(SocialProvider.NAVER, "naver-race", "레이서");
    }

    @Test
    void UK위반이_아니라_재조회도_부재면_원인_예외를_유지한다() {
        // UK 경쟁이 아닌 다른 무결성 위반(예: FK)이면 재조회로 수렴할 승자가 없다 → 원인 예외 전파(전역 핸들러 처리).
        DataIntegrityViolationException cause = new DataIntegrityViolationException("some other constraint");
        when(socialAccountRepository.findUserByProviderAndProviderUserId(SocialProvider.KAKAO, "kakao-broken"))
            .thenReturn(Optional.empty(), Optional.empty());
        when(socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-broken", "깨짐")).thenThrow(cause);

        assertThatThrownBy(() -> socialAccountService.findOrCreate(SocialProvider.KAKAO, "kakao-broken", "깨짐"))
            .isSameAs(cause);
    }

    private User userWith(long id, String nickname) {
        User user = User.builder().nickname(nickname).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
