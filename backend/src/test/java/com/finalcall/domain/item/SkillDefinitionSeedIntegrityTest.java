package com.finalcall.domain.item;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

/**
 * skill_definition 마스터 시드 정합 검증(FC-098, EPIC-MARKET-DATA). Flyway V16 이 game-item-skill-format §5 를
 * 정확히 전사했는지를 코드↔효과 표본과 경계·행수로 확인한다(spec §1.3 reviewer 대조 항목의 자동 회귀 방어선).
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 H2 대체를 막고 실제 MySQL(Testcontainers)을 쓴다.
 * 마스터 시드는 전 프로파일 Flyway 적용이라 컨텍스트 로딩 시점에 이미 존재한다(읽기 전용 검증).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class SkillDefinitionSeedIntegrityTest {

    @Autowired
    private SkillDefinitionRepository skillDefinitionRepository;

    private Map<Integer, String> nameByCode() {
        Map<Integer, String> map = new HashMap<>();
        skillDefinitionRepository.findAll().forEach(s -> map.put(s.getSkillCode(), s.getName()));
        return map;
    }

    @Test
    void 인벤토리는_정확히_244행이다() {
        assertThat(skillDefinitionRepository.count()).isEqualTo(244L);
    }

    @Test
    void 경계코드가_모두_존재한다() {
        Map<Integer, String> names = nameByCode();
        // 스킬1 경계 100·197, 스킬2 경계 200·209·300·435.
        assertThat(names).containsKeys(100, 197, 200, 209, 300, 435);
    }

    @Test
    void 미사용코드는_시드에서_제외된다() {
        Map<Integer, String> names = nameByCode();
        // 198·199(스킬1 미사용) · 210~299(스킬2 미사용).
        assertThat(names).doesNotContainKeys(198, 199, 210, 250, 299);
    }

    @Test
    void 표본코드가_5절_효과서술과_일치한다() {
        Map<Integer, String> names = nameByCode();
        // V9 교정 5건(§1.4).
        assertThat(names).containsEntry(100, "공격데미지 6 증가");
        assertThat(names).containsEntry(110, "가속도 3.5 증가");
        assertThat(names).containsEntry(120, "공격데미지 3 증가");
        assertThat(names).containsEntry(130, "공격시간 2 감소");
        // §5.1 크리데미지 행 위치 매핑(140=45·141=50).
        assertThat(names).containsEntry(140, "크리데미지 45 증가");
        assertThat(names).containsEntry(141, "크리데미지 50 증가");
        // §5.1 표본.
        assertThat(names).containsEntry(119, "공격데미지 4 증가");
        assertThat(names).containsEntry(159, "가속도 5 증가");
        // 그룹 공유값(127·128·129 = 공격시간 1 감소).
        assertThat(names).containsEntry(127, "공격시간 1 감소");
        assertThat(names).containsEntry(128, "공격시간 1 감소");
        assertThat(names).containsEntry(129, "공격시간 1 감소");
        // §5.2 표본.
        assertThat(names).containsEntry(202, "트리플샷");
        assertThat(names).containsEntry(372, "가신 6초");
        assertThat(names).containsEntry(314, "회복불가 5초");
        assertThat(names).containsEntry(205, "뎀반사 60");
        assertThat(names).containsEntry(435, "마법카드불가");
    }

    @Test
    void 스킬명은_50자_이내다() {
        skillDefinitionRepository.findAll()
            .forEach(s -> assertThat(s.getName().length()).isLessThanOrEqualTo(50));
    }
}
