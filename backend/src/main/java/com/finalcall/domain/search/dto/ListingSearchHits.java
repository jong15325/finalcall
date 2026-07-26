package com.finalcall.domain.search.dto;

import java.util.List;

/**
 * 검색 매칭 결과(search, EPIC-SEARCH). ES 는 <b>매칭·랭킹·커서만</b> 담당하고 표시 데이터는 호출 측이 MySQL(정본)에서
 * 하이드레이션한다(search-spec §12.8 "정확값은 DB"). 그래서 여기 담기는 것은 순서가 보장된 리스팅 public_id 목록과
 * 다음 커서뿐이다 — 목록 응답 DTO 는 이 순서대로 DB 조회 결과를 재배열해 만든다.
 *
 * <p>응답에 직렬화되지 않는 <b>서비스 간 내부 계약</b>이라 웹 표현 접미사(Response) 대신 ES 매칭 히트를 뜻하는
 * {@code Hits}로 명명한다(V2 §9.7 — auction·shop·search 등 비 bid·settlement feature의 {@code Result} 접미사 폐지).
 *
 * @param publicIds  관련도(_score desc, publicId asc) 순으로 정렬된 리스팅 public_id
 * @param nextCursor 다음 페이지 커서(opaque), 없으면 null
 * @param hasNext    다음 페이지 존재 여부
 */
public record ListingSearchHits(List<String> publicIds, String nextCursor, boolean hasNext) {
}
