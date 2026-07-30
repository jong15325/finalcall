package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.member.entity.SocialAccount;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.SocialAccountRepository;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.domain.member.service.SocialAccountService;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * 소셜 find-or-create 통합 검증(FC-153) — 실제 MySQL(Testcontainers) + Flyway V19 + JPA validate.
 *
 * <p>Flyway V19(user_social_account 신설 · user.login_id·password_hash nullable화)가 엔티티와 정합해야
 * 컨텍스트가 뜬다(validate). ★ 각 테스트 {@code @Transactional} 롤백으로 커밋 데이터가 새지 않게 한다.
 */
@Transactional
class SocialAccountFindOrCreateIntegrationTest extends IntegrationTest {

    @Autowired
    private SocialAccountService socialAccountService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private SocialAccountRepository socialAccountRepository;

    @PersistenceContext
    private EntityManager em;

    @Test
    void 신규_소셜신원이면_소셜전용회원과_잔액과_소셜신원행을_생성한다() {
        User created = socialAccountService.findOrCreate(SocialProvider.NAVER, "naver-new-1", "네이버유저");
        em.flush();
        em.clear();

        User reloaded = userRepository.findById(created.getId()).orElseThrow();
        // 소셜 전용 계정: loginId·passwordHash 는 NULL(V19 nullable화), 이메일 미저장(결정 2).
        assertThat(reloaded.getLoginId()).isNull();
        assertThat(reloaded.getPasswordHash()).isNull();
        assertThat(reloaded.getEmail()).isNull();
        // 항상-꼬리표(EPIC-NICKNAME-UX v1.17): 표시명 스템 + 무작위 `_XXXX`(총 ≤30). 원문 그대로는 저장하지 않는다.
        assertThat(reloaded.getNickname()).isNotEqualTo("네이버유저");
        assertThat(reloaded.getNickname()).startsWith("네이버유저_");
        assertThat(reloaded.getNickname().length()).isLessThanOrEqualTo(30);
        assertThat(reloaded.getPublicId()).hasSize(26);

        UserBalance balance = userBalanceRepository.findByUserId(created.getId()).orElseThrow();
        assertThat(balance.getCashBalance()).isZero();
        assertThat(balance.getGameMoneyBalance()).isZero();
        assertThat(balance.getGameMoneyHeld()).isZero();

        SocialAccount social = socialAccountRepository
            .findByProviderAndProviderUserId(SocialProvider.NAVER, "naver-new-1").orElseThrow();
        assertThat(social.getUser().getId()).isEqualTo(created.getId());
        assertThat(social.getProvider()).isEqualTo(SocialProvider.NAVER);
        assertThat(social.getProviderUserId()).isEqualTo("naver-new-1");
        assertThat(social.getCreatedAt()).isNotNull();
    }

    @Test
    void 동일_소셜신원_재로그인이면_같은_회원을_반환하고_행을_추가하지_않는다() {
        User first = socialAccountService.findOrCreate(SocialProvider.KAKAO, "kakao-reuse", "카카오유저");
        em.flush();
        long socialCountAfterFirst = socialAccountRepository.count();
        long userCountAfterFirst = userRepository.count();

        User second = socialAccountService.findOrCreate(SocialProvider.KAKAO, "kakao-reuse", "다른닉네임");
        em.flush();

        assertThat(second.getId()).isEqualTo(first.getId());
        // 재로그인은 신규 회원·소셜 신원을 만들지 않는다(중복가입 방지).
        assertThat(socialAccountRepository.count()).isEqualTo(socialCountAfterFirst);
        assertThat(userRepository.count()).isEqualTo(userCountAfterFirst);
    }

    @Test
    void 닉네임이_기존_활성회원과_충돌하면_접미사를_붙여_생성한다() {
        // 활성 회원이 "충돌닉" 을 선점(비밀번호 계정).
        userRepository.save(User.builder().loginId("occupier").passwordHash("hash").nickname("충돌닉").build());
        em.flush();

        User created = socialAccountService.findOrCreate(SocialProvider.NAVER, "naver-collide", "충돌닉");
        em.flush();

        assertThat(created.getNickname()).isNotEqualTo("충돌닉");
        assertThat(created.getNickname()).startsWith("충돌닉_");
        assertThat(created.getNickname().length()).isLessThanOrEqualTo(30);
    }
}
