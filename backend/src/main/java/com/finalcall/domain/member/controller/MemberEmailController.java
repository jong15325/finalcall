package com.finalcall.domain.member.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.member.dto.EmailResponse;
import com.finalcall.domain.member.dto.EmailSetRequest;
import com.finalcall.domain.member.dto.EmailVerifiedResponse;
import com.finalcall.domain.member.dto.EmailVerifyRequest;
import com.finalcall.domain.member.service.EmailVerificationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 회원 이메일 설정·인증 컨트롤러(member, EPIC-EMAIL-VERIFY B7) — 계약 §4.2~§4.4. 클래스 레벨
 * {@code /api/v1/me/email}. {@code /api/v1/me/**} 는 이미 {@code authenticated()} 라 SecurityConfig 무변경이며,
 * 주체는 SecurityContext(경로에 사용자 식별자를 받지 않는다, SEC-007).
 *
 * <p>반환은 {@link ApiResponse}(200), 발송 요청은 본문 없는 <b>202</b>(void + {@code @ResponseStatus} — ApiResponse
 * 미래핑, B-019·D-076). try-catch 금지(전역 핸들러). 엔티티→응답 DTO 변환은 controller 에서 수행한다.
 */
@RestController
@RequestMapping("/api/v1/me/email")
@RequiredArgsConstructor
public class MemberEmailController {

    private final EmailVerificationService emailVerificationService;

    /** 이메일 설정/변경 — 인증 필요. 성공 시 200 {@code {email, emailVerified:false}}, 중복은 EMAIL_007(계약 §4.2). */
    @PutMapping
    public ApiResponse<EmailResponse> setEmail(@Valid @RequestBody EmailSetRequest request) {
        return ApiResponse.success(EmailResponse.from(emailVerificationService.setEmail(request.email())));
    }

    /**
     * 인증 코드 발송 요청(본문 없음) — 인증 필요. 성공 시 <b>202</b>(본문 없음, 계약 §4.3). 미설정 EMAIL_006·이미
     * 인증 EMAIL_005·쿨다운 EMAIL_004 는 전역 핸들러가 처리한다. 202 no-body 라 ApiResponse 를 감싸지 않는다.
     */
    @PostMapping("/verification-request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestVerification() {
        emailVerificationService.requestVerification();
    }

    /** 인증 코드 확인 — 인증 필요. 성공 시 200 {@code {emailVerified:true}}(계약 §4.4). 실패는 EMAIL_001/002/003/005. */
    @PostMapping("/verify")
    public ApiResponse<EmailVerifiedResponse> verify(@Valid @RequestBody EmailVerifyRequest request) {
        return ApiResponse.success(EmailVerifiedResponse.from(emailVerificationService.verify(request.code())));
    }
}
