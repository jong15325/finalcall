package com.finalcall.domain.item.entity;

/**
 * 카탈로그 검색 필터(item, FC-020) — 계약 §4.1 / spec §5.1 화이트리스트.
 *
 * <p>모든 축은 optional(null 이면 조건 제외)이다. 등급 축은 없다(D-073). 스킬 필터는 마스터 템플릿에 스킬
 * 데이터가 없어 대상이 아니다(스킬은 인스턴스 슬롯 개념 — spec §5.1·계약 §4.1).
 *
 * @param mainCategory 대분류(천의 자리), null 이면 제외
 * @param subGroup     중분류(백의 자리), null 이면 제외
 * @param element      속성(십의 자리), null 이면 제외
 * @param kind         종류(일의 자리), null 이면 제외
 */
public record ItemTemplateSearchCondition(
    Integer mainCategory,
    Integer subGroup,
    Integer element,
    Integer kind) {
}
