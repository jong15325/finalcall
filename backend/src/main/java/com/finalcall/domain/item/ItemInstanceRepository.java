package com.finalcall.domain.item;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 아이템 인스턴스 리포지토리(item, FC-021). 상세·인벤토리 fetch join 은 {@link ItemInstanceRepositoryCustom}(QueryDSL).
 */
public interface ItemInstanceRepository
    extends JpaRepository<ItemInstance, Long>, ItemInstanceRepositoryCustom {

    /** public_id 로 managed 인스턴스 조회(relocate 등 상태 변경 경로 — dirty checking 대상). */
    Optional<ItemInstance> findByPublicId(String publicId);

    /** 소유자의 특정 위치 아이템 수(인벤토리 사용량 계산 등). owner.id 로 해석된다. */
    long countByOwnerIdAndLocation(Long ownerId, ItemLocation location);

    /** 소유자의 특정 슬롯 점유 여부(명시 slotNo relocate 선검사). owner.id 로 해석된다. */
    boolean existsByOwnerIdAndLocationAndSlotNo(Long ownerId, ItemLocation location, Integer slotNo);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default ItemInstance findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
