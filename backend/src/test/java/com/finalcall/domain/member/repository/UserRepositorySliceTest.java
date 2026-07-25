package com.finalcall.domain.member.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.finalcall.domain.member.entity.User;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 회원 리포지토리 슬라이스 테스트(member). notice 슬라이스 테스트 컨벤션을 따른다.
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 써야
 * Flyway DDL·V4 생성 컬럼 UK·MySQL 문법이 실제로 검증된다. @DataJpaTest 는 기본 @Transactional → 각 테스트 롤백.
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
    void 활성_존재검사와_로그인아이디_조회가_동작한다() {
        userRepository.save(user("hong", "홍길동"));
        em.flush();
        em.clear();

        assertThat(userRepository.existsByLoginIdAndIsDeletedFalse("hong")).isTrue();
        assertThat(userRepository.existsByLoginIdAndIsDeletedFalse("none")).isFalse();
        assertThat(userRepository.existsByNicknameAndIsDeletedFalse("홍길동")).isTrue();
        assertThat(userRepository.findByLoginIdAndIsDeletedFalse("hong")).isPresent();
        assertThat(userRepository.findByLoginIdAndIsDeletedFalse("none")).isEmpty();
    }

    @Test
    void 탈퇴_회원은_활성_존재검사와_조회에서_제외된다() {
        User saved = userRepository.save(user("gone", "탈퇴자"));
        saved.delete();
        userRepository.saveAndFlush(saved);
        em.clear();

        assertThat(userRepository.existsByLoginIdAndIsDeletedFalse("gone")).isFalse();
        assertThat(userRepository.existsByNicknameAndIsDeletedFalse("탈퇴자")).isFalse();
        assertThat(userRepository.findByLoginIdAndIsDeletedFalse("gone")).isEmpty();
    }

    // --- QA-S-MBR-06: 활성 유일성 회귀(총괄 083 조건 1). DB 레벨 단언 — 생성 컬럼 UK가 활성 중복을 실제로 차단하는지. ---
    // 선검사(existsBy)를 우회해 saveAndFlush 로 곧장 제약을 때린다. flush 없이 save 만 하면 위반이 지연돼 단언이 어긋난다.

    @Test
    void 활성_동일_loginId_2건은_uk_user_login_id_active_위반이다_QA_S_MBR_06() {
        userRepository.saveAndFlush(user("racer", "닉네임A"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(user("racer", "닉네임B")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 활성_동일_nickname_2건은_uk_user_nickname_active_위반이다_QA_S_MBR_06() {
        userRepository.saveAndFlush(user("idA", "같은닉네임"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(user("idB", "같은닉네임")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 탈퇴행과_활성행은_동일_loginId로_공존한다_재가입_허용() {
        User first = userRepository.save(user("reuser", "첫계정"));
        first.delete();
        userRepository.saveAndFlush(first); // 탈퇴행 → login_id_active NULL 로 UK 대상에서 빠진다
        em.clear();

        // 동일 login_id·nickname 활성 신규 행이 제약 위반 없이 저장돼야 한다(생성 컬럼 NULL 트릭).
        assertThatCode(() -> userRepository.saveAndFlush(user("reuser", "재가입계정")))
            .doesNotThrowAnyException();
        assertThat(userRepository.findByLoginIdAndIsDeletedFalse("reuser")).isPresent();
    }

    private User user(String loginId, String nickname) {
        return User.builder()
            .loginId(loginId)
            .passwordHash("hash")
            .nickname(nickname)
            .build();
    }
}
