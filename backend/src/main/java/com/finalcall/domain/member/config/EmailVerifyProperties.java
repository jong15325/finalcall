package com.finalcall.domain.member.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;

/**
 * 이메일 인증 정책 값 바인딩(email-verify-spec §2.4·§3). 코드 만료·재전송 쿨다운·시도 제한·자릿수는
 * <b>컴파일 상수가 아니라 운영 정책</b>이므로 {@code @ConfigurationProperties} + {@code @Validated} 로
 * 바인딩한다(CLAUDE.md §4 — 산발적 {@code @Value} 금지, {@code bid.increment}·{@code fee.policy} 선례).
 *
 * <p>모든 값이 {@code @Positive} 라 0/음수면 <b>부팅이 실패</b>한다(조용한 기본값 대체 금지, 섹션 4) — 예컨대
 * 시도 제한 0 은 무제한 무차별을, TTL 0 은 즉시 만료를 뜻해 정책을 무력화하므로 런타임에 흘려보내면 안 된다.
 *
 * <p><b>{@code sender-enabled} 는 여기에 없다</b>: 발송 스킵 플래그(spec §6.2·§6.3)는 FC-129 발송기의
 * {@code @ConditionalOnProperty("email.verify.sender-enabled")} 가 raw yml 키로 직접 소비하며 Properties
 * 바인딩 대상이 아니다. 바인딩 시 미매핑 키는 무시된다(ignoreUnknownFields 기본값).
 */
@Validated
@ConfigurationProperties(prefix = "email.verify")
public record EmailVerifyProperties(

    /**
     * 인증 코드 자릿수(6 고정, spec §3). 상한 9 는 {@code EmailVerificationCodeStore.generateCode} 의
     * {@code (int) Math.pow(10, codeLength)} 가 int 오버플로(codeLength≥10)에 빠지지 않도록 부팅 시 방어한다(m-3).
     */
    @Positive @Max(9) int codeLength,

    /** 코드 만료 시간(초). 이 시간이 지나면 코드는 자연 소멸한다(Redis TTL, spec §2.3). */
    @Positive long ttlSeconds,

    /** 재전송 쿨다운(초). 이 시간 안의 재요청은 {@code EMAIL_004} 로 거부한다(메일 폭탄·비용 방지). */
    @Positive long resendCooldownSeconds,

    /** 코드 오입력 허용 횟수. 초과 시 코드를 폐기하고 {@code EMAIL_003} 을 반환한다(무차별 방지). */
    @Positive int maxAttempts) {
}
