package com.finalcall.domain.item.dto;

import com.finalcall.domain.item.entity.SkillDefinition;

import lombok.Builder;

/**
 * 스킬 슬롯 응답(item) — 코드 + 표시명(spec §5.2·§5.3 요약 공용 기반). 슬롯이 비었으면 상위에서 null 로 둔다.
 */
@Builder
public record ItemSkillResponse(int skillCode, String name) {

    /** 슬롯이 비어 있으면(null) null 을 반환한다. */
    public static ItemSkillResponse from(SkillDefinition skill) {
        if (skill == null) {
            return null;
        }
        return ItemSkillResponse.builder()
            .skillCode(skill.getSkillCode())
            .name(skill.getName())
            .build();
    }
}
