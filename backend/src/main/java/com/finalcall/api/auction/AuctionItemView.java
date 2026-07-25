package com.finalcall.api.auction;

import java.time.Instant;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemTemplate;

import lombok.Builder;

/**
 * 경매 목록/상세의 item 표시 블록(auction, 계약 §3.3 공통 item 블록). live join(template·instance)과 auction 스냅샷을
 * 함께 싣는다(G8): {@code nameSnapshot}/{@code specSnapshot}은 등록 시점 auction 컬럼, 나머지는 현재 조인 값이다.
 *
 * <p>{@code skill1}/{@code skill2}는 스킬 코드(skill_definition.skill_code)이며 슬롯이 비면 null 이다.
 * {@code skill1Name}/{@code skill2Name}은 그 코드의 스킬명(skill_definition.name, §5 효과 서술)으로 코드에
 * 부가된다(계약 §3.3, FC-098). 슬롯이 비면 각각 null 이다(마법 카드는 skill1 부재라 skill1Name=null). 목록·상세
 * 쿼리가 skill_definition 을 이미 fetch join 하므로 {@code getName()} 추가에 N+1·추가 조인이 없다.
 */
@Builder
public record AuctionItemView(
    int typeCode,
    int mainCategory,
    int subGroup,
    int element,
    int kind,
    int level,
    Integer skill1,
    Integer skill2,
    String skill1Name,
    String skill2Name,
    int skillPercent,
    Instant goldforceExpireAt,
    String nameSnapshot,
    String specSnapshot) {

    public static AuctionItemView from(Auction auction) {
        ItemInstance item = auction.getItemInstance();
        ItemTemplate template = item.getTemplate();
        return AuctionItemView.builder()
            .typeCode(template.getTypeCode())
            .mainCategory(template.getMainCategory())
            .subGroup(template.getSubGroup())
            .element(template.getElement())
            .kind(template.getKind())
            .level(item.getLevel())
            .skill1(item.getSkill1() == null ? null : item.getSkill1().getSkillCode())
            .skill2(item.getSkill2() == null ? null : item.getSkill2().getSkillCode())
            .skill1Name(item.getSkill1() == null ? null : item.getSkill1().getName())
            .skill2Name(item.getSkill2() == null ? null : item.getSkill2().getName())
            .skillPercent(item.getSkillPercent())
            .goldforceExpireAt(item.getGfExpireAt())
            .nameSnapshot(auction.getItemNameSnapshot())
            .specSnapshot(auction.getItemSpecSnapshot())
            .build();
    }
}
