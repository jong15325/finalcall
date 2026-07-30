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
 * 닉네임 항상-꼬리표 부착(EPIC-NICKNAME-UX v1.17: 충돌 여부와 무관하게 항상 `_XXXX`)을 본다.
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
        // 항상-꼬리표: 후보(스템_XXXX)가 미점유면 그대로 채택.
        when(userRepository.existsByNicknameAndIsDeletedFalse(any())).thenReturn(false);

        socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-123", "카카오유저");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User created = userCaptor.getValue();
        // 충돌이 없어도 항상 무작위 꼬리표를 부여한다(EPIC-NICKNAME-UX v1.17).
        assertThat(created.getNickname()).isNotEqualTo("카카오유저");
        assertThat(created.getNickname()).startsWith("카카오유저_");
        assertThat(created.getNickname().length()).isLessThanOrEqualTo(30);
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
    void 꼬리표_후보가_충돌하면_새_꼬리표로_재시도한다() {
        // 첫 꼬리표 후보(홍길동_XXXX)가 이미 점유돼 있으면 새 꼬리표로 재시도해 유일 핸들을 확보한다.
        when(userRepository.existsByNicknameAndIsDeletedFalse(argThat(n -> n != null && n.startsWith("홍길동_"))))
            .thenReturn(true, false);

        socialAccountRegistrar.register(SocialProvider.NAVER, "naver-dup", "홍길동");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        String nickname = userCaptor.getValue().getNickname();
        assertThat(nickname).isNotEqualTo("홍길동");
        assertThat(nickname).startsWith("홍길동_");
        assertThat(nickname.length()).isLessThanOrEqualTo(30);
        // 충돌 후보 1회 + 최종 채택 후보 1회 = 최소 2회 조회.
        verify(userRepository, org.mockito.Mockito.atLeast(2)).existsByNicknameAndIsDeletedFalse(any());
    }

    @Test
    void 표시명_스템을_25자로_절단하고_꼬리표를_붙인다() {
        when(userRepository.existsByNicknameAndIsDeletedFalse(any())).thenReturn(false);
        // 30자 표시명 → 스템은 앞 25자로 절단 + '_' + 4자 꼬리표 = 총 30자.
        String longName = "가".repeat(30);

        socialAccountRegistrar.register(SocialProvider.KAKAO, "kakao-long", longName);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        String nickname = userCaptor.getValue().getNickname();
        assertThat(nickname).hasSize(30);
        assertThat(nickname).startsWith("가".repeat(25) + "_");
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
