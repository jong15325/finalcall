package com.finalcall.domain.item;

import static com.finalcall.domain.item.QItemInstance.itemInstance;

import java.util.List;
import java.util.Optional;

import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 인스턴스 커스텀 쿼리 QueryDSL 구현(item, FC-021).
 *
 * <p>상세·인벤토리는 to-one(template·skill1·skill2·owner) fetch join 으로 조회한다 — 표현 계층(컨트롤러)에서
 * lazy 접근이 없도록(OSIV off) 트랜잭션 안에서 필요한 연관을 모두 초기화한다.
 */
@RequiredArgsConstructor
public class ItemInstanceRepositoryImpl implements ItemInstanceRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<ItemInstance> findDetailByPublicId(String publicId) {
        ItemInstance result = queryFactory.selectFrom(itemInstance)
            .join(itemInstance.template).fetchJoin()
            .join(itemInstance.owner).fetchJoin()
            .leftJoin(itemInstance.skill1).fetchJoin()
            .leftJoin(itemInstance.skill2).fetchJoin()
            .where(itemInstance.publicId.eq(publicId))
            .fetchOne();
        return Optional.ofNullable(result);
    }

    @Override
    public List<ItemInstance> findInventory(Long ownerId) {
        return queryFactory.selectFrom(itemInstance)
            .join(itemInstance.template).fetchJoin()
            .leftJoin(itemInstance.skill1).fetchJoin()
            .leftJoin(itemInstance.skill2).fetchJoin()
            .where(
                itemInstance.owner.id.eq(ownerId),
                itemInstance.location.eq(ItemLocation.INVENTORY))
            .orderBy(itemInstance.slotNo.asc())
            .fetch();
    }

    @Override
    public List<Integer> findOccupiedSlotNos(Long ownerId) {
        return queryFactory.select(itemInstance.slotNo)
            .from(itemInstance)
            .where(
                itemInstance.owner.id.eq(ownerId),
                itemInstance.location.eq(ItemLocation.INVENTORY))
            .fetch();
    }
}
