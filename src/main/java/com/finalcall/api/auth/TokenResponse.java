package com.finalcall.api.auth;

/**
 * 토큰 발급 응답(Stage F1 데모).
 *
 * @param accessToken 액세스 토큰(Bearer)
 */
public record TokenResponse(String accessToken) {
}
