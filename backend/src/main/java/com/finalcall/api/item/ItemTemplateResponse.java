package com.finalcall.api.item;

import com.finalcall.domain.item.ItemTemplate;

import lombok.Builder;

/**
 * 아이템 템플릿(카탈로그) 응답(item, FC-020) — 계약 §4.1 / spec §5.1.
 *
 * <p>content 항목 = 축(대분류·중분류·속성·종류) + 표시명 + 외부 식별자 typeCode. 소유·마스킹 없음(마스터 데이터).
 */
@Builder
public record ItemTemplateResponse(
    int typeCode,
    int mainCategory,
    int subGroup,
    int element,
    int kind,
    String displayName) {

    public static ItemTemplateResponse from(ItemTemplate template) {
        return ItemTemplateResponse.builder()
            .typeCode(template.getTypeCode())
            .mainCategory(template.getMainCategory())
            .subGroup(template.getSubGroup())
            .element(template.getElement())
            .kind(template.getKind())
            .displayName(template.getDisplayName())
            .build();
    }
}
