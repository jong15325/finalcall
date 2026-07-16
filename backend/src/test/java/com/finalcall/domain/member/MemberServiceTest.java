package com.finalcall.domain.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * {@link MemberService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(가장 빠른 계층).
 *
 * <p>SecurityContext 의 인증 주체(userId)로 잔액을 조회하고, 잔액 행 부재(깨진 불변식)를 COMMON_999 로 처리하는지 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

    @Mock
    private UserBalanceRepository userBalanceRepository;

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
}
