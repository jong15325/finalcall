package com.finalcall.domain.item.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.member.entity.User;

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
    @Query("UPDATE ItemInstance i SET i.location = com.finalcall.domain.item.entity.ItemLocation.LISTED, "
        + "i.slotNo = null "
        + "WHERE i.id = :id AND i.location = com.finalcall.domain.item.entity.ItemLocation.INVENTORY")
    int markListedIfInInventory(@Param("id") Long id);

    /**
     * 낙찰 소유 이전(LISTED→INVENTORY) 조건부 CAS(closing-domain-spec §4.4). 소유자를 낙찰자로 바꾸고 정규 슬롯에
     * 배치한다. {@code WHERE location='LISTED'} 로 <b>단일 승자</b>를 DB 가 보증한다(중복 이전 차단).
     *
     * <p>{@link InventoryService#releaseFromListing}(소유자 불변 반환)과 방향이 다르다 — 낙찰은 소유자가 바뀐다.
     * SOLD TX 는 잔액 조건부 UPDATE 가 영속성 컨텍스트를 clear 한 뒤 실행되므로 dirty-checking 이 아니라 이 CAS 로
     * 전이한다(§4.2). 슬롯 유일성의 최종 방어선은 DB {@code slot_key} UK 다. 영향행 0 = 대상이 LISTED 가 아님
     * (이미 이전됨) = 불변식 위반이라 호출 측이 롤백한다.
     *
     * @param owner  낙찰자(신규 소유자)
     * @param slotNo 배정 슬롯 번호(0~95)
     * @return 영향 행 수(1=이전 성공, 0=대상이 LISTED 가 아님)
     */
    @Modifying
    @Query("UPDATE ItemInstance i SET i.owner = :owner, "
        + "i.location = com.finalcall.domain.item.entity.ItemLocation.INVENTORY, i.slotNo = :slotNo "
        + "WHERE i.id = :id AND i.location = com.finalcall.domain.item.entity.ItemLocation.LISTED")
    int transferListedToInventory(@Param("id") Long id, @Param("owner") User owner, @Param("slotNo") int slotNo);

    /**
     * 낙찰 소유 이전(LISTED→TEMP) 조건부 CAS(closing-domain-spec §4.4) — 낙찰자 인벤토리 만실 시 오버플로우 경로.
     * 소유자를 낙찰자로 바꾸고 임시보관으로 옮긴다({@code slot_no} 해제). 연계 {@code temp_storage} 행 생성은
     * 호출 측이 동일 TX 로 처리한다({@link InventoryService}).
     *
     * @param owner 낙찰자(신규 소유자)
     * @return 영향 행 수(1=이전 성공, 0=대상이 LISTED 가 아님)
     */
    @Modifying
    @Query("UPDATE ItemInstance i SET i.owner = :owner, "
        + "i.location = com.finalcall.domain.item.entity.ItemLocation.TEMP, i.slotNo = null "
        + "WHERE i.id = :id AND i.location = com.finalcall.domain.item.entity.ItemLocation.LISTED")
    int transferListedToTemp(@Param("id") Long id, @Param("owner") User owner);

    /**
     * 배송 APPLIED 관측 소유 이동(INVENTORY/TEMP→IN_GAME) 조건부 CAS(delivery-domain-spec §5.4·§6.1·§9.2, FC-188).
     *
     * <p>웹 reconciler 가 게임 apply 성공(배송 APPLIED)을 관측해 finalcall {@code item_instance} 를 "게임 이관됨"
     * 으로 전이시킨다 — 소유 정본은 웹이며 게임은 {@code item_instance} 를 쓰지 않는다(쓰기 소유자 규칙 §5.4).
     * {@code WHERE location IN ('INVENTORY','TEMP')} 로 <b>단일 승자</b>를 DB 가 보증한다(동시 reconcile·이미 이관됨은
     * 0행 → 멱등 skip). 전이 시 {@code slot_no} 를 NULL 로 해제한다(IN_GAME XOR: slot_no NULL·temp_storage 없음·
     * 활성 리스팅 없음, spec §3.1). 연계 {@code temp_storage} 행 삭제는 호출 측(reconciler)이 동일 TX 로 처리한다.
     * LISTED 는 대상이 아니라 자동 배제된다(APPLIED 시점 아이템은 구매자 커스터디 INVENTORY/TEMP 이며, 미완료 배송
     * 재판매 가드가 그 창의 재출품을 막아 LISTED 로 새지 않는다).
     *
     * @return 영향 행 수(1=이관 성공, 0=대상이 커스터디가 아님 = 이미 IN_GAME/동시 선점 패자)
     */
    @Modifying
    @Query("UPDATE ItemInstance i SET i.location = com.finalcall.domain.item.entity.ItemLocation.IN_GAME, "
        + "i.slotNo = null "
        + "WHERE i.id = :id AND i.location IN (com.finalcall.domain.item.entity.ItemLocation.INVENTORY, "
        + "com.finalcall.domain.item.entity.ItemLocation.TEMP)")
    int markInGameIfInCustody(@Param("id") Long id);

    /** 소유자의 특정 위치 아이템 수(인벤토리 사용량 계산 등). owner.id 로 해석된다. */
    long countByOwnerIdAndLocation(Long ownerId, ItemLocation location);

    /** 소유자의 특정 슬롯 점유 여부(명시 slotNo relocate 선검사). owner.id 로 해석된다. */
    boolean existsByOwnerIdAndLocationAndSlotNo(Long ownerId, ItemLocation location, Integer slotNo);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default ItemInstance findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
