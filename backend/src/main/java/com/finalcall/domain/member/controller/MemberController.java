package com.finalcall.domain.member.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.member.dto.MemberBalanceResponse;
import com.finalcall.domain.member.dto.MemberProfileResponse;
import com.finalcall.domain.member.dto.MemberProfileUpdateRequest;
import com.finalcall.domain.member.dto.MemberWithdrawRequest;
import com.finalcall.domain.member.service.MemberService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 회원(member) 컨트롤러 — 계약 [4.4] 내 리소스. 클래스 레벨 {@code /api/v1/me}(B-015).
 *
 * <p>반환 타입은 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러). 엔티티→응답 DTO 변환은 api 계층에서 수행한다.
 * 주체는 SecurityContext(B-009)에서 얻으며 경로에 사용자 식별자를 받지 않는다(타인 리소스 접근 불가).
 */
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    /** 내 잔액 조회 — 인증 필요. 성공 시 200, 캐시·게임머니·홀드·가용 잔액 4필드(계약 [4.4]). */
    @GetMapping("/balance")
    public ApiResponse<MemberBalanceResponse> getBalance() {
        return ApiResponse.success(MemberBalanceResponse.from(memberService.getMyBalance()));
    }

    /** 내 프로필 조회 — 인증 필요. 성공 시 200, {@code userPublicId·nickname·isAdmin·createdAt}(계약 §2.5). */
    @GetMapping
    public ApiResponse<MemberProfileResponse> getProfile() {
        return ApiResponse.success(MemberProfileResponse.from(memberService.getMyProfile()));
    }

    /** 내 프로필 수정(nickname 한정) — 인증 필요. 성공 시 200(조회와 동일 스키마), 닉네임 중복은 MEMBER_001(계약 §2.5). */
    @PatchMapping
    public ApiResponse<MemberProfileResponse> updateProfile(@Valid @RequestBody MemberProfileUpdateRequest request) {
        return ApiResponse.success(MemberProfileResponse.from(memberService.updateNickname(request.nickname())));
    }

    /**
     * 탈퇴(soft delete) — 인증 필요. 잔액 소멸 동의 필수(누락·미동의 400). 성공 시 204(계약 §2.5·§1.5).
     * 204 no-body 라 예외적으로 ApiResponse 를 감싸지 않는다(CLAUDE.md §5). 동의값은 {@code @Valid} 로 강제되므로 서비스로 넘기지 않는다.
     */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@Valid @RequestBody MemberWithdrawRequest request) {
        memberService.withdraw();
    }
}
