package com.finalcall.infra.security;

import java.io.IOException;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.response.ErrorResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 인증 실패(401) 처리(Stage F1). Security 기본 응답 대신 3단계 {@link ErrorResponse} 포맷으로 통일한다.
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public JwtAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
        AuthenticationException authException) throws IOException {
        writeError(response);
    }

    private void writeError(HttpServletResponse response) throws IOException {
        response.setStatus(CommonErrorCode.UNAUTHORIZED.getStatus().value());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(CommonErrorCode.UNAUTHORIZED));
    }
}
