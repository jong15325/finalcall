package com.finalcall.domain.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 회원 리포지토리 슬라이스 테스트(auth). notice 슬라이스 테스트 컨벤션을 따른다.
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 써야
 * Flyway DDL·유니크 제약·MySQL 문법이 실제로 검증된다. @DataJpaTest 는 기본 @Transactional → 각 테스트 롤백.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class UserRepositorySliceTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 저장시_public_id와_생성시각이_자동_채워진다() {
        User saved = userRepository.save(user("tester", "테스터"));
        em.flush();

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getPublicId()).hasSize(26);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.isAdmin()).isFalse();
        assertThat(saved.isDeleted()).isFalse();
    }

    @Test
    void 존재검사와_로그인아이디_조회가_동작한다() {
        userRepository.save(user("hong", "홍길동"));
        em.flush();
        em.clear();

        assertThat(userRepository.existsByLoginId("hong")).isTrue();
        assertThat(userRepository.existsByLoginId("none")).isFalse();
        assertThat(userRepository.existsByNickname("홍길동")).isTrue();
        assertThat(userRepository.findByLoginId("hong")).isPresent();
        assertThat(userRepository.findByLoginId("none")).isEmpty();
    }

    @Test
    void 로그인아이디_중복이면_유니크제약_위반이다() {
        userRepository.save(user("dup", "닉네임A"));
        em.flush();

        assertThatThrownBy(() -> {
            userRepository.save(user("dup", "닉네임B"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 닉네임_중복이면_유니크제약_위반이다() {
        userRepository.save(user("idA", "같은닉네임"));
        em.flush();

        assertThatThrownBy(() -> {
            userRepository.save(user("idB", "같은닉네임"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    private User user(String loginId, String nickname) {
        return User.builder()
            .loginId(loginId)
            .passwordHash("hash")
            .nickname(nickname)
            .build();
    }
}
