package com.finalcall.domain.item;

import java.util.List;

/**
 * 임시보관 커서 조회 결과(item, 도메인 반환 타입). api 계층에서 커서 응답 DTO 로 변환한다.
 *
 * @param items      이번 페이지 임시보관 목록(인스턴스·템플릿·스킬 fetch join 됨)
 * @param nextCursor 다음 페이지 커서(opaque), 비었으면 null
 * @param hasNext    다음 페이지 존재 여부
 */
public record TempStorageSlice(List<TempStorage> items, String nextCursor, boolean hasNext) {
}
