package com.finalcall.domain.auction;

/**
 * 경매 목록 검색 조건(auction, 계약 §3 공통 목록 필터 + 정렬). 전부 optional 이며 null 이면 해당 필터를 적용하지 않는다.
 *
 * <p>필터 축(계약 §3): item 축은 template(mainCategory·subGroup·element·kind)·instance(level·skill·goldforce)에,
 * 가격 축(minPrice/maxPrice)은 auction.startPrice(본 에픽 현재가 대체 없음, 게이트2 b)에, status 는 auction.status
 * (영속값 기준 — lazy 파생은 표시층 전용)에 매핑한다. skill1/skill2 는 스킬 코드(skill_definition.skill_code)다.
 *
 * @param goldforceActive TRUE=골드포스 활성(gf_expire_at &gt; now)만, FALSE=비활성만, null=미필터
 * @param status          null 이면 기본 노출(SCHEDULED·ACTIVE), 값이 있으면 해당 영속 상태만(종료분 조회 허용)
 * @param sort            정렬 필드(화이트리스트), {@code ascending} 오름/내림
 */
public record AuctionSearchCondition(
    Integer mainCategory,
    Integer subGroup,
    Integer element,
    Integer kind,
    Integer minLevel,
    Integer maxLevel,
    Integer skill1,
    Integer skill2,
    Boolean goldforceActive,
    Long minPrice,
    Long maxPrice,
    AuctionStatus status,
    AuctionSort sort,
    boolean ascending) {
}
