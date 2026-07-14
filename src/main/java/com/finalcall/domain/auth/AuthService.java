package com.finalcall.domain.auth;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증(auth) 서비스 — 회원가입. 클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기만 오버라이드(CLAUDE.md §5).
 *
 * <p>로그인/재발급/로그아웃은 후속 단위에서 추가한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * 회원가입: loginId/nickname 중복 검사 → BCrypt 해시 → User + UserBalance(0,0,0)를 <b>단일 트랜잭션</b>으로 생성한다.
     *
     * <p>SEC-007(열거 방지): 실패 응답은 AuthErrorCode 표준 메시지만 노출한다(구체 사유 최소화). nickname 중복은 표시용이라 유지.
     *
     * @return 생성된 {@link User}(public_id 는 생성자에서 ULID 로 채워짐). 표현 변환은 api 계층이 담당.
     */
    @Transactional
    @ServiceLog
    public User signup(String loginId, String password, String nickname) {
        Preconditions.validate(!userRepository.existsByLoginId(loginId), AuthErrorCode.AUTH_DUPLICATE_LOGIN_ID);
        Preconditions.validate(!userRepository.existsByNickname(nickname), AuthErrorCode.AUTH_DUPLICATE_NICKNAME);

        User user = userRepository.save(User.builder()
                .loginId(loginId)
                .passwordHash(passwordEncoder.encode(password))
                .nickname(nickname)
                .build());
        // 잔액 행(0,0,0)을 같은 트랜잭션에서 함께 생성한다.
        userBalanceRepository.save(UserBalance.builder().user(user).build());
        return user;
    }
}
