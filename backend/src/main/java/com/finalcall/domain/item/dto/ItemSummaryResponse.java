package com.finalcall.domain.item.dto;

import java.time.Instant;

import com.finalcall.domain.item.entity.ItemInstance;

import lombok.Builder;

/**
 * 아이템 요약(item, FC-022) — 인벤토리·임시보관 공용 요약(spec §5.3).
 *
 * <p>{@code skill1Code}/{@code skill2Code}는 스킬 코드(skill_definition.skill_code)이며 슬롯이 비면 null 이다.
 * {@code skill1Name}/{@code skill2Name}은 그 코드의 스킬명(skill_definition.name)으로 코드에 부가된다
 * (계약 §3.3 가법 델타, FC-179). 슬롯이 비면 각각 null 이다(마법 카드는 skill1 부재라 skill1Name=null).
 * 인벤토리·임시보관 쿼리가 skill_definition 을 이미 fetch join 하고 코드 노출에서 {@code getSkill1()}을 이미
 * 참조하므로 {@code getName()} 추가에 N+1·추가 조인이 없다(AuctionItemResponse 패턴 이식).
 */
@Builder
public record ItemSummaryResponse(
    int typeCode,
    String displayName,
    int level,
    Integer skill1Code,
    Integer skill2Code,
    String skill1Name,
    String skill2Name,
    int skillPercent,
    Instant goldforceExpireAt,
    CardInfoResponse cardInfo) {

    public static ItemSummaryResponse from(ItemInstance instance, CardInfoResponse cardInfo) {
        return ItemSummaryResponse.builder()
            .typeCode(instance.getTemplate().getTypeCode())
            .displayName(instance.getTemplate().getDisplayName())
            .level(instance.getLevel())
            .skill1Code(instance.getSkill1() == null ? null : instance.getSkill1().getSkillCode())
            .skill2Code(instance.getSkill2() == null ? null : instance.getSkill2().getSkillCode())
            .skill1Name(instance.getSkill1() == null ? null : instance.getSkill1().getName())
            .skill2Name(instance.getSkill2() == null ? null : instance.getSkill2().getName())
            .skillPercent(instance.getSkillPercent())
            .goldforceExpireAt(instance.getGfExpireAt())
            .cardInfo(cardInfo)
            .build();
    }
}
