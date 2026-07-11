package com.finalcall.infra.security;

import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 작성자 auditing 제공자(Stage F1) — SecurityContext 의 인증 주체를 createdBy/modifiedBy 로 사용한다.
 *
 * <p>★ 비인증(익명/컨텍스트 없음) 시 {@link Optional#empty()} → createdBy 는 null.
 *   "SYSTEM" 같은 가짜 기본값을 넣지 않는다. null 은 "인증 컨텍스트 없이 생성됨"을 정직히 표현한다.
 *   진짜 시스템 배치는 배치 실행 컨텍스트에서 주체를 명시 주입해야 한다.
 */
@Component
public class SecurityAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        // getName() 은 principal 이 String(실토큰)이든 UserDetails(@WithMockUser)든 주체 이름을 반환한다.
        String name = authentication.getName();
        // 익명 사용자(anonymousUser)는 미인증으로 취급 → createdBy null.
        if (name == null || "anonymousUser".equals(name)) {
            return Optional.empty();
        }
        return Optional.of(name);
    }
}
