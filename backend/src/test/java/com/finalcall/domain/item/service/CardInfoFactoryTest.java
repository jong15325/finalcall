package com.finalcall.domain.item.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.item.dto.CardInfoResponse;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.SkillDefinition;

class CardInfoFactoryTest {

    private static final Instant NOW = Instant.parse("2026-08-23T00:00:00Z");

    private final CardInfoFactory factory = new CardInfoFactory(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void 바람_칼의_통용명과_채널을_계산한다() {
        ItemInstance item = item(weapon(4, 3), 9, null, null, 0, null);

        CardInfoResponse result = factory.create(item, factory.now());

        assertThat(result.shortName()).isEqualTo("Lv.9 바검");
        assertThat(result.formalName()).isEqualTo("9레벨 칼");
        assertThat(result.category().label()).isEqualTo("무기");
        assertThat(result.channelLimit()).isEqualTo(
            new CardInfoResponse.ChannelLimit("EXPERT", "고수채널 이상"));
        assertThat(result.frame()).isEqualTo(new CardInfoResponse.Frame("BLACK", "블랙", 0));
        assertThat(result.validUntil()).isNull();
    }

    @Test
    void 일반_마법과_스페셜필의_약어를_구분한다() {
        CardInfoResponse normal = factory.create(item(magic(2, 1), 4, null, null, 0, null), NOW);
        CardInfoResponse special = factory.create(item(magic(2, 2), 4, null, null, 0, null), NOW);

        assertThat(normal.shortName()).isEqualTo("Lv.4 불필");
        assertThat(special.shortName()).isEqualTo("Lv.4 불스필");
        assertThat(special.formalName()).isEqualTo("4레벨 스페셜필");
    }

    @Test
    void 골드포스는_올림하고_999일로_제한하며_다음_경계를_계산한다() {
        Instant expireAt = NOW.plusSeconds(1_200L * 86_400L);

        CardInfoResponse result = factory.create(item(weapon(1, 1), 5, null, null, 0, expireAt), NOW);

        assertThat(result.frame()).isEqualTo(new CardInfoResponse.Frame("GOLD", "골드", 999));
        assertThat(result.validUntil()).isEqualTo(expireAt.minusSeconds(998L * 86_400L));
    }

    @Test
    void 골드포스_만료_직전은_1일이고_만료시각부터_블랙이다() {
        Instant expireAt = NOW.plusSeconds(1);

        CardInfoResponse active = factory.create(item(weapon(1, 1), 4, null, null, 0, expireAt), NOW);
        CardInfoResponse expired = factory.create(item(weapon(1, 1), 4, null, null, 0, expireAt), expireAt);

        assertThat(active.frame().remainingGoldforceDays()).isEqualTo(1);
        assertThat(active.validUntil()).isEqualTo(expireAt);
        assertThat(expired.frame()).isEqualTo(new CardInfoResponse.Frame("BLACK", "블랙", 0));
        assertThat(expired.validUntil()).isNull();
    }

    @Test
    void 하루를_나노초라도_넘으면_2일로_올림한다() {
        Instant expireAt = NOW.plusSeconds(86_400).plusNanos(1);

        CardInfoResponse result = factory.create(item(weapon(1, 1), 4, null, null, 0, expireAt), NOW);

        assertThat(result.frame().remainingGoldforceDays()).isEqualTo(2);
        assertThat(result.validUntil()).isEqualTo(expireAt.minusSeconds(86_400));
    }

    @Test
    void 스킬은_항상_두_슬롯이며_확률은_두번째_스킬에만_표시한다() {
        SkillDefinition skill1 = SkillDefinition.builder().skillCode(100).name("첫 스킬").build();
        SkillDefinition skill2 = SkillDefinition.builder().skillCode(200).name("두번째 스킬").build();

        CardInfoResponse result = factory.create(item(weapon(1, 1), 6, skill1, skill2, 23, null), NOW);

        assertThat(result.skills()).containsExactly(
            new CardInfoResponse.Skill(1, 100, "첫 스킬", null),
            new CardInfoResponse.Skill(2, 200, "두번째 스킬", 23));
    }

    private ItemTemplate weapon(int element, int kind) {
        return template(1, element, kind);
    }

    private ItemTemplate magic(int element, int kind) {
        return template(3, element, kind);
    }

    private ItemTemplate template(int subGroup, int element, int kind) {
        return ItemTemplate.builder()
            .mainCategory(1)
            .subGroup(subGroup)
            .element(element)
            .kind(kind)
            .typeCode(1_000 + subGroup * 100 + element * 10 + kind)
            .displayName("테스트")
            .build();
    }

    private ItemInstance item(ItemTemplate template, int level, SkillDefinition skill1, SkillDefinition skill2,
        int skillPercent, Instant expireAt) {
        return ItemInstance.builder()
            .template(template)
            .level(level)
            .skill1(skill1)
            .skill2(skill2)
            .skillPercent(skillPercent)
            .gfExpireAt(expireAt)
            .build();
    }
}
