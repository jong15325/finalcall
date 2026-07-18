package com.finalcall.domain.item;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 아이템 템플릿 카탈로그 검색 슬라이스 테스트(item, FC-020).
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 쓴다.
 * 필터 격리를 위해 시드(V9)와 겹치지 않는 mainCategory=9 로 자체 템플릿을 넣고 조회한다(@DataJpaTest 는 롤백).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class ItemTemplateRepositorySliceTest {

    private static final int TEST_MAIN = 9; // 시드(main 1·2)와 겹치지 않는 격리 축

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 저장시_생성수정시각이_자동기록된다() {
        ItemTemplate saved = itemTemplateRepository.save(template(9, 1, 1, 1, 9111, "테스트검"));
        em.flush();

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void 축_필터로_카탈로그를_좁힌다() {
        itemTemplateRepository.save(template(TEST_MAIN, 1, 1, 1, 9111, "물의 검"));
        itemTemplateRepository.save(template(TEST_MAIN, 1, 2, 1, 9121, "불의 검"));
        itemTemplateRepository.save(template(TEST_MAIN, 1, 2, 2, 9122, "불의 도"));
        em.flush();
        em.clear();

        // 속성(element=2) 필터 → main=9 축에서 2건.
        Page<ItemTemplate> page = itemTemplateRepository.search(
            new ItemTemplateSearchCondition(TEST_MAIN, null, 2, null), PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(ItemTemplate::getTypeCode).containsExactly(9121, 9122);
    }

    @Test
    void 필터없으면_typeCode_asc_정렬로_전체를_페이지한다() {
        itemTemplateRepository.save(template(TEST_MAIN, 1, 2, 2, 9122, "불의 도"));
        itemTemplateRepository.save(template(TEST_MAIN, 1, 1, 1, 9111, "물의 검"));
        em.flush();
        em.clear();

        Page<ItemTemplate> page = itemTemplateRepository.search(
            new ItemTemplateSearchCondition(TEST_MAIN, null, null, null), PageRequest.of(0, 10));

        // typeCode asc 고정 정렬.
        assertThat(page.getContent()).extracting(ItemTemplate::getTypeCode).containsExactly(9111, 9122);
    }

    private ItemTemplate template(int main, int sub, int element, int kind, int typeCode, String name) {
        return ItemTemplate.builder()
            .mainCategory(main).subGroup(sub).element(element).kind(kind)
            .typeCode(typeCode).displayName(name).build();
    }
}
