package com.finalcall.domain.member.service;

import java.util.Locale;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.EmailErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.mail.entity.EmailTemplateKey;
import com.finalcall.domain.mail.service.EmailTemplateService;
import com.finalcall.domain.mail.service.RenderedEmail;
import com.finalcall.domain.member.config.EmailVerifyProperties;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.mail.EmailSender;
import com.finalcall.infra.security.EmailVerificationCodeStore;
import com.finalcall.infra.security.EmailVerificationCodeStore.VerifyOutcome;

import lombok.RequiredArgsConstructor;

/**
 * 이메일 설정·인증 오케스트레이션 서비스(member, EPIC-EMAIL-VERIFY B7 · EPIC-EMAIL-TEMPLATE 연동) —
 * 계약 §4.2~§4.4. 세 협력자({@link EmailVerificationCodeStore}·{@link EmailTemplateService}·{@link EmailSender})를
 * 직접 조립한다(facade 미신설, email-template-spec §2.3).
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기만 오버라이드(CLAUDE.md §5). 인증 주체는
 * SecurityContext 기준(B-009·D-065) — JWT 필터가 적재한 userId(내부 PK)를 읽고 임의 이메일 파라미터를 받지 않는다
 * (자기 계정만, SEC-007 열거 최소).
 *
 * <p><b>트랜잭션 경계(concurrency-review)</b>:
 * <ul>
 *   <li>{@code setEmail} — 유일한 DB 쓰기라 {@code @Transactional}. flush 로 UK 위반을 이 계층에서 EMAIL_007 로
 *       매핑한 뒤 pending 코드/쿨다운을 삭제(TOCTOU 주 방어).</li>
 *   <li>{@code requestVerification} — <b>SMTP 발송을 열린 DB 트랜잭션 안에서 하지 않는다</b>(커넥션 점유 회피,
 *       spec §4.3 ⚠). {@code NOT_SUPPORTED} 로 tx 없이 실행 — user 로드는 짧은 auto-commit 조회로 끝내고 발송은
 *       tx 밖에서 한다. 발송 실패는 그대로 전파(verification-request 만 실패, 가입·로그인 무영향 §6).</li>
 *   <li>{@code verify} — Redis 검증(원자 Lua)을 tx 밖에서 먼저 수행하고, 성공 시에만 DB 쓰기(markEmailVerified)를
 *       저장소 자체 tx({@code save} 병합)로 커밋한다. Redis I/O 를 DB 트랜잭션 밖에 둔다.</li>
 * </ul>
 *
 * <p>보안: 발급 코드값·{@link RenderedEmail} 은 로그로 남기지 않는다({@code @ServiceLog} 는 메서드명·소요시간만 기록).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmailVerificationService {

    private final UserRepository userRepository;
    private final EmailVerificationCodeStore codeStore;
    private final EmailTemplateService emailTemplateService;
    private final EmailSender emailSender;
    private final EmailVerifyProperties emailVerifyProperties;

    /**
     * 이메일을 설정/변경한다(계약 §4.2). 정규화(lowercase+trim) 후 현재 저장값과 같으면 <b>no-op</b>(이미 인증된
     * 이메일 재제출 시 인증이 풀리지 않게 {@code emailVerified} 불변). 다르면 {@link User#assignEmail}(emailVerified
     * false 재초기화) 후 pending 코드·쿨다운을 삭제(TOCTOU 주 방어, spec §2.3).
     *
     * <p>유일성은 {@code uk_user_email_active}(V17) 안전망으로 강제한다 — signup·nickname 패턴 준용으로 커밋 전
     * 강제 {@code flush} 해 경쟁 중복 UK 위반을 이 계층에서 {@code EMAIL_007} 로 매핑한다(flush 는 UK 확정 후 clear
     * 순서라 위반 시 pending 코드가 보존된다).
     *
     * @return 이메일이 반영된 {@link User}(표현 변환은 controller 담당 — 원문 에코, spec §4.2)
     */
    @Transactional
    @ServiceLog
    public User setEmail(String rawEmail) {
        String normalizedEmail = rawEmail.trim().toLowerCase(Locale.ROOT);
        User user = currentActiveUser();
        if (normalizedEmail.equals(user.getEmail())) {
            return user; // 동일 이메일 재설정 — no-op(emailVerified 불변)
        }
        user.assignEmail(normalizedEmail); // emailVerified=false 재초기화
        try {
            userRepository.flush(); // 커밋 전 강제 flush — 경쟁 중복 UK 위반을 이 계층에서 매핑
        } catch (DataIntegrityViolationException e) {
            throw toEmailDuplicateException(e);
        }
        codeStore.clear(String.valueOf(user.getId())); // pending 코드·쿨다운 삭제(TOCTOU 주 방어)
        return user;
    }

    /**
     * 인증 코드 발송을 요청한다(계약 §4.3, 202). 미설정→{@code EMAIL_006}, 이미 인증→{@code EMAIL_005},
     * 쿨다운 내→{@code EMAIL_004}. 통과 시 6자리 코드 발급(Redis 해시 저장) → {@code EMAIL_VERIFICATION} 템플릿
     * 렌더 → 발송.
     *
     * <p>{@code NOT_SUPPORTED} 로 DB 트랜잭션 없이 실행한다 — SMTP 발송 중 커넥션 점유를 피하기 위함(spec §4.3 ⚠).
     * user 로드는 짧은 조회로 끝내고, 렌더링(mail feature)·발송(infra)은 tx 밖에서 조립한다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @ServiceLog
    public void requestVerification() {
        User user = currentActiveUser();
        Preconditions.validate(user.getEmail() != null, EmailErrorCode.EMAIL_NOT_SET); // EMAIL_006
        Preconditions.validate(!user.isEmailVerified(), EmailErrorCode.EMAIL_ALREADY_VERIFIED); // EMAIL_005

        String userId = String.valueOf(user.getId());
        String email = user.getEmail();
        String code = codeStore.issue(userId, email)
            .orElseThrow(() -> new BusinessException(EmailErrorCode.EMAIL_RESEND_COOLDOWN)); // EMAIL_004(쿨다운)

        long expiryMinutes = emailVerifyProperties.ttlSeconds() / 60;
        RenderedEmail rendered = emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION, Map.of("code", code, "expiryMinutes", expiryMinutes));
        emailSender.send(email, rendered.subject(), rendered.body(), rendered.html()); // tx 밖 발송
    }

    /**
     * 제시된 코드를 확인한다(계약 §4.4, 200). 이미 인증→{@code EMAIL_005}, 이메일 미설정(pending 없음)→
     * {@code EMAIL_002}(만료 통일, 저장소에 null 을 넘겨 NPE 내지 않도록 사전 가드). 이후 저장소 원자 검증 결과를
     * 매핑: SUCCESS→{@link User#markEmailVerified} 커밋, MISMATCH→{@code EMAIL_001}, EXPIRED→{@code EMAIL_002},
     * ATTEMPTS_EXCEEDED→{@code EMAIL_003}.
     *
     * <p>{@code NOT_SUPPORTED} 로 로드·Redis 검증을 tx 밖에서 수행하고, 성공 시에만 {@code save} 로 인증 플래그를
     * 병합 커밋한다(DB 쓰기만 트랜잭션, Redis 검증은 그 전).
     *
     * @return 인증이 반영된 {@link User}(성공 시 {@code emailVerified=true})
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @ServiceLog
    public User verify(String code) {
        User user = currentActiveUser();
        Preconditions.validate(!user.isEmailVerified(), EmailErrorCode.EMAIL_ALREADY_VERIFIED); // EMAIL_005
        // 이메일 미설정이면 pending 코드가 존재할 수 없다 → EMAIL_002 로 통일(저장소 null 전달 방지 사전 가드).
        Preconditions.validate(user.getEmail() != null, EmailErrorCode.EMAIL_CODE_EXPIRED_OR_ABSENT); // EMAIL_002

        VerifyOutcome outcome = codeStore.verify(String.valueOf(user.getId()), code, user.getEmail());
        switch (outcome) {
            case SUCCESS -> {
                user.markEmailVerified();
                userRepository.save(user); // 성공 시에만 DB 쓰기 — 저장소 자체 tx 로 병합 커밋
            }
            case MISMATCH -> throw new BusinessException(EmailErrorCode.EMAIL_CODE_MISMATCH); // EMAIL_001
            case EXPIRED -> throw new BusinessException(EmailErrorCode.EMAIL_CODE_EXPIRED_OR_ABSENT); // EMAIL_002
            case ATTEMPTS_EXCEEDED ->
                throw new BusinessException(EmailErrorCode.EMAIL_VERIFY_ATTEMPTS_EXCEEDED); // EMAIL_003
            default -> throw new BusinessException(CommonErrorCode.INTERNAL_ERROR); // 도달 불가(열거 전수 처리)
        }
        return user;
    }

    /**
     * 이메일 UK({@code uk_user_email_active}) 위반을 {@code EMAIL_007}(409)로 변환한다(signup 의 방어 패턴 준용).
     * 이메일 UK 외 무결성 위반은 원본을 유지해 전역 핸들러(500)가 처리한다.
     */
    private BusinessException toEmailDuplicateException(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause().getMessage();
        String lower = cause == null ? "" : cause.toLowerCase(Locale.ROOT);
        if (lower.contains("uk_user_email_active")) {
            return new BusinessException(EmailErrorCode.EMAIL_DUPLICATE);
        }
        throw ex;
    }

    /**
     * 인증 주체를 활성 {@link User} 로 로드한다(D-081). 활성 행 부재는 탈퇴 계정이 access 만료 전에 호출한 경우라
     * {@code COMMON_005}(401)로 응답한다(MemberService 와 동일 코드·포맷 — 탈퇴 여부 비노출, SEC-007).
     */
    private User currentActiveUser() {
        return userRepository.findByIdAndIsDeletedFalse(currentUserId())
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
    }

    /** 인증 주체(principal)를 userId(내부 PK)로 해석한다. JWT 필터가 subject=userId 로 적재한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
