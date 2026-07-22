package com.finalcall.domain.search;

import lombok.Builder;

/**
 * {@code listings} 인덱스 문서(search, EPIC-SEARCH · search-spec §12.4). <b>파생 read-model 이며 정본은 항상 MySQL
 * 이다</b>(§12.8) — 검색·필터·정렬에 필요한 표시·탐색 축만 담고 자금·소유 실명 등 민감 필드는 색인하지 않는다(SEC-007).
 *
 * <p>문서 {@code _id} = 리스팅 {@code publicId}(멱등 upsert 키). 코드축(mainCategory/subGroup/element/kind)·skill 은
 * 범위가 아니라 정확 매칭/필터 대상이라 keyword 로 색인하므로 문자열로 담는다(§12.4, integer→keyword). 날짜
 * (gfExpireAt/endsAt/createdAt)는 ISO-8601 문자열로 담아 JsonpMapper 시간 모듈 의존 없이 ES {@code date} 로 파싱되게
 * 한다. {@code sellerGrade} 는 이번 범위 밖(EPIC-GRADE 의존, §6.1·A4) — 문서에 두지 않는다.
 *
 * <p>이 문서는 앱 화해/재색인 경로({@link ListingIndexer})가 MySQL 조인을 읽어 bulk upsert 할 때 쓴다. 주 동기 경로는
 * Debezium CDC(앱 무침습)이며, 이 문서 타입은 그 파이프라인이 못 채우는 코드축 enrichment·드리프트 보정용이다(§12.5).
 */
@Builder
public record ListingDocument(
    String listingType,
    String publicId,
    String nameSnapshot,
    String specSnapshot,
    String mainCategory,
    String subGroup,
    String element,
    String kind,
    String skill1,
    String skill2,
    Integer level,
    Long price,
    Long highestBidAmount,
    String gfExpireAt,
    String status,
    String sellerNickname,
    String endsAt,
    String createdAt) {
}
