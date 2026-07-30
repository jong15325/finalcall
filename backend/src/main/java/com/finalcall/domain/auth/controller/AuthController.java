package com.finalcall.domain.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.auth.dto.LoginIdAvailabilityRequest;
import com.finalcall.domain.auth.dto.LoginIdAvailabilityResponse;
import com.finalcall.domain.auth.dto.LoginRequest;
import com.finalcall.domain.auth.dto.LoginResponse;
import com.finalcall.domain.auth.dto.LogoutRequest;
import com.finalcall.domain.auth.dto.NicknameAvailabilityRequest;
import com.finalcall.domain.auth.dto.NicknameAvailabilityResponse;
import com.finalcall.domain.auth.dto.OAuthLoginRequest;
import com.finalcall.domain.auth.dto.RefreshRequest;
import com.finalcall.domain.auth.dto.RefreshResponse;
import com.finalcall.domain.auth.dto.SignupRequest;
import com.finalcall.domain.auth.dto.SignupResponse;
import com.finalcall.domain.auth.dto.TokenBundle;
import com.finalcall.domain.auth.service.AuthService;
import com.finalcall.domain.auth.service.OAuthService;
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
    private final OAuthService oauthService;

    /** 회원가입 — 성공 시 201, 토큰은 발급하지 않는다(계약 §2). */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        User created = authService.signup(
            request.loginId(), request.password(), request.nickname(), request.email());
        return ApiResponse.success(SignupResponse.from(created));
    }

    /**
     * 닉네임 가용성 조회 — 인증 불요(permitAll), 회원가입 폼의 라이브 중복확인용(계약 §2 EPIC-NICKNAME-UX v1.17).
     * 판정은 가입 유니크 검사와 동일 경로(existsByNicknameAndIsDeletedFalse)라 조회↔가입이 드리프트하지 않는다.
     * advisory 성격이라 최종 권위는 제출 시 signup AUTH_002(409)다. 형식·길이 위반은 @Valid 로 400(COMMON 검증, errors[]).
     */
    @GetMapping("/nickname/availability")
    public ApiResponse<NicknameAvailabilityResponse> nicknameAvailability(
        @Valid NicknameAvailabilityRequest request) {
        boolean available = authService.isNicknameAvailable(request.nickname());
        return ApiResponse.success(NicknameAvailabilityResponse.of(available));
    }

    /**
     * 아이디 가용성 조회 — 인증 불요(permitAll), 회원가입 폼의 라이브 중복확인용(계약 §2 EPIC-LOGINID-CHECK v1.18).
     * 판정은 가입 유니크 검사와 동일 경로(existsByLoginIdAndIsDeletedFalse)라 조회↔가입이 드리프트하지 않는다.
     * advisory 성격이라 최종 권위는 제출 시 signup AUTH_001(409)다. 형식·길이 위반은 @Valid 로 400(COMMON 검증, errors[]).
     */
    @GetMapping("/login-id/availability")
    public ApiResponse<LoginIdAvailabilityResponse> loginIdAvailability(
        @Valid LoginIdAvailabilityRequest request) {
        boolean available = authService.isLoginIdAvailable(request.loginId());
        return ApiResponse.success(LoginIdAvailabilityResponse.of(available));
    }

    /** 로그인 — 성공 시 200, access/refresh 발급(계약 §2). 실패는 단일 코드 AUTH_003(열거 완화). */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        TokenBundle result = authService.login(request.loginId(), request.password());
        return ApiResponse.success(LoginResponse.from(result));
    }

    /**
     * 소셜 로그인·가입(통합) — 성공 시 200, access/refresh 발급(계약 §2 소셜 로그인). 가입·로그인 모두 200이라
     * 신규/기존 여부가 상태코드로 드러나지 않는다(SEC-007 열거 방지). 응답은 기존 {@link LoginResponse} 형상 그대로다.
     * 미지원 provider 는 AUTH_006, 인가코드 교환 실패 AUTH_007, provider 통신 실패 AUTH_008(전역 핸들러).
     */
    @PostMapping("/oauth/{provider}")
    public ApiResponse<LoginResponse> oauthLogin(
        @PathVariable String provider, @Valid @RequestBody OAuthLoginRequest request) {
        TokenBundle result = oauthService.login(provider, request.code(), request.redirectUri());
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
