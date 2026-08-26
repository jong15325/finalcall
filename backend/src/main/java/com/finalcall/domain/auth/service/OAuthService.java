package com.finalcall.domain.auth.service;

import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.auth.dto.TokenBundle;
import com.finalcall.domain.auth.service.OAuthMetrics.Result;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.service.SocialAccountService;
import com.finalcall.infra.security.RefreshTokenStore;

/**
 * 소셜 로그인·가입(OAuth) 오케스트레이션 서비스(auth, EPIC-OAUTH FC-154, 계약 §2 소셜 로그인).
 *
 * <p>흐름: (1) 경로 {@code provider} 문자열 → {@link SocialProvider} 해석(미지원 {@code AUTH_006}) → (2) provider
 * 전략으로 인가코드 교환·userinfo 조회({@link OAuthProviderStrategy#exchange}) → (3) {@link SocialAccountService}
 * find-or-create(로그인·가입 통합) → (4) 기존 {@link TokenProvider} + {@link RefreshTokenStore#issue(String)}로
 * JWT 발급. <b>{@code AuthService.login} 과 동일한 토큰 조립 방식</b>을 그대로 재사용한다(형상 보존 — 가입·로그인
 * 모두 200 · {@link TokenBundle}).
 *
 * <p><b>트랜잭션 경계:</b> 이 오케스트레이터는 스스로 트랜잭션을 열지 않는다 — provider HTTP 교환(느린 외부 호출)을
 * DB 커넥션이 붙든 트랜잭션 안에 넣지 않기 위해서다(커넥션 고갈 방어). find-or-create + user/balance/social-account
 * 원자 생성의 "단일 TX"(계약 §2)는 {@link SocialAccountService#findOrCreate}가 자체 {@code @Transactional}로
 * 보장한다. 여기서 readOnly TX 로 감싸면 그 쓰기가 readOnly 로 join 되어 INSERT 가 억제되므로 감싸지 않는다.
 * 토큰 발급은 Redis(RefreshTokenStore)라 DB TX 밖이다.
 */
@Service
public class OAuthService {

    /** provider → 전략 조회 맵(주입된 전략 빈들로 구성, 불변). */
    private final Map<SocialProvider, OAuthProviderStrategy> strategyByProvider;
    private final SocialAccountService socialAccountService;
    private final TokenProvider tokenProvider;
    private final RefreshTokenStore refreshTokenStore;
    private final OAuthMetrics oauthMetrics;

    public OAuthService(List<OAuthProviderStrategy> strategies,
        SocialAccountService socialAccountService,
        TokenProvider tokenProvider,
        RefreshTokenStore refreshTokenStore,
        OAuthMetrics oauthMetrics) {
        Map<SocialProvider, OAuthProviderStrategy> map = new EnumMap<>(SocialProvider.class);
        for (OAuthProviderStrategy strategy : strategies) {
            map.put(strategy.provider(), strategy);
        }
        this.strategyByProvider = map;
        this.socialAccountService = socialAccountService;
        this.tokenProvider = tokenProvider;
        this.refreshTokenStore = refreshTokenStore;
        this.oauthMetrics = oauthMetrics;
    }

    /**
     * 소셜 로그인·가입(통합). provider 인가코드를 교환해 신원을 얻고 find-or-create 후 우리 JWT 를 발급한다.
     *
     * @param providerPath 경로 변수 {@code {provider}}(대소문자 무관, 미지원 값은 {@code AUTH_006})
     * @param code         provider 1회용 인가 코드
     * @param redirectUri  프론트 인가 요청 redirect_uri(전략이 서버 화이트리스트와 대조)
     * @return 발급된 토큰 묶음({@link TokenBundle}) — 표현 변환({@code LoginResponse})은 컨트롤러가 담당
     */
    @ServiceLog
    public TokenBundle login(String providerPath, String code, String redirectUri) {
        long startedAt = oauthMetrics.start();
        OAuthProviderStrategy strategy;
        try {
            strategy = resolveStrategy(providerPath);
        } catch (BusinessException e) {
            oauthMetrics.recordUnsupportedRequest(startedAt);
            throw e;
        }
        try {
            OAuthUserProfile profile = strategy.exchange(code, redirectUri);
            User user = socialAccountService.findOrCreate(
                strategy.provider(), profile.providerUserId(), profile.nickname());
            TokenBundle tokens = issueTokens(user);
            oauthMetrics.recordRequest(strategy.provider(), Result.SUCCESS, 200, startedAt);
            return tokens;
        } catch (BusinessException e) {
            Result result = resultOf(e);
            oauthMetrics.recordRequest(strategy.provider(), result, e.getErrorCode().getStatus().value(), startedAt);
            throw e;
        } catch (RuntimeException e) {
            oauthMetrics.recordRequest(strategy.provider(), Result.PROVIDER_ERROR, 500, startedAt);
            throw e;
        }
    }

    /** 경로 provider 문자열을 지원 전략으로 해석한다. enum 미매칭·전략 부재는 모두 {@code AUTH_006}(400). */
    private OAuthProviderStrategy resolveStrategy(String providerPath) {
        SocialProvider provider;
        try {
            provider = SocialProvider.valueOf(providerPath.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(AuthErrorCode.AUTH_UNSUPPORTED_PROVIDER);
        }
        OAuthProviderStrategy strategy = strategyByProvider.get(provider);
        if (strategy == null) {
            throw new BusinessException(AuthErrorCode.AUTH_UNSUPPORTED_PROVIDER);
        }
        return strategy;
    }

    private Result resultOf(BusinessException exception) {
        if (exception.getErrorCode() == AuthErrorCode.AUTH_OAUTH_EXCHANGE_FAILED) {
            return Result.EXCHANGE_FAILED;
        }
        if (exception.getErrorCode() == AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR) {
            return Result.PROVIDER_ERROR;
        }
        return Result.CLIENT_INVALID;
    }

    /**
     * access(JWT) + refresh(회전 저장) 발급 — {@code AuthService.login} 과 동일한 조립(TokenProvider 클레임 +
     * RefreshTokenStore.issue(userId)). provider 무관하게 userId 기반이라 그대로 재사용한다(계약 §2).
     */
    private TokenBundle issueTokens(User user) {
        String userId = String.valueOf(user.getId());
        String accessToken = tokenProvider.generateAccessToken(
            new TokenClaims(userId, user.getPublicId(), user.isAdmin()));
        String refreshToken = refreshTokenStore.issue(userId);
        return new TokenBundle(accessToken, refreshToken, tokenProvider.accessTokenExpiresAt());
    }
}
