package com.finalcall.domain.auth;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.common.util.Preconditions;
import com.finalcall.infra.security.RefreshTokenStore;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증(auth) 서비스 — 회원가입·로그인. 클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기만 오버라이드(CLAUDE.md §5).
 *
 * <p>재발급/로그아웃은 후속 단위에서 추가한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenProvider tokenProvider;
    private final RefreshTokenStore refreshTokenStore;

    /**
     * 회원가입: loginId/nickname 중복 검사 → BCrypt 해시 → User + UserBalance(0,0,0)를 <b>단일 트랜잭션</b>으로 생성한다.
     *
     * <p>SEC-007(열거 방지): 실패 응답은 AuthErrorCode 표준 메시지만 노출한다(구체 사유 최소화). nickname 중복은 표시용이라 유지.
     *
     * @return 생성된 {@link User}(public_id 는 생성자에서 ULID 로 채워짐). 표현 변환은 api 계층이 담당.
     */
    @Transactional
    @ServiceLog
    public User signup(String loginId, String password, String nickname) {
        Preconditions.validate(!userRepository.existsByLoginId(loginId), AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);
        Preconditions.validate(!userRepository.existsByNickname(nickname), AuthErrorCode.AUTH_DUPLICATE_NICKNAME);

        User user = userRepository.save(User.builder()
                .loginId(loginId)
                .passwordHash(passwordEncoder.encode(password))
                .nickname(nickname)
                .build());
        // 잔액 행(0,0,0)을 같은 트랜잭션에서 함께 생성한다.
        userBalanceRepository.save(UserBalance.builder().user(user).build());
        return user;
    }

    /**
     * 로그인: loginId 조회 + BCrypt 검증. 성공 시 access(JWT) + refresh(opaque·Redis 저장, B-011)를 발급한다.
     *
     * <p>열거 완화(SEC-006/007): loginId 부재·비밀번호 불일치·탈퇴 계정을 <b>단일 코드 AUTH_003</b>으로 통일해
     * loginId 존재 여부가 응답으로 드러나지 않게 한다. RDB 쓰기는 없어 클래스 기본 readOnly 트랜잭션을 따른다.
     */
    @ServiceLog
    public LoginResult login(String loginId, String password) {
        User user = userRepository.findByLoginId(loginId).orElse(null);
        if (user == null || user.isDeleted() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        String userId = String.valueOf(user.getId());
        String accessToken = tokenProvider.generateAccessToken(
                new TokenClaims(userId, user.getPublicId(), user.isAdmin()));
        String refreshToken = refreshTokenStore.issue(userId);
        return new LoginResult(accessToken, refreshToken, tokenProvider.accessTokenExpiresAt());
    }

    /**
     * 토큰 재발급: refresh 를 원자적으로 회전(신규 저장·구 폐기)하고 새 access 를 발급한다(계약 §2 v1.1).
     *
     * <p>회전 실패(무효·만료·재사용 탐지 → 세션 무효화, B-011)는 모두 {@code AUTH_004}(401)로 통일한다.
     * 반환 값은 로그인과 동일 형태({@link LoginResult})다.
     */
    @ServiceLog
    public LoginResult refresh(String refreshToken) {
        RefreshTokenStore.Rotation rotation = refreshTokenStore.rotate(refreshToken)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));
        // 회전된 세션의 소유자를 로드해 access 클레임(publicId·isAdmin)을 구성한다. 탈퇴 계정은 무효 처리.
        User user = userRepository.findById(Long.parseLong(rotation.userId()))
                .filter(u -> !u.isDeleted())
                .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));
        String accessToken = tokenProvider.generateAccessToken(
                new TokenClaims(rotation.userId(), user.getPublicId(), user.isAdmin()));
        return new LoginResult(accessToken, rotation.refreshToken(), tokenProvider.accessTokenExpiresAt());
    }
}
