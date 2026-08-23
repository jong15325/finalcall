package com.finalcall.domain.item.dto;

import java.time.Instant;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;

import lombok.Builder;

/**
 * 아이템 인스턴스 상세 응답(item, FC-021) — 계약 §4.1 / spec §5.2.
 *
 * <p>공개 필드 + 소유자 전용 필드 이원화: {@code slotNo}는 요청 주체가 소유자이고 위치가 INVENTORY 일 때만 싣는다
 * (그 외 null — 소유자 사생활·인벤토리 배치 노출 방지). 소유자 nickname 은 마스킹하고 소유자 public_id 는 노출하지
 * 않는다. {@code location}은 enum 3값 그대로 노출한다.
 */
@Builder
public record ItemInstanceDetailResponse(
    String itemInstancePublicId,
    ItemTemplateResponse template,
    int level,
    ItemSkillResponse skill1,
    ItemSkillResponse skill2,
    int skillPercent,
    Instant goldforceExpireAt,
    CardInfoResponse cardInfo,
    ItemLocation location,
    String ownerMasked,
    Integer slotNo) {

    /**
     * 상세 응답을 만든다. 소유 여부({@code viewerIsOwner})는 서비스가 SecurityContext 주체로 판정해 넘긴다
     * (IDOR 방지 — spec §5.2). 비인증 조회는 {@code viewerIsOwner=false}로 공개 필드만 노출한다.
     */
    public static ItemInstanceDetailResponse from(
        ItemInstance instance, boolean viewerIsOwner, CardInfoResponse cardInfo) {
        boolean showSlot = viewerIsOwner && instance.getLocation() == ItemLocation.INVENTORY;
        return ItemInstanceDetailResponse.builder()
            .itemInstancePublicId(instance.getPublicId())
            .template(ItemTemplateResponse.from(instance.getTemplate()))
            .level(instance.getLevel())
            .skill1(ItemSkillResponse.from(instance.getSkill1()))
            .skill2(ItemSkillResponse.from(instance.getSkill2()))
            .skillPercent(instance.getSkillPercent())
            .goldforceExpireAt(instance.getGfExpireAt())
            .cardInfo(cardInfo)
            .location(instance.getLocation())
            .ownerMasked(mask(instance.getOwner().getNickname()))
            .slotNo(showSlot ? instance.getSlotNo() : null)
            .build();
    }

    /** 소유자 nickname 마스킹 — 앞 2자 + {@code ***}(1자 닉은 1자 + ***). 소유자 식별 노출 최소화(SEC-007 연장). */
    private static String mask(String nickname) {
        if (nickname == null || nickname.isEmpty()) {
            return "***";
        }
        int prefixLength = Math.min(2, nickname.length());
        return nickname.substring(0, prefixLength) + "***";
    }
}
