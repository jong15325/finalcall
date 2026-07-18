package com.finalcall.domain.item;

import java.util.List;
import java.util.Optional;

/**
 * 아이템 인스턴스 커스텀 쿼리 계약(item, QueryDSL 구현은 {@link ItemInstanceRepositoryImpl}).
 * 상세·인벤토리 응답은 템플릿·스킬을 함께 노출하므로 to-one fetch join 으로 N+1 을 제거한다.
 */
public interface ItemInstanceRepositoryCustom {

    /** 상세(계약 §4.1 GET /items/{id}) — 템플릿·스킬1/2·소유자를 fetch join 해 표현 계층 lazy 접근을 없앤다. */
    Optional<ItemInstance> findDetailByPublicId(String publicId);

    /** 정규 인벤토리 목록(계약 §4.2 GET /me/inventory) — owner=INVENTORY, slotNo asc, 템플릿·스킬 fetch join. */
    List<ItemInstance> findInventory(Long ownerId);

    /** 소유자의 INVENTORY 점유 슬롯 번호 목록(자동배정 빈 슬롯 탐색용, 경량 projection). */
    List<Integer> findOccupiedSlotNos(Long ownerId);
}
