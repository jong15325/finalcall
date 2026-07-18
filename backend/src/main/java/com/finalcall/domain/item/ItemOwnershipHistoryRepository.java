package com.finalcall.domain.item;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 소유 이전 이력 리포지토리(item, FC-021) — append-only 원장. EPIC-ITEM 에선 시드(V9) 트리거로만 행이 쌓인다.
 */
public interface ItemOwnershipHistoryRepository extends JpaRepository<ItemOwnershipHistory, Long> {

    /** 인스턴스 소유 체인 조회(최초=첫 행). erd §5 인덱스 (instance_id, transferred_at) 정합. */
    List<ItemOwnershipHistory> findByInstanceIdOrderByTransferredAtAsc(Long instanceId);
}
