package com.finalcall.domain.search.dto;

import java.util.List;

/**
 * 검색 결과(search, EPIC-SEARCH). ES 는 <b>매칭·랭킹·커서만</b> 담당하고 표시 데이터는 호출 측이 MySQL(정본)에서
 * 하이드레이션한다(search-spec §12.8 "정확값은 DB"). 그래서 여기 담기는 것은 순서가 보장된 리스팅 public_id 목록과
 * 다음 커서뿐이다 — 목록 응답 DTO 는 이 순서대로 DB 조회 결과를 재배열해 만든다.
 *
 * @param publicIds  관련도(_score desc, publicId asc) 순으로 정렬된 리스팅 public_id
 * @param nextCursor 다음 페이지 커서(opaque), 없으면 null
 * @param hasNext    다음 페이지 존재 여부
 */
public record ListingSearchResult(List<String> publicIds, String nextCursor, boolean hasNext) {
}
