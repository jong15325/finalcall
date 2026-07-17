package com.finalcall.domain.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.infra.security.RefreshTokenStore;

/**
 * {@link MemberService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(가장 빠른 계층).
 *
 * <p>SecurityContext 의 인증 주체(userId)로 잔액·프로필을 조회하고, 닉네임 수정 중복(MEMBER_001)·탈퇴 차단
 * (MEMBER_002)·탈퇴 시 soft delete→세션 폐기 순서(FC-003)를 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserBalanceRepository userBalanceRepository;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    @InjectMocks
    private MemberService memberService;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 내_잔액을_조회하면_인증주체_PK로_잔액행을_반환한다() {
        authenticateAs("42");
        UserBalance balance = balanceOf(1000L, 500L, 200L);
        when(userBalanceRepository.findByUserId(42L)).thenReturn(Optional.of(balance));

        UserBalance result = memberService.getMyBalance();

        assertThat(result.getCashBalance()).isEqualTo(1000L);
        assertThat(result.getGameMoneyBalance()).isEqualTo(500L);
        assertThat(result.getGameMoneyHeld()).isEqualTo(200L);
        assertThat(result.getGameMoneyAvailable()).isEqualTo(300L); // 파생값 = 잔액 − 홀드
        verify(userBalanceRepository).findByUserId(42L);
    }

    @Test
    void 잔액행이_없으면_깨진_불변식이라_COMMON_999() {
        authenticateAs("7");
        when(userBalanceRepository.findByUserId(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> memberService.getMyBalance())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.INTERNAL_ERROR);
    }

    @Test
    void 내_프로필을_조회하면_활성주체를_반환한다() {
        authenticateAs("42");
        User user = userWithId(42L, "홍길동");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));

        User result = memberService.getMyProfile();

        assertThat(result.getNickname()).isEqualTo("홍길동");
        assertThat(result.getPublicId()).hasSize(26);
        verify(userRepository).findByIdAndIsDeletedFalse(42L); // 단건 조회도 활성 필터 동반(D-081)
    }

    @Test
    void 닉네임을_수정하면_변경되고_중복검사는_활성회원_대상이다() {
        authenticateAs("42");
        User user = userWithId(42L, "옛닉네임");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));
        when(userRepository.existsByNicknameAndIsDeletedFalse("새닉네임")).thenReturn(false);

        User result = memberService.updateNickname("새닉네임");

        assertThat(result.getNickname()).isEqualTo("새닉네임");
        verify(userRepository).existsByNicknameAndIsDeletedFalse("새닉네임");
    }

    @Test
    void 동일_닉네임_무변경_요청은_자기중복_오탐없이_통과한다() {
        authenticateAs("42");
        User user = userWithId(42L, "그대로");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));

        User result = memberService.updateNickname("그대로");

        assertThat(result.getNickname()).isEqualTo("그대로");
        // 값이 안 바뀌면 자기 자신이 활성 UK 를 점유하므로 중복 검사를 건너뛴다.
        verify(userRepository, never()).existsByNicknameAndIsDeletedFalse(any());
    }

    @Test
    void 탈퇴계정_주체가_me를_호출하면_활성행_부재로_401_COMMON_005() {
        authenticateAs("42");
        // 탈퇴(soft delete) 계정은 활성 필터 조회에서 빠져 empty — 세션 무효(401)로 처리한다(만료 전 access 극단 케이스).
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> memberService.getMyProfile())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.UNAUTHORIZED);
    }

    @Test
    void 선검사_통과후_닉네임_UK위반이_flush에서_터지면_MEMBER_001로_매핑() {
        authenticateAs("42");
        User user = userWithId(42L, "옛닉네임");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));
        when(userRepository.existsByNicknameAndIsDeletedFalse("경쟁닉")).thenReturn(false);
        // 선검사 통과 후 동시 중복이 커밋 전 flush 에서 UK(uk_user_nickname_active) 위반으로 터지는 경로.
        org.mockito.Mockito.doThrow(new DataIntegrityViolationException(
            "Duplicate entry '경쟁닉' for key 'uk_user_nickname_active'"))
            .when(userRepository).flush();

        assertThatThrownBy(() -> memberService.updateNickname("경쟁닉"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemberErrorCode.MEMBER_DUPLICATE_NICKNAME);
    }

    @Test
    void 닉네임이_중복이면_MEMBER_001이고_변경하지_않는다() {
        authenticateAs("42");
        User user = userWithId(42L, "옛닉네임");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));
        when(userRepository.existsByNicknameAndIsDeletedFalse("중복닉")).thenReturn(true);

        assertThatThrownBy(() -> memberService.updateNickname("중복닉"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemberErrorCode.MEMBER_DUPLICATE_NICKNAME);

        assertThat(user.getNickname()).isEqualTo("옛닉네임"); // 미변경
    }

    @Test
    void 탈퇴하면_soft_delete_후_모든세션을_폐기한다() {
        authenticateAs("42");
        User user = userWithId(42L, "홍길동");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));
        when(userBalanceRepository.findByUserId(42L)).thenReturn(Optional.of(balanceOf(0L, 0L, 0L)));
        // revokeAll 호출 시점에 이미 soft delete 됐는지 포착한다(FC-003 순서: delete → revokeAll).
        AtomicBoolean deletedWhenRevoked = new AtomicBoolean(false);
        org.mockito.Mockito.doAnswer(inv -> {
            deletedWhenRevoked.set(user.isDeleted());
            return null;
        }).when(refreshTokenStore).revokeAll("42");

        memberService.withdraw();

        assertThat(user.isDeleted()).isTrue();
        assertThat(deletedWhenRevoked).isTrue(); // 세션 폐기 전에 soft delete 선행
        verify(refreshTokenStore).revokeAll("42");
    }

    @Test
    void 홀드보유_상태면_MEMBER_002로_차단하고_아무것도_바꾸지_않는다() {
        authenticateAs("42");
        User user = userWithId(42L, "홍길동");
        when(userRepository.findByIdAndIsDeletedFalse(42L)).thenReturn(Optional.of(user));
        when(userBalanceRepository.findByUserId(42L)).thenReturn(Optional.of(balanceOf(0L, 1000L, 500L)));

        assertThatThrownBy(() -> memberService.withdraw())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemberErrorCode.MEMBER_WITHDRAW_BLOCKED_BY_ACTIVE_TRADE);

        assertThat(user.isDeleted()).isFalse(); // soft delete 미수행
        verify(refreshTokenStore, never()).revokeAll(any()); // 세션 폐기 미수행
    }

    /** JWT 필터가 적재하는 형태와 동일하게 principal=userId 로 SecurityContext 를 세팅한다(B-009). */
    private void authenticateAs(String userId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    private UserBalance balanceOf(long cash, long gameMoney, long held) {
        User user = User.builder().loginId("hong").passwordHash("hash").nickname("홍길동").build();
        UserBalance balance = UserBalance.builder().user(user).build();
        balance.addCash(cash);
        balance.addGameMoney(gameMoney);
        balance.hold(held);
        return balance;
    }

    /** PK(id)가 채워진 활성 User — 프로필/탈퇴 경로가 주체 PK 로 잔액을 조회하므로 id 를 리플렉션으로 세팅한다. */
    private User userWithId(long id, String nickname) {
        User user = User.builder().loginId("hong").passwordHash("hash").nickname(nickname).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
