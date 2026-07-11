package com.finalcall.domain.notice;

import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 공지 리포지토리 슬라이스 테스트(Stage F2).
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 쓴다.
 * (없으면 H2 로 바뀌어 MySQL 문법·Flyway 검증이 무의미해지는 핵심 함정.)
 * QueryDSL 커스텀 조회(삭제 제외)와 시각 Auditing 자동 기록을 검증한다.
 * @DataJpaTest 는 기본 @Transactional → 각 테스트 종료 시 롤백.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class NoticeRepositorySliceTest {

    @Autowired
    private NoticeRepository noticeRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 저장시_생성수정시각이_자동기록된다() {
        Notice saved = noticeRepository.save(notice("제목", NoticeType.GENERAL));
        em.flush();

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void QueryDSL_커서조회는_삭제된_공지를_제외한다() {
        Notice keep = noticeRepository.save(notice("살아있음", NoticeType.EVENT));
        Notice removed = noticeRepository.save(notice("삭제됨", NoticeType.URGENT));
        removed.delete();
        em.flush();
        em.clear();

        List<Notice> result = noticeRepository.findActiveByCursor(null, 10);

        assertThat(result).extracting(Notice::getId).contains(keep.getId());
        assertThat(result).extracting(Notice::getId).doesNotContain(removed.getId());
    }

    private Notice notice(String title, NoticeType type) {
        return Notice.builder().title(title).content("내용").type(type).build();
    }
}
