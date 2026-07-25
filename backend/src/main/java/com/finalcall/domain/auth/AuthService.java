package com.finalcall.domain.auth;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.security.RefreshTokenStore;

import lombok.RequiredArgsConstructor;

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
     * <p>중복 방어는 이중이다(B-024): {@code existsBy} 선검사(UX용 빠른 실패, 일반 케이스) + UK 제약 안전망
     * (경쟁·더블클릭으로 선검사를 통과한 경우). 제약 위반은 {@link DataIntegrityViolationException} 을 이 계층에서
     * 잡아 위반 UK를 구분해 AUTH_001/002 로 재던진다(전역 핸들러는 어느 UK인지 못 가려 500 이 되므로 서비스에서 처리).
     *
     * <p>SEC-007(열거 방지): 실패 응답은 AuthErrorCode 표준 메시지만 노출한다(구체 사유 최소화). nickname 중복은 표시용이라 유지.
     *
     * @return 생성된 {@link User}(public_id 는 생성자에서 ULID 로 채워짐). 표현 변환은 api 계층이 담당.
     */
    @Transactional
    @ServiceLog
    public User signup(String loginId, String password, String nickname) {
        Preconditions.validate(
            !userRepository.existsByLoginIdAndIsDeletedFalse(loginId), AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);
        Preconditions.validate(
            !userRepository.existsByNicknameAndIsDeletedFalse(nickname), AuthErrorCode.AUTH_DUPLICATE_NICKNAME);

        try {
            User user = userRepository.save(User.builder()
                .loginId(loginId)
                .passwordHash(passwordEncoder.encode(password))
                .nickname(nickname)
                .build());
            // 잔액 행(0,0,0)을 같은 트랜잭션에서 함께 생성한다.
            userBalanceRepository.save(UserBalance.builder().user(user).build());
            return user;
        } catch (DataIntegrityViolationException e) {
            // 경쟁/더블클릭으로 선검사를 지난 중복 → UK 제약 안전망. 위반 UK 를 구분해 409 로 매핑.
            throw toDuplicateException(e);
        }
    }

    /**
     * UK 제약 위반을 도메인 예외(AUTH_001/002)로 변환한다. 판정은 제약명 기반.
     * V4(D-081)에서 UK가 생성 컬럼으로 이전돼 제약명이 {@code uk_user_login_id_active}/{@code uk_user_nickname_active}다.
     */
    private BusinessException toDuplicateException(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause().getMessage();
        String lower = cause == null ? "" : cause.toLowerCase(Locale.ROOT);
        if (lower.contains("uk_user_login_id_active")) {
            return new BusinessException(AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);
        }
        if (lower.contains("uk_user_nickname_active")) {
            return new BusinessException(AuthErrorCode.AUTH_DUPLICATE_NICKNAME);
        }
        // 알 수 없는 무결성 위반(예: 극히 드문 public_id 충돌)은 원본을 유지해 전역 핸들러가 처리한다.
        throw ex;
    }

    /**
     * 로그인: loginId 조회 + BCrypt 검증. 성공 시 access(JWT) + refresh(opaque·Redis 저장, B-011)를 발급한다.
     *
     * <p>열거 완화(SEC-006/007): loginId 부재·비밀번호 불일치·탈퇴 계정을 <b>단일 코드 AUTH_003</b>으로 통일해
     * loginId 존재 여부가 응답으로 드러나지 않게 한다. RDB 쓰기는 없어 클래스 기본 readOnly 트랜잭션을 따른다.
     *
     * <p>조회는 활성 회원만 대상({@code findByLoginIdAndIsDeletedFalse}) — 재가입 허용(D-081)으로 동일 loginId에
     * 탈퇴행+활성행이 공존할 수 있어 필터 없는 조회는 다건 반환으로 깨진다. 탈퇴 계정은 조회에서 빠져 AUTH_003으로 수렴한다.
     */
    @ServiceLog
    public TokenBundle login(String loginId, String password) {
        User user = userRepository.findByLoginIdAndIsDeletedFalse(loginId).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(AuthErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        String userId = String.valueOf(user.getId());
        String accessToken = tokenProvider.generateAccessToken(
            new TokenClaims(userId, user.getPublicId(), user.isAdmin()));
        String refreshToken = refreshTokenStore.issue(userId);
        return new TokenBundle(accessToken, refreshToken, tokenProvider.accessTokenExpiresAt());
    }

    /**
     * 토큰 재발급: refresh 를 원자적으로 회전(신규 저장·구 폐기)하고 새 access 를 발급한다(계약 §2 v1.1).
     *
     * <p>회전 실패(무효·만료·재사용 탐지 → 세션 무효화, B-011)는 모두 {@code AUTH_004}(401)로 통일한다.
     * 반환 값은 로그인과 동일 형태({@link TokenBundle})다.
     */
    @ServiceLog
    public TokenBundle refresh(String refreshToken) {
        RefreshTokenStore.Rotation rotation = refreshTokenStore.rotate(refreshToken)
            .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));
        // 회전된 세션의 소유자를 로드해 access 클레임(publicId·isAdmin)을 구성한다. 탈퇴 계정은 무효 처리.
        User user = userRepository.findById(Long.parseLong(rotation.userId()))
            .filter(u -> !u.isDeleted())
            .orElseThrow(() -> new BusinessException(AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN));
        String accessToken = tokenProvider.generateAccessToken(
            new TokenClaims(rotation.userId(), user.getPublicId(), user.isAdmin()));
        return new TokenBundle(accessToken, rotation.refreshToken(), tokenProvider.accessTokenExpiresAt());
    }

    /**
     * 로그아웃: 제시된 refresh 세션을 폐기한다(RefreshTokenStore.revoke, B-011). 폐기 후 동일 refresh 는 AUTH_004 로 차단된다.
     *
     * <p>access 는 무상태 JWT 라 블랙리스트하지 않는다(짧은 만료로 자연 소멸). 소유자 검증으로 자신의 세션만 폐기한다
     * ({@code userId} = SecurityContext 주체). 없는·타인·형식위반 토큰은 무해한 no-op(멱등).
     */
    @ServiceLog
    public void logout(String userId, String refreshToken) {
        refreshTokenStore.revoke(refreshToken, userId);
    }
}
