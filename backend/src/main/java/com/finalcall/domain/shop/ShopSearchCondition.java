package com.finalcall.domain.shop;

/**
 * 고정가 목록 검색 조건(shop, 계약 §3.2 GET /shops). 아이템 분류·레벨·가격 필터 + 상태 + 정렬 화이트리스트.
 * 필터 값은 전부 nullable(미지정=미필터)이며, 정렬/방향은 컨트롤러가 화이트리스트로 해석해 넘긴다.
 *
 * @param mainCategory 대분류(item_template) 필터
 * @param subGroup     세부군 필터
 * @param element      속성 필터
 * @param kind         종류 필터
 * @param minLevel     최소 레벨(이상)
 * @param maxLevel     최대 레벨(이하)
 * @param minPrice     최소 가격(이상)
 * @param maxPrice     최대 가격(이하)
 * @param status       상태 필터(null=진행 중 ACTIVE 기본 노출, 지정=해당 상태만)
 * @param sort         정렬 필드(화이트리스트)
 * @param ascending    오름차순 여부(false=내림차순)
 */
public record ShopSearchCondition(
    Integer mainCategory,
    Integer subGroup,
    Integer element,
    Integer kind,
    Integer minLevel,
    Integer maxLevel,
    Long minPrice,
    Long maxPrice,
    ShopStatus status,
    ShopSort sort,
    boolean ascending) {
}
