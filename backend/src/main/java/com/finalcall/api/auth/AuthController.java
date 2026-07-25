package com.finalcall.api.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.auth.AuthService;
import com.finalcall.domain.auth.TokenBundle;
import com.finalcall.domain.member.entity.User;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 인증(auth) 컨트롤러 — 계약 §2 기준 실제 엔드포인트(/api/v1/auth).
 *
 * <p>반환 타입은 항상 {@link ApiResponse}, 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 엔티티→응답 DTO 변환은 api 계층에서 수행한다(domain 은 api 를 모른다).
 * 로그인/재발급/로그아웃은 후속 단위에서 추가한다.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** 회원가입 — 성공 시 201, 토큰은 발급하지 않는다(계약 §2). */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        User created = authService.signup(request.loginId(), request.password(), request.nickname());
        return ApiResponse.success(SignupResponse.from(created));
    }

    /** 로그인 — 성공 시 200, access/refresh 발급(계약 §2). 실패는 단일 코드 AUTH_003(열거 완화). */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        TokenBundle result = authService.login(request.loginId(), request.password());
        return ApiResponse.success(LoginResponse.from(result));
    }

    /** 토큰 재발급 — 성공 시 200, access 재발급 + refresh 회전(계약 §2 v1.1). 무효·재사용·만료는 AUTH_004. */
    @PostMapping("/refresh")
    public ApiResponse<RefreshResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        TokenBundle result = authService.refresh(request.refreshToken());
        return ApiResponse.success(RefreshResponse.from(result));
    }

    /**
     * 로그아웃 — 인증 필요. 제시된 refresh 세션을 폐기하고 본문 없이 204(계약 §2·§1.5).
     * 주체는 SecurityContext(userId)에서 얻는다(B-009). 204 no-body 라 예외적으로 ApiResponse 를 감싸지 않는다.
     */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(Authentication authentication, @Valid @RequestBody LogoutRequest request) {
        authService.logout(authentication.getName(), request.refreshToken());
    }
}
