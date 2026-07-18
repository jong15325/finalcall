package com.finalcall.infra.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.infra.security.GatewayAccessFilter;
import com.finalcall.infra.security.JwtAccessDeniedHandler;
import com.finalcall.infra.security.JwtAuthenticationEntryPoint;
import com.finalcall.infra.security.JwtAuthenticationFilter;

/**
 * 보안 설정(Stage F1) — 인증 "메커니즘(뼈대)"만. 인증 "정책(로그인/회원/권한상세)"은 넣지 않는다.
 *
 * <p>무상태(STATELESS) REST 기준: csrf 비활성, 세션 미사용, JWT 필터로 인증.
 * 인증/인가 실패는 3단계 ErrorResponse 포맷으로 통일한다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
        TokenProvider tokenProvider,
        JwtAuthenticationEntryPoint authenticationEntryPoint,
        JwtAccessDeniedHandler accessDeniedHandler,
        GatewayInternalProperties gatewayInternalProperties,
        ObjectMapper objectMapper) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            // cors 는 필요 시 여기서 구성(현재는 자리만).
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 회원가입·로그인·토큰재발급(계약 §2 인증 불요) · actuator · 에러 경로는 공개.
                .requestMatchers("/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/refresh",
                    "/actuator/**", "/error")
                .permitAll()
                // 데모/참조(sample, notice)는 공개 유지 — 실제 접근 정책은 도메인 구현 단계에서 정한다.
                // (notice 는 비인증 생성 시 createdBy=null 을 시연하기 위해 의도적으로 공개)
                .requestMatchers("/sample/**", "/notices/**").permitAll()
                // 아이템 카탈로그·인스턴스 상세는 공개(계약 §4.1 인증 불요 / items 상세는 인증 optional).
                //   me/** 인벤토리는 아래 anyRequest().authenticated() 로 인증을 강제한다(계약 §4.2).
                .requestMatchers(HttpMethod.GET, "/api/v1/item-templates", "/api/v1/items/**").permitAll()
                // 그 외(예: /api/v1/auth/logout, /api/v1/me/**)는 인증 필요.
                .anyRequest().authenticated())
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint(authenticationEntryPoint) // 401
                .accessDeniedHandler(accessDeniedHandler)) // 403
            // JWT 필터를 UsernamePasswordAuthenticationFilter 앞에 등록.
            .addFilterBefore(new JwtAuthenticationFilter(tokenProvider),
                UsernamePasswordAuthenticationFilter.class)
            // 직접접근 차단(D-068): 게이트웨이 경유 검증을 인증(JWT)보다 먼저 수행한다.
            .addFilterBefore(new GatewayAccessFilter(gatewayInternalProperties, objectMapper),
                JwtAuthenticationFilter.class);
        return http.build();
    }

    /** 비밀번호 해시(BCrypt) — 회원가입/로그인이 공유한다. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
