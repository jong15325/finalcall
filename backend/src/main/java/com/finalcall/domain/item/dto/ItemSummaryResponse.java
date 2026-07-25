package com.finalcall.domain.item.dto;

import java.time.Instant;

import com.finalcall.domain.item.entity.ItemInstance;

import lombok.Builder;

/**
 * 아이템 요약(item, FC-022) — 인벤토리·임시보관 공용 요약(spec §5.3). 스킬은 코드만 노출한다(요약 경량화).
 */
@Builder
public record ItemSummaryResponse(
    int typeCode,
    String displayName,
    int level,
    Integer skill1Code,
    Integer skill2Code,
    int skillPercent,
    Instant goldforceExpireAt) {

    public static ItemSummaryResponse from(ItemInstance instance) {
        return ItemSummaryResponse.builder()
            .typeCode(instance.getTemplate().getTypeCode())
            .displayName(instance.getTemplate().getDisplayName())
            .level(instance.getLevel())
            .skill1Code(instance.getSkill1() == null ? null : instance.getSkill1().getSkillCode())
            .skill2Code(instance.getSkill2() == null ? null : instance.getSkill2().getSkillCode())
            .skillPercent(instance.getSkillPercent())
            .goldforceExpireAt(instance.getGfExpireAt())
            .build();
    }
}
