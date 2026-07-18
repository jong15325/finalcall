package com.finalcall.domain.item;

import static com.finalcall.domain.item.QItemInstance.itemInstance;
import static com.finalcall.domain.item.QTempStorage.tempStorage;

import java.time.Instant;
import java.util.List;

import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 임시보관 커서 조회 QueryDSL 구현(item, FC-022).
 *
 * <p>정렬 {@code (stored_at desc, instance_id desc)}는 erd v0.9 인덱스 {@code (owner_id, stored_at, instance_id)}가
 * 커버한다(G3). 인스턴스·템플릿·스킬을 fetch join 해 표현 계층 lazy 접근을 없앤다(OSIV off).
 */
@RequiredArgsConstructor
public class TempStorageRepositoryImpl implements TempStorageRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<TempStorage> findByCursor(Long ownerId, Instant cursorStoredAt, Long cursorInstanceId, int size) {
        return queryFactory.selectFrom(tempStorage)
            .join(tempStorage.instance, itemInstance).fetchJoin()
            .join(itemInstance.template).fetchJoin()
            .leftJoin(itemInstance.skill1).fetchJoin()
            .leftJoin(itemInstance.skill2).fetchJoin()
            .where(
                tempStorage.ownerId.eq(ownerId),
                cursorPredicate(cursorStoredAt, cursorInstanceId))
            .orderBy(tempStorage.storedAt.desc(), itemInstance.id.desc())
            .limit(size + 1L) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    /** 커서 이후(더 과거·동시각이면 더 작은 instance_id) 조건. 첫 페이지(커서 null)면 조건 제외. */
    private BooleanExpression cursorPredicate(Instant cursorStoredAt, Long cursorInstanceId) {
        if (cursorStoredAt == null || cursorInstanceId == null) {
            return null;
        }
        return tempStorage.storedAt.lt(cursorStoredAt)
            .or(tempStorage.storedAt.eq(cursorStoredAt).and(itemInstance.id.lt(cursorInstanceId)));
    }
}
