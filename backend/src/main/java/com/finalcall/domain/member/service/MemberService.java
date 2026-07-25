package com.finalcall.domain.member.service;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.member.MemberErrorCode;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.security.RefreshTokenStore;

import lombok.RequiredArgsConstructor;

/**
 * 회원(member) 서비스 — 내 잔액 조회(계약 [4.4]) + 프로필 조회·수정·탈퇴(계약 §2.5).
 * 클래스 레벨 {@code @Transactional(readOnly = true)}, 쓰기만 오버라이드(CLAUDE.md [5]).
 *
 * <p>인증 주체 식별은 SecurityContext 기준이다(B-009) — JWT 필터가 적재한 userId(내부 PK)를 읽고,
 * {@code X-User-Id} 헤더는 신뢰하지 않는다(D-065). 타인 리소스 접근은 불가하며 경로에 사용자 식별자를 받지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final UserRepository userRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final RefreshTokenStore refreshTokenStore;

    /**
     * 인증 사용자의 잔액을 조회한다. 잔액 행 부재는 비즈니스 상태가 아니라 깨진 불변식이므로
     * (signup 이 user 와 user_balance 를 1:1 로 함께 생성, V3 UK+FK) {@code COMMON_999}(500)로 처리한다(B-029).
     *
     * @return 표현 변환 전 {@link UserBalance} 엔티티(엔티티→응답 DTO 변환은 api 계층 담당)
     */
    @ServiceLog
    public UserBalance getMyBalance() {
        Long userId = currentUserId();
        return userBalanceRepository.findByUserId(userId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
    }

    /**
     * 인증 사용자의 프로필을 조회한다(계약 §2.5 GET /me).
     *
     * @return 표현 변환 전 {@link User} 엔티티(엔티티→응답 DTO 변환은 api 계층 담당)
     */
    @ServiceLog
    public User getMyProfile() {
        return currentActiveUser();
    }

    /**
     * 인증 사용자의 닉네임을 수정한다(계약 §2.5 PATCH /me). 변경은 영속 엔티티 dirty checking 으로 커밋 시 반영된다.
     *
     * <p>중복 검사는 활성 회원 대상({@code existsByNicknameAndIsDeletedFalse}, D-081)이며 프로필 수정 맥락이라
     * {@code MEMBER_001}(가입의 {@code AUTH_002} 아님)로 막는다. 현재 닉네임과 동일한 무변경 요청은 자기 자신이
     * 활성 UK 를 점유해 오탐하므로, 값이 바뀔 때만 중복을 검사한다.
     *
     * <p>중복 방어는 이중이다(signup 과 동일 패턴): {@code existsBy} 선검사 + UK 제약 안전망. 선검사를 통과한
     * 경쟁·동시 중복은 dirty checking UPDATE 의 flush 시 {@code uk_user_nickname_active} 위반으로 터지는데, 커밋
     * 시점 flush 는 서비스 밖이라 전역 핸들러가 500 으로 처리한다. 따라서 값이 바뀐 경우 커밋 전 강제 flush 로
     * 위반을 이 계층에서 잡아 {@code MEMBER_001}(409)로 매핑한다(닉네임 UK 한정).
     *
     * @return 닉네임이 반영된 {@link User} 엔티티
     */
    @Transactional
    @ServiceLog
    public User updateNickname(String nickname) {
        User user = currentActiveUser();
        boolean changed = !user.getNickname().equals(nickname);
        if (changed) {
            Preconditions.validate(
                !userRepository.existsByNicknameAndIsDeletedFalse(nickname),
                MemberErrorCode.MEMBER_DUPLICATE_NICKNAME);
        }
        user.changeNickname(nickname);
        if (changed) {
            try {
                userRepository.flush(); // 커밋 전 강제 flush — 경쟁 중복 UK 위반을 이 계층에서 매핑하기 위함
            } catch (DataIntegrityViolationException e) {
                throw toNicknameDuplicateException(e);
            }
        }
        return user;
    }

    /**
     * 닉네임 UK({@code uk_user_nickname_active}) 위반을 {@code MEMBER_001}(409)로 변환한다(signup 의 방어 패턴 준용).
     * 닉네임 UK 외 무결성 위반은 원본을 유지해 전역 핸들러(500)가 처리한다.
     */
    private BusinessException toNicknameDuplicateException(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause().getMessage();
        String lower = cause == null ? "" : cause.toLowerCase(Locale.ROOT);
        if (lower.contains("uk_user_nickname_active")) {
            return new BusinessException(MemberErrorCode.MEMBER_DUPLICATE_NICKNAME);
        }
        throw ex;
    }

    /**
     * 인증 사용자를 탈퇴 처리한다(계약 §2.5 DELETE /me) — soft delete + refresh 세션 전부 폐기(SEC-006).
     *
     * <p>차단 조건({@code MEMBER_002}, 409)은 <b>soft delete 보다 먼저</b> 검사한다(차단이면 아무것도 바꾸지 않음).
     * 지금은 게임머니 홀드 보유({@code gameMoneyHeld > 0})만 막는다.
     * <b>(A) 확장 지점</b> — TODO(auction/bid/order 도메인 착수 시): 진행 중 경매(판매자)·미완료 주문 체크를 여기에 추가한다.
     * 잔액 잔존 자체는 차단 사유가 아니다(D-080 — 소멸·복구 불가).
     *
     * <p>폐기 순서(FC-003 필수): {@link RefreshTokenStore#revokeAll}의 SCAN 은 스냅숏이 아니므로,
     * ① {@code user.delete()}로 신규 세션 발급을 먼저 차단한 뒤 ② {@code revokeAll} 로 잔여 세션을 일괄 폐기한다.
     *
     * <p><b>순서의 실효 범위(한계)</b>: 단일 트랜잭션이라 {@code user.delete()}의 UPDATE 는 커밋 시점에 반영되고,
     * 커밋 전까지는 다른 트랜잭션에서 삭제가 보이지 않는다. 따라서 delete→revokeAll 순서는 트랜잭션 내 즉시 실효가
     * 아니라 <b>커밋 원자성</b>으로 최종 정합(탈퇴 + 세션 폐기가 함께 커밋)을 보장한다. 커밋 직전 좁은 경쟁창은
     * access 단명(≤30분)·refresh 폐기로 위험이 낮아 현행(단일 트랜잭션)을 유지한다.
     */
    @Transactional
    @ServiceLog
    public void withdraw() {
        User user = currentActiveUser();
        UserBalance balance = userBalanceRepository.findByUserId(user.getId())
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        Preconditions.validate(
            balance.getGameMoneyHeld() == 0L, MemberErrorCode.MEMBER_WITHDRAW_BLOCKED_BY_ACTIVE_TRADE);

        user.delete(); // ① soft delete — 신규 세션 발급 차단(login 은 활성 회원만 조회)
        refreshTokenStore.revokeAll(String.valueOf(user.getId())); // ② 잔여 refresh 세션 일괄 폐기
    }

    /**
     * 인증 주체를 활성 {@link User} 로 로드한다. 단건 조회도 활성 필터를 동반한다(D-081).
     *
     * <p>활성 행 부재는 탈퇴(soft delete) 계정이 access 만료 전에 {@code /me} 를 호출한 경우다 — 세션이 이미
     * 무효화됐어야 할 주체이므로 {@code COMMON_005}(401)로 응답한다. 만료·무효 토큰을 401 로 막는 EntryPoint 와
     * 동일 코드·포맷이라 탈퇴 여부가 응답으로 드러나지 않는다(SEC-007 열거 방지). 전역 핸들러가 상태를 반영한다.
     */
    private User currentActiveUser() {
        Long userId = currentUserId();
        return userRepository.findByIdAndIsDeletedFalse(userId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
    }

    /** 인증 주체(principal)를 userId(내부 PK)로 해석한다. JWT 필터가 subject=userId 로 적재한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
