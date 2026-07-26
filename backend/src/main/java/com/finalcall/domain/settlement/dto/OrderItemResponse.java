package com.finalcall.domain.settlement.dto;

import java.time.Instant;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemTemplate;

import lombok.Builder;

/**
 * 거래내역의 item 표시 블록(order, purchase-spec §5.2 — 계약 §3.3 item 블록 규약 재사용). sale_order 는 auction 을
 * 직결하지 않으므로(source_id 폴리모픽) 스냅샷 대신 <b>item_instance + template live join</b>에서 구성한다 —
 * 거래 시점 명칭 스냅샷은 코어 미노출이며, 표시명은 템플릿 {@code displayName} 으로 대신한다(읽기 전용).
 *
 * <p>{@code skill1}/{@code skill2}는 스킬 코드(skill_definition.skill_code)이며 슬롯이 비면 null 이다.
 */
@Builder
public record OrderItemResponse(
    int typeCode,
    int mainCategory,
    int subGroup,
    int element,
    int kind,
    int level,
    Integer skill1,
    Integer skill2,
    int skillPercent,
    Instant goldforceExpireAt,
    String displayName) {

    /** item·template·skill 은 fetch join 으로 초기화된 상태여야 한다(OSIV off — 리포지토리 쿼리가 보장). */
    public static OrderItemResponse from(ItemInstance item) {
        ItemTemplate template = item.getTemplate();
        return OrderItemResponse.builder()
            .typeCode(template.getTypeCode())
            .mainCategory(template.getMainCategory())
            .subGroup(template.getSubGroup())
            .element(template.getElement())
            .kind(template.getKind())
            .level(item.getLevel())
            .skill1(item.getSkill1() == null ? null : item.getSkill1().getSkillCode())
            .skill2(item.getSkill2() == null ? null : item.getSkill2().getSkillCode())
            .skillPercent(item.getSkillPercent())
            .goldforceExpireAt(item.getGfExpireAt())
            .displayName(template.getDisplayName())
            .build();
    }
}
