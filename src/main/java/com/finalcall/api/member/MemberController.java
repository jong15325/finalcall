package com.finalcall.api.member;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.member.MemberService;

import lombok.RequiredArgsConstructor;

/**
 * 회원(member) 컨트롤러 — 계약 [4.4] 내 리소스. 클래스 레벨 {@code /api/v1/me}(B-015).
 *
 * <p>반환 타입은 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러). 엔티티→응답 DTO 변환은 api 계층에서 수행한다.
 * 주체는 SecurityContext(B-009)에서 얻으며 경로에 사용자 식별자를 받지 않는다(타인 잔액 조회 불가).
 * 프로필 조회·수정·탈퇴({@code GET/PATCH/DELETE /me})는 별도 유닛이다.
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
}
