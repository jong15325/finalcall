package com.finalcall.domain.item;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 아이템 인스턴스 리포지토리(item, FC-021). 상세·인벤토리 fetch join 은 {@link ItemInstanceRepositoryCustom}(QueryDSL).
 */
public interface ItemInstanceRepository
    extends JpaRepository<ItemInstance, Long>, ItemInstanceRepositoryCustom {

    /** public_id 로 managed 인스턴스 조회(relocate 등 상태 변경 경로 — dirty checking 대상). */
    Optional<ItemInstance> findByPublicId(String publicId);

    /**
     * 출품 에스크로 선점(INVENTORY→LISTED) 조건부 CAS(auction-domain-spec §4.1 G4, FC-026).
     *
     * <p>{@code WHERE location='INVENTORY'} 조건으로 <b>단일 승자</b>를 DB가 보증한다 — 두 트랜잭션이 같은
     * INVENTORY 아이템을 동시에 출품해도 하나만 영향행 1을 얻고 나머지는 0이다(중복 출품 차단, erd §5). 영향행이
     * 0이면 호출 측이 원인을 분기한다(이미 LISTED → AUCTION_002 / TEMP·미보유 → AUCTION_001). dirty-checking
     * 대신 이 CAS 만을 출품 전이 경로로 쓴다. slot_no 는 LISTED 규약상 NULL 로 해제한다.
     *
     * @return 영향 행 수(1=선점 성공, 0=실패)
     */
    @Modifying
    @Query("UPDATE ItemInstance i SET i.location = com.finalcall.domain.item.ItemLocation.LISTED, i.slotNo = null "
        + "WHERE i.id = :id AND i.location = com.finalcall.domain.item.ItemLocation.INVENTORY")
    int markListedIfInInventory(@Param("id") Long id);

    /** 소유자의 특정 위치 아이템 수(인벤토리 사용량 계산 등). owner.id 로 해석된다. */
    long countByOwnerIdAndLocation(Long ownerId, ItemLocation location);

    /** 소유자의 특정 슬롯 점유 여부(명시 slotNo relocate 선검사). owner.id 로 해석된다. */
    boolean existsByOwnerIdAndLocationAndSlotNo(Long ownerId, ItemLocation location, Integer slotNo);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default ItemInstance findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
