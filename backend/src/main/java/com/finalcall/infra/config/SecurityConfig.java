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
                // 회원가입·로그인·토큰재발급·소셜 로그인 콜백·닉네임 가용성 조회(계약 §2 인증 불요) · actuator · 에러 경로는 공개.
                //   소셜 로그인(/oauth/**)은 /login 동류의 콜백 API 라 permitAll(엣지 게이트웨이 경유는 유지).
                //   닉네임 가용성 조회는 회원가입 중 비로그인 호출이라 /login 동류로 permitAll(EPIC-NICKNAME-UX v1.17).
                //   아이디 가용성 조회도 회원가입 중 비로그인 호출이라 동일하게 permitAll(EPIC-LOGINID-CHECK v1.18).
                .requestMatchers("/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/refresh",
                    "/api/v1/auth/oauth/**", "/api/v1/auth/nickname/availability",
                    "/api/v1/auth/login-id/availability", "/actuator/**", "/error")
                .permitAll()
                // 데모/참조(sample)는 공개 유지 — 실제 접근 정책은 도메인 구현 단계에서 정한다.
                //   (notice 참조 구현은 board 로 흡수·제거됨 — FC-201. 게시판 공개 경로는 아래 /api/v1/boards 참조.)
                .requestMatchers("/sample/**").permitAll()
                // 아이템 카탈로그·인스턴스 상세는 공개(계약 §4.1 인증 불요 / items 상세는 인증 optional).
                //   me/** 인벤토리는 아래 anyRequest().authenticated() 로 인증을 강제한다(계약 §4.2).
                .requestMatchers(HttpMethod.GET, "/api/v1/item-templates", "/api/v1/items/**").permitAll()
                // 경매 목록·상세는 공개(계약 §3.1 인증 불요). 등록(POST)·취소(POST .../cancel)는 아래 인증 강제.
                //   GET "/api/v1/auctions/*" 는 단일 세그먼트라 취소 경로(.../cancel, POST)와 겹치지 않는다.
                .requestMatchers(HttpMethod.GET, "/api/v1/auctions", "/api/v1/auctions/*").permitAll()
                // 입찰 내역 조회는 공개(계약 §3.1 인증 불요, 응답은 닉네임 마스킹). 위 "/api/v1/auctions/*" 는
                //   단일 세그먼트라 2세그먼트인 .../bids 에 걸리지 않아 별도 등재가 필요하다.
                //   ★ GET 만 연다 — POST(입찰)는 아래 anyRequest().authenticated() 로 인증을 유지한다.
                .requestMatchers(HttpMethod.GET, "/api/v1/auctions/*/bids").permitAll()
                // 고정가 목록·상세는 공개(계약 §3.2 인증 불요). 등록(POST)·구매(POST .../purchase)·취소(POST
                //   .../cancel)는 아래 인증 강제. GET "/api/v1/shops/*" 는 단일 세그먼트라 2세그먼트 POST 경로와 겹치지 않는다.
                .requestMatchers(HttpMethod.GET, "/api/v1/shops", "/api/v1/shops/*").permitAll()
                // 게시판 목록·단건 조회는 공개(계약 §6.1 인증 불요). 단일 세그먼트라 쓰기(관리자 CRUD)·게시글 하위 경로와 겹치지 않는다.
                //   write_policy(ADMIN_ONLY) 세부 게이팅은 서비스 계층 담당(게시판별 정책이 DB 값이라 URL 패턴으로 표현 불가, §6.5).
                .requestMatchers(HttpMethod.GET, "/api/v1/boards", "/api/v1/boards/*").permitAll()
                // 게시글 목록·상세 조회는 공개(계약 §6.2 인증 불요). 위 "/api/v1/boards/*" 는 단일 세그먼트라 posts 하위 경로에 걸리지
                //   않아 별도 등재가 필요하다. ★ GET 만 연다 — 작성(POST)·수정(PUT)·삭제(DELETE)는 아래 anyRequest().authenticated()
                //   로 인증을 유지하고, write_policy(ADMIN_ONLY) 세부 게이팅은 서비스 계층이 판정한다(§6.5).
                .requestMatchers(HttpMethod.GET, "/api/v1/boards/*/posts", "/api/v1/boards/*/posts/*").permitAll()
                // 댓글·답글 목록 조회는 공개(계약 §6.3·§6.5 인증 불요). 댓글 경로는 게시글 public_id 에 직접 건다(§1.1 1단 중첩).
                //   ★ GET 만 연다 — 작성(POST)·답글 작성(POST …/replies)·수정(PUT)·삭제(DELETE)는 아래 anyRequest().authenticated()
                //   로 인증을 유지하고, allow_comments 게이팅·소유검증(작성자 OR ROLE_ADMIN)·대댓글 루트 정규화는 서비스가 판정한다.
                //   답글 목록(EPIC-COMMENT-V2, FC-207)은 세그먼트가 더 깊어(…/comments/*/replies) 위 단일 매처가 삼키지 않으므로
                //   별도 등재한다. 반응 토글(PUT …/comments/*/reaction, FC-208)은 GET 이 아니라(공개 GET 매처가 안 삼킴) 아래
                //   anyRequest().authenticated() 로 인증이 강제되고, 자기 반응 금지(COMMENT_003)는 서비스가 판정한다(§6.5) —
                //   별도 매처 불요(반응 GET 없음).
                .requestMatchers(HttpMethod.GET, "/api/v1/posts/*/comments").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/posts/*/comments/*/replies").permitAll()
                // 이미지 업로드(POST /api/v1/board-images, api §6.4)는 인증 필요 — 공개 GET 화이트리스트에 없어 아래
                //   anyRequest().authenticated() 로 자연히 인증이 강제된다(별도 서빙 엔드포인트 없음, 노출은 스토리지 presigned URL, §6.5).
                // 그 외(예: /api/v1/auth/logout, /api/v1/me/**, POST /api/v1/auctions, POST /api/v1/shops)는 인증 필요.
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
