package com.finalcall.domain.auth;

import com.finalcall.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AuthService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(가장 빠른 계층).
 *
 * <p>중복 검증(AUTH_001/002)과 성공 시 잔액 동시 생성·비밀번호 해시를 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceUnitTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserBalanceRepository userBalanceRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    @Test
    void 가입에_성공하면_유저와_잔액을_함께_생성한다() {
        when(userRepository.existsByLoginId("hong")).thenReturn(false);
        when(userRepository.existsByNickname("홍길동")).thenReturn(false);
        when(passwordEncoder.encode("pw12345")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User created = authService.signup("hong", "pw12345", "홍길동");

        assertThat(created.getLoginId()).isEqualTo("hong");
        assertThat(created.getNickname()).isEqualTo("홍길동");
        assertThat(created.getPasswordHash()).isEqualTo("hashed-pw"); // 원문 저장 금지
        assertThat(created.getPublicId()).hasSize(26);                // ULID 생성
        verify(userBalanceRepository).save(any(UserBalance.class));   // 잔액 동시 생성
    }

    @Test
    void loginId_중복이면_AUTH_001() {
        when(userRepository.existsByLoginId("dup")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("dup", "pw12345", "닉네임"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);

        verify(userRepository, never()).save(any());
        verify(userBalanceRepository, never()).save(any());
    }

    @Test
    void nickname_중복이면_AUTH_002() {
        when(userRepository.existsByLoginId("hong")).thenReturn(false);
        when(userRepository.existsByNickname("중복닉")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("hong", "pw12345", "중복닉"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_NICKNAME);

        verify(userRepository, never()).save(any());
        verify(userBalanceRepository, never()).save(any());
    }
}
