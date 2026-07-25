package com.finalcall.domain.item.repository;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.item.entity.TempStorage;

/**
 * 임시보관 커서 조회 계약(item, FC-022, QueryDSL 구현은 {@link TempStorageRepositoryImpl}).
 */
public interface TempStorageRepositoryCustom {

    /**
     * 소유자의 임시보관 목록을 커서로 조회한다(계약 §4.2). 정렬은 {@code (stored_at desc, instance_id desc)}로
     * 안정적이며, 요약 노출을 위해 인스턴스·템플릿·스킬을 fetch join 한다. hasNext 판단을 위해 size+1 건을 조회한다.
     *
     * @param ownerId          소유자 내부 PK(주체=SecurityContext)
     * @param cursorStoredAt   커서 저장 시각(null 이면 첫 페이지)
     * @param cursorInstanceId 커서 인스턴스 PK(동시각 tie-break, null 이면 첫 페이지)
     * @param size             페이지 크기
     */
    List<TempStorage> findByCursor(Long ownerId, Instant cursorStoredAt, Long cursorInstanceId, int size);
}
