package com.finalcall.api.auth;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 데모 컨트롤러(Stage F1).
 *
 * <p>★ 필터 확인용 데모다. 실제 로그인/비밀번호 검증/회원 조회가 아니다. 실제 인증 엔드포인트는
 * {@link AuthController}(/api/v1/auth)가 담당하며, 이 데모는 후속 단위(login/logout)가 정리되면 제거된다.
 */
@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthDemoController {

    private static final String DEMO_USER_ID = "demo";

    private final TokenProvider tokenProvider;

    /** 고정 사용자("demo")로 액세스 토큰 발급(만료 30분). permitAll. 실제 로그인은 후속 단위가 대체한다. */
    @PostMapping("/token")
    public ApiResponse<TokenResponse> issueDemoToken() {
        String token = tokenProvider.generateAccessToken(new TokenClaims(DEMO_USER_ID, "demo-public-id", false));
        return ApiResponse.success(new TokenResponse(token));
    }

    /** 보호 경로 데모: 인증된 주체를 반환한다. 이 로그 라인에 userId MDC 가 담긴다. */
    @GetMapping("/me")
    public ApiResponse<String> me(Authentication authentication) {
        log.info("[Auth] 인증 사용자 조회");
        // getName() 은 principal 이 String(실토큰)이든 UserDetails(@WithMockUser)든 주체 이름을 반환한다.
        return ApiResponse.success(authentication.getName());
    }
}
