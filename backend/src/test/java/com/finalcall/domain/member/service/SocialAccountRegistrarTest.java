package com.finalcall.domain.member.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.finalcall.domain.member.entity.SocialAccount;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.SocialAccountRepository;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;

/**
 * {@link SocialAccountRegistrar} 단위 테스트 — 신규 소셜 회원 생성 세부를 검증한다.
 *
 * <p>소셜 전용 계정(loginId·passwordHash·email 미보유) · 잔액 행(0,0,0) 동반 · 소셜 신원 연결 ·
 * 닉네임 충돌 시 접미사 부착(결정 3)을 본다.
 */
@ExtendWith(MockitoExtension.class)
class SocialAccountRegistrarTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserBalanceRepository userBalanceRepository;

    @Mock
    private SocialAccountRepository socialAccountRepository;

    @InjectMocks
    private SocialAccountRegistrar socialAccountRegistrar;

    @Test
    void 소셜전용회원과_잔액과_소셜신원을_생성한다() {
        when(userRepository.existsByNicknameAndIsDeletedFalse("카카오유저")).thenReturn(false);

        socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-123", "카카오유저");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User created = userCaptor.getValue();
        assertThat(created.getNickname()).isEqualTo("카카오유저");
        // 소셜 전용 계정: loginId·passwordHash 는 NULL(비밀번호 로그인 불가), email 미저장(결정 2).
        assertThat(created.getLoginId()).isNull();
        assertThat(created.getPasswordHash()).isNull();
        assertThat(created.getEmail()).isNull();

        // 잔액 행(0,0,0) 동반.
        ArgumentCaptor<UserBalance> balanceCaptor = ArgumentCaptor.forClass(UserBalance.class);
        verify(userBalanceRepository).save(balanceCaptor.capture());
        UserBalance balance = balanceCaptor.getValue();
        assertThat(balance.getCashBalance()).isZero();
        assertThat(balance.getGameMoneyBalance()).isZero();
        assertThat(balance.getGameMoneyHeld()).isZero();

        // 소셜 신원 연결.
        ArgumentCaptor<SocialAccount> socialCaptor = ArgumentCaptor.forClass(SocialAccount.class);
        verify(socialAccountRepository).save(socialCaptor.capture());
        SocialAccount social = socialCaptor.getValue();
        assertThat(social.getProvider()).isEqualTo(SocialProvider.KAKAO);
        assertThat(social.getProviderUserId()).isEqualTo("kakao-123");
        assertThat(social.getUser()).isSameAs(created);
    }

    @Test
    void 닉네임이_기존과_충돌하면_무작위_접미사를_붙여_생성한다() {
        // 원본 닉네임은 이미 활성 회원이 점유 → 충돌. 접미사 후보는 비어 있음.
        when(userRepository.existsByNicknameAndIsDeletedFalse("홍길동")).thenReturn(true);
        when(userRepository.existsByNicknameAndIsDeletedFalse(argThat(n -> n != null && n.startsWith("홍길동_"))))
            .thenReturn(false);

        socialAccountRegistrar.register(SocialProvider.NAVER, "naver-dup", "홍길동");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        String nickname = userCaptor.getValue().getNickname();
        assertThat(nickname).isNotEqualTo("홍길동");
        assertThat(nickname).startsWith("홍길동_");
        assertThat(nickname.length()).isLessThanOrEqualTo(30);
    }

    @Test
    void 프로필_이메일_인자가_없어_이메일을_저장하지_않는다() {
        // register 시그니처에 email 인자 자체가 없어 이메일 신원 결합이 구조적으로 불가능하다(결정 2).
        when(userRepository.existsByNicknameAndIsDeletedFalse(any())).thenReturn(false);

        socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-noemail", "노메일");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getEmail()).isNull();
    }
}
