package com.finalcall.domain.member.service;

import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.member.entity.SocialAccount;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.SocialAccountRepository;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 신규 소셜 회원 등록 협력 빈(member, EPIC-OAUTH FC-153). {@link SocialAccountService} 오케스트레이션이 신규
 * 신원일 때 위임하는 <b>쓰기 단일 트랜잭션</b>이다 — 소셜 전용 {@link User}(loginId·passwordHash NULL) +
 * {@link UserBalance}(0,0,0) + {@link SocialAccount} 를 원자적으로 생성한다(AuthService.signup 선례).
 *
 * <p>별도 빈으로 분리한 이유(FC-157 M-1): 동시 최초 로그인 경쟁에서 (provider, provider_user_id) UK 위반으로
 * INSERT 가 실패하면 이 트랜잭션만 롤백되고, 호출 측(오케스트레이터)이 <b>독립 트랜잭션</b>에서 승자 행을
 * 재조회해 멱등 수렴한다. 자기호출(self-invocation)로는 트랜잭션 경계를 나눌 수 없어 협력 빈으로 둔다.
 */
@Service
@RequiredArgsConstructor
public class SocialAccountRegistrar {

    private static final int NICKNAME_MAX_LENGTH = 30;
    private static final int NICKNAME_SUFFIX_LENGTH = 4;
    // '_' + 접미사 길이. 접미사 부착 시 원본(stem)을 이 폭만큼 잘라 총 길이 ≤ NICKNAME_MAX_LENGTH 를 보장한다.
    private static final int NICKNAME_SUFFIX_TOTAL = NICKNAME_SUFFIX_LENGTH + 1;
    private static final int NICKNAME_MAX_ATTEMPTS = 10;
    private static final String NICKNAME_FALLBACK_BASE = "user";
    private static final String SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

    private final UserRepository userRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final SocialAccountRepository socialAccountRepository;

    /**
     * 신규 소셜 회원을 생성한다(단일 트랜잭션). 동시 최초 로그인 경쟁 시 {@code (provider, provider_user_id)} UK
     * 위반은 {@code DataIntegrityViolationException} 으로 전파되며(이 트랜잭션 롤백), 재수렴은 호출 측이 담당한다.
     *
     * @return 생성된 {@link User}(신규 엔티티라 완전 초기화 상태 — 지연 프록시 아님).
     */
    @Transactional
    @ServiceLog
    public User register(SocialProvider provider, String providerUserId, String nickname) {
        User user = User.builder()
            .nickname(resolveUniqueNickname(nickname))
            .build();
        userRepository.save(user);
        // 잔액 행(0,0,0)을 같은 트랜잭션에서 함께 생성한다(가입 불변식: user ↔ user_balance 1:1).
        userBalanceRepository.save(UserBalance.builder().user(user).build());
        socialAccountRepository.save(SocialAccount.builder()
            .user(user)
            .provider(provider)
            .providerUserId(providerUserId)
            .build());
        return user;
    }

    /**
     * 활성 nickname UK 와 충돌하지 않는 닉네임을 결정한다. 원본이 비어 있으면 대체 기본값을 쓰고, 충돌 시
     * 무작위 접미사(`_XXXX`)를 붙여 재시도한다. 총 길이는 항상 {@code VARCHAR(30)} 이내로 자른다.
     */
    private String resolveUniqueNickname(String desired) {
        String base = normalizeBase(desired);
        if (!userRepository.existsByNicknameAndIsDeletedFalse(base)) {
            return base;
        }
        // 접미사 부착분을 위해 stem 을 잘라 총 길이 ≤ 30 을 보장한다.
        String stem = truncate(base, NICKNAME_MAX_LENGTH - NICKNAME_SUFFIX_TOTAL);
        for (int attempt = 0; attempt < NICKNAME_MAX_ATTEMPTS; attempt++) {
            String candidate = stem + "_" + randomSuffix();
            if (!userRepository.existsByNicknameAndIsDeletedFalse(candidate)) {
                return candidate;
            }
        }
        // 무작위 접미사 공간(36^4 ≈ 168만)에서 10회 연속 충돌은 사실상 불가능 — 발생 시 깨진 불변식으로 처리.
        throw new BusinessException(CommonErrorCode.INTERNAL_ERROR);
    }

    /** 원본 닉네임 정규화: trim · 공백/빈값이면 대체 기본값 · {@code VARCHAR(30)} 이내로 절단. */
    private String normalizeBase(String desired) {
        String trimmed = desired == null ? "" : desired.trim();
        String base = trimmed.isEmpty() ? NICKNAME_FALLBACK_BASE : trimmed;
        return truncate(base, NICKNAME_MAX_LENGTH);
    }

    private String truncate(String value, int maxLength) {
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    private String randomSuffix() {
        StringBuilder sb = new StringBuilder(NICKNAME_SUFFIX_LENGTH);
        ThreadLocalRandom random = ThreadLocalRandom.current();
        for (int i = 0; i < NICKNAME_SUFFIX_LENGTH; i++) {
            sb.append(SUFFIX_ALPHABET.charAt(random.nextInt(SUFFIX_ALPHABET.length())));
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }
}
