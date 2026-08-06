package com.finalcall.domain.memo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.domain.memo.entity.Memo;
import com.finalcall.domain.memo.entity.MemoCursor;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 메모 리포지토리 슬라이스 테스트(memo). member 슬라이스 컨벤션을 따른다.
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 써야
 * Flyway V20 DDL·TINYINT(sender_gender) 매핑·id DESC keyset 커서·user FK 가 실제로 검증된다. @DataJpaTest 는 기본
 * {@code @Transactional} → 각 테스트 롤백.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class MemoRepositorySliceTest {

    @Autowired
    private MemoRepository memoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager em;

    private Long senderId;
    private Long receiverId;
    private Long otherId;

    @BeforeEach
    void setUp() {
        senderId = userRepository.save(user("sender", "발신자")).getId();
        receiverId = userRepository.save(user("receiver", "수신자")).getId();
        otherId = userRepository.save(user("other", "제삼자")).getId();
        em.flush();
    }

    @Test
    void 저장시_public_id_생성시각_성별_스냅샷이_기록된다() {
        Memo saved = memoRepository.save(memo(senderId, receiverId, "안녕하세요 거래 문의합니다"));
        em.flush();

        assertThat(saved.getPublicId()).hasSize(26);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getMemoType()).isEqualTo(Memo.TYPE_USER);
        assertThat(saved.getSenderLevel()).isEqualTo(1);
        assertThat(saved.getSenderGender()).isZero(); // TINYINT 매핑 검증
        assertThat(saved.isRead()).isFalse();
        assertThat(saved.isDeleted()).isFalse();
    }

    @Test
    void 받은함_커서는_삭제와_타수신자를_제외하고_id_desc로_반환한다() {
        Memo first = memoRepository.save(memo(senderId, receiverId, "첫번째"));
        Memo second = memoRepository.save(memo(senderId, receiverId, "두번째"));
        Memo removed = memoRepository.save(memo(senderId, receiverId, "삭제됨"));
        removed.delete(java.time.Instant.now());
        memoRepository.save(memo(senderId, otherId, "타수신자")); // 다른 수신자 → 제외
        em.flush();
        em.clear();

        List<Memo> result = memoRepository.findReceivedByCursor(receiverId, MemoCursor.first(), 10);

        assertThat(result).extracting(Memo::getId)
            .containsExactly(second.getId(), first.getId()); // id DESC, 삭제·타수신자 제외
    }

    @Test
    void 미열람_개수는_수신_미삭제_미열람만_센다() {
        memoRepository.save(memo(senderId, receiverId, "미열람1"));
        Memo read = memoRepository.save(memo(senderId, receiverId, "열람됨"));
        read.markRead(java.time.Instant.now());
        Memo removed = memoRepository.save(memo(senderId, receiverId, "삭제됨"));
        removed.delete(java.time.Instant.now());
        memoRepository.save(memo(senderId, otherId, "타수신자"));
        em.flush();

        assertThat(memoRepository.countByReceiverIdAndIsDeletedFalseAndIsReadFalse(receiverId)).isEqualTo(1L);
    }

    private Memo memo(Long fromId, Long toId, String body) {
        return Memo.builder()
            .senderId(fromId)
            .senderNickname("발신자")
            .senderLevel(1)
            .senderGender(0)
            .receiverId(toId)
            .receiverNickname("수신자")
            .memoType(Memo.TYPE_USER)
            .body(body)
            .build();
    }

    private User user(String loginId, String nickname) {
        return User.builder()
            .loginId(loginId)
            .passwordHash("hash")
            .nickname(nickname)
            .build();
    }
}
