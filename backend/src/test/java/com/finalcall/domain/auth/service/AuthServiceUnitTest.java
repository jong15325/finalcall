package com.finalcall.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.EmailErrorCode;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.auth.config.DemoLoginProperties;
import com.finalcall.domain.auth.dto.TokenBundle;
import com.finalcall.domain.member.entity.AccountType;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.SocialAccountRepository;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.security.RefreshTokenStore;

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

    @Mock
    private TokenProvider tokenProvider;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    @Mock
    private DemoLoginProperties demoLoginProperties;

    @Mock
    private SocialAccountRepository socialAccountRepository;

    @InjectMocks
    private AuthService authService;

    @Test
    void demo_login은_유일한_계정에_기존_token_pair를_발급한다() {
        User user = org.mockito.Mockito.mock(User.class);
        when(demoLoginProperties.enabled()).thenReturn(true);
        when(userRepository.findTop2ByAccountTypeAndIsDeletedFalseOrderById(AccountType.DEMO))
            .thenReturn(List.of(user));
        when(user.getId()).thenReturn(42L);
        when(user.getPublicId()).thenReturn("01DEMOACCESS00000000000001");
        when(tokenProvider.generateAccessToken(any(TokenClaims.class))).thenReturn("access");
        when(refreshTokenStore.issue("42")).thenReturn("refresh");
        when(tokenProvider.accessTokenExpiresAt()).thenReturn(Instant.now().plusSeconds(60));

        TokenBundle result = authService.demoLogin();

        assertThat(result.accessToken()).isEqualTo("access");
        assertThat(result.refreshToken()).isEqualTo("refresh");
    }

    @Test
    void demo_login은_비활성이나_계정수가_유일하지_않으면_AUTH_009다() {
        when(demoLoginProperties.enabled()).thenReturn(false);
        assertThatThrownBy(() -> authService.demoLogin()).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.AUTH_DEMO_UNAVAILABLE));

        when(demoLoginProperties.enabled()).thenReturn(true);
        when(userRepository.findTop2ByAccountTypeAndIsDeletedFalseOrderById(AccountType.DEMO))
            .thenReturn(List.of());
        assertThatThrownBy(() -> authService.demoLogin()).isInstanceOf(BusinessException.class);
    }

    @ParameterizedTest
    @CsvSource({"true,false,false,false", "false,true,false,false", "false,false,true,false",
        "false,false,false,true"})
    void demo_login은_관리자_자격증명_소셜신원_경계를_AUTH_009로_거부한다(
        boolean admin, boolean loginId, boolean password, boolean socialIdentity) {
        User user = org.mockito.Mockito.mock(User.class);
        when(demoLoginProperties.enabled()).thenReturn(true);
        when(userRepository.findTop2ByAccountTypeAndIsDeletedFalseOrderById(AccountType.DEMO))
            .thenReturn(List.of(user));
        when(user.isAdmin()).thenReturn(admin);
        if (!admin) {
            when(user.getLoginId()).thenReturn(loginId ? "login" : null);
        }
        if (!admin && !loginId) {
            when(user.getPasswordHash()).thenReturn(password ? "hash" : null);
        }
        if (!admin && !loginId && !password) {
            when(user.getId()).thenReturn(42L);
            when(socialAccountRepository.existsByUserId(42L)).thenReturn(socialIdentity);
        }

        assertThatThrownBy(() -> authService.demoLogin()).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.AUTH_DEMO_UNAVAILABLE));
    }

    @Test
    void 가입에_성공하면_유저와_잔액을_함께_생성한다() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("hong")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("홍길동")).thenReturn(false);
        when(passwordEncoder.encode("pw12345")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User created = authService.signup("hong", "pw12345", "홍길동", null);

        assertThat(created.getLoginId()).isEqualTo("hong");
        assertThat(created.getNickname()).isEqualTo("홍길동");
        assertThat(created.getPasswordHash()).isEqualTo("hashed-pw"); // 원문 저장 금지
        assertThat(created.getPublicId()).hasSize(26);                // ULID 생성
        assertThat(created.getEmail()).isNull();                      // email 미제공 → 이메일 없는 계정
        assertThat(created.isEmailVerified()).isFalse();
        verify(userBalanceRepository).save(any(UserBalance.class));   // 잔액 동시 생성
    }

    @Test
    void email_제공시_정규화해_세팅하고_미인증으로_저장한다() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("hong")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("홍길동")).thenReturn(false);
        when(passwordEncoder.encode("pw12345")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // 앞뒤 공백·대문자 → lowercase+trim 정규화(제공자별 정규화 없음, spec §2.2).
        User created = authService.signup("hong", "pw12345", "홍길동", "  Foo@Bar.COM ");

        assertThat(created.getEmail()).isEqualTo("foo@bar.com");
        assertThat(created.isEmailVerified()).isFalse(); // 가입 직후는 항상 미인증
        verify(userBalanceRepository).save(any(UserBalance.class));
    }

    @Test
    void email_공백만이면_이메일_없는_계정으로_생성한다() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("hong")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("홍길동")).thenReturn(false);
        when(passwordEncoder.encode("pw12345")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User created = authService.signup("hong", "pw12345", "홍길동", "   ");

        assertThat(created.getEmail()).isNull(); // 빈/공백은 미설정으로 취급(assignEmail 미호출)
        assertThat(created.isEmailVerified()).isFalse();
    }

    @Test
    void 선검사_통과후_email_UK위반이면_EMAIL_007로_매핑() {
        // 이메일은 열거 위험이라 existsBy 선검사가 없다(SEC-007) → UK 위반 시점에만 EMAIL_007 노출.
        when(userRepository.existsByLoginIdAndIsDeletedFalse("newid")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("닉네임")).thenReturn(false);
        when(passwordEncoder.encode("pw12345678")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class)))
                .thenThrow(new DataIntegrityViolationException(
                    "Duplicate entry 'foo@bar.com' for key 'uk_user_email_active'"));

        assertThatThrownBy(() -> authService.signup("newid", "pw12345678", "닉네임", "foo@bar.com"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(EmailErrorCode.EMAIL_DUPLICATE);
    }

    @Test
    void loginId_중복이면_AUTH_001() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("dup")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("dup", "pw12345", "닉네임", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);

        verify(userRepository, never()).save(any());
        verify(userBalanceRepository, never()).save(any());
    }

    @Test
    void nickname_중복이면_AUTH_002() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("hong")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("중복닉")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup("hong", "pw12345", "중복닉", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_NICKNAME);

        verify(userRepository, never()).save(any());
        verify(userBalanceRepository, never()).save(any());
    }

    @Test
    void 선검사_통과후_loginId_UK위반이면_AUTH_001로_매핑_M1() {
        // 경쟁으로 선검사를 지난 뒤 save 에서 UK 제약 위반 → 500 아닌 409 AUTH_001.
        when(userRepository.existsByLoginIdAndIsDeletedFalse("racer")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("닉네임")).thenReturn(false);
        when(passwordEncoder.encode("pw12345678")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class)))
                .thenThrow(new DataIntegrityViolationException(
                    "Duplicate entry 'racer' for key 'uk_user_login_id_active'"));

        assertThatThrownBy(() -> authService.signup("racer", "pw12345678", "닉네임", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);
    }

    @Test
    void 선검사_통과후_nickname_UK위반이면_AUTH_002로_매핑_M1() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("newid")).thenReturn(false);
        when(userRepository.existsByNicknameAndIsDeletedFalse("중복닉")).thenReturn(false);
        when(passwordEncoder.encode("pw12345678")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class)))
                .thenThrow(new DataIntegrityViolationException(
                    "Duplicate entry '중복닉' for key 'uk_user_nickname_active'"));

        assertThatThrownBy(() -> authService.signup("newid", "pw12345678", "중복닉", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_DUPLICATE_NICKNAME);
    }

    @Test
    void 미존재_닉네임은_가용하다() {
        when(userRepository.existsByNicknameAndIsDeletedFalse("없는닉")).thenReturn(false);

        assertThat(authService.isNicknameAvailable("없는닉")).isTrue();
    }

    @Test
    void 존재하는_닉네임은_가용하지_않다() {
        // 가입 유니크 검사와 동일 경로(existsByNicknameAndIsDeletedFalse)로 판정 — 조회↔가입 드리프트 방지.
        when(userRepository.existsByNicknameAndIsDeletedFalse("있는닉")).thenReturn(true);

        assertThat(authService.isNicknameAvailable("있는닉")).isFalse();
    }

    @Test
    void 미존재_아이디는_가용하다() {
        when(userRepository.existsByLoginIdAndIsDeletedFalse("없는아이디")).thenReturn(false);

        assertThat(authService.isLoginIdAvailable("없는아이디")).isTrue();
    }

    @Test
    void 존재하는_아이디는_가용하지_않다() {
        // 가입 유니크 검사와 동일 경로(existsByLoginIdAndIsDeletedFalse)로 판정 — 조회↔가입 드리프트 방지.
        when(userRepository.existsByLoginIdAndIsDeletedFalse("있는아이디")).thenReturn(true);

        assertThat(authService.isLoginIdAvailable("있는아이디")).isFalse();
    }

    @Test
    void 로그인에_성공하면_access_refresh_를_발급한다() {
        User user = User.builder().loginId("hong").passwordHash("hashed-pw").nickname("홍길동").build();
        ReflectionTestUtils.setField(user, "id", 42L);
        Instant expiresAt = Instant.parse("2026-07-14T00:30:00Z");
        when(userRepository.findByLoginIdAndIsDeletedFalse("hong")).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches("pw12345678", "hashed-pw")).thenReturn(true);
        when(tokenProvider.generateAccessToken(any(TokenClaims.class))).thenReturn("access-token");
        when(tokenProvider.accessTokenExpiresAt()).thenReturn(expiresAt);
        when(refreshTokenStore.issue("42")).thenReturn("42.sid.secret");

        TokenBundle result = authService.login("hong", "pw12345678");

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("42.sid.secret");
        assertThat(result.accessExpiresAt()).isEqualTo(expiresAt);
        verify(refreshTokenStore).issue("42"); // refresh 저장(발급) 확인
    }

    @Test
    void 없는_loginId_는_AUTH_003() {
        when(userRepository.findByLoginIdAndIsDeletedFalse("nobody")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> authService.login("nobody", "pw12345678"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_INVALID_CREDENTIALS);

        verify(refreshTokenStore, never()).issue(any());
    }

    @Test
    void 비밀번호_불일치는_AUTH_003() {
        User user = User.builder().loginId("hong").passwordHash("hashed-pw").nickname("홍길동").build();
        when(userRepository.findByLoginIdAndIsDeletedFalse("hong")).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed-pw")).thenReturn(false);

        assertThatThrownBy(() -> authService.login("hong", "wrong"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_INVALID_CREDENTIALS);

        verify(refreshTokenStore, never()).issue(any());
    }

    @Test
    void 재발급에_성공하면_access재발급_refresh회전분을_반환한다() {
        User user = User.builder().loginId("hong").passwordHash("hashed-pw").nickname("홍길동").build();
        ReflectionTestUtils.setField(user, "id", 42L);
        Instant expiresAt = Instant.parse("2026-07-14T01:00:00Z");
        when(refreshTokenStore.rotate("42.sid.old"))
            .thenReturn(java.util.Optional.of(new RefreshTokenStore.Rotation("42.sid.new", "42")));
        when(userRepository.findById(42L)).thenReturn(java.util.Optional.of(user));
        when(tokenProvider.generateAccessToken(any(TokenClaims.class))).thenReturn("new-access");
        when(tokenProvider.accessTokenExpiresAt()).thenReturn(expiresAt);

        TokenBundle result = authService.refresh("42.sid.old");

        assertThat(result.accessToken()).isEqualTo("new-access");
        assertThat(result.refreshToken()).isEqualTo("42.sid.new"); // 회전된 신규
        assertThat(result.accessExpiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void 회전_실패는_AUTH_004() {
        // 무효·만료·재사용 탐지 → rotate empty → 단일 코드 AUTH_004.
        when(refreshTokenStore.rotate("bad")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> authService.refresh("bad"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN);

        verify(tokenProvider, never()).generateAccessToken(any());
    }

    @Test
    void 로그아웃은_소유자_기준으로_refresh를_폐기한다() {
        authService.logout("42", "42.sid.secret");

        // 폐기는 SecurityContext 주체(userId) 소유 세션에 한정된다(타 사용자 세션 조작 방지).
        verify(refreshTokenStore).revoke("42.sid.secret", "42");
    }
}
