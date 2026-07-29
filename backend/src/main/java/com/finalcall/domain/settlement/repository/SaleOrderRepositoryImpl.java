package com.finalcall.domain.settlement.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.finalcall.domain.item.entity.QItemInstance;
import com.finalcall.domain.item.entity.QItemTemplate;
import com.finalcall.domain.item.entity.QSkillDefinition;
import com.finalcall.domain.member.entity.QUser;
import com.finalcall.domain.settlement.entity.OrderRole;
import com.finalcall.domain.settlement.entity.QSaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderCursor;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 거래내역 커스텀 쿼리 QueryDSL 구현(settlement). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동
 * 결합한다.
 *
 * <p>목록·상세는 상대 마스킹(buyer·seller nickname)과 item 표시 블록(template·skill live join)을 노출하므로
 * to-one fetch join 으로 N+1 을 제거한다(OSIV off — 표현 계층 lazy 접근 없음). 목록은 keyset cursor 로 안정
 * 페이지네이션한다 — {@code (created_at, id)} tiebreaker 로 동일 생성 시각에서도 결정적 순서를 보장한다
 * ({@link com.finalcall.domain.auction.repository.AuctionRepositoryImpl} 선례).
 */
@RequiredArgsConstructor
public class SaleOrderRepositoryImpl implements SaleOrderRepositoryCustom {

    private static final QSaleOrder ORDER = QSaleOrder.saleOrder;
    private static final QItemInstance ITEM = QItemInstance.itemInstance;
    private static final QItemTemplate TEMPLATE = QItemTemplate.itemTemplate;
    private static final QSkillDefinition SKILL1 = new QSkillDefinition("orderSkill1");
    private static final QSkillDefinition SKILL2 = new QSkillDefinition("orderSkill2");
    private static final QUser BUYER = new QUser("orderBuyer");
    private static final QUser SELLER = new QUser("orderSeller");

    private final JPAQueryFactory queryFactory;

    @Override
    public List<SaleOrder> findByCursor(
        Long userId, OrderRole roleFilter, SaleOrderSourceType sourceType, SaleOrderCursor cursor, int size) {
        return queryFactory.selectFrom(ORDER)
            .join(ORDER.buyer, BUYER).fetchJoin()
            .join(ORDER.seller, SELLER).fetchJoin()
            .join(ORDER.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .where(
                partyScope(userId, roleFilter),
                sourceTypeEq(sourceType),
                keyset(cursor))
            .orderBy(ORDER.createdAt.desc(), ORDER.id.desc())
            .limit((long)size + 1) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    @Override
    public Optional<SaleOrder> findDetailByPublicId(String publicId) {
        return Optional.ofNullable(queryFactory.selectFrom(ORDER)
            .join(ORDER.buyer, BUYER).fetchJoin()
            .join(ORDER.seller, SELLER).fetchJoin()
            .join(ORDER.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .where(ORDER.publicId.eq(publicId))
            .fetchOne());
    }

    @Override
    public Map<Long, Long> countCompletedSalesBySellerIds(Collection<Long> sellerIds) {
        if (sellerIds.isEmpty()) {
            return Map.of(); // 빈 입력이면 IN () 렌더를 피해 쿼리 자체를 생략한다.
        }
        // seller_id, COUNT(*) GROUP BY seller_id — 페이지당 1쿼리. seller.id 는 FK 컬럼이라 user 조인 없이
        //   (seller_id) 인덱스만 커버한다(partyScope 의 seller.id 필터와 동일 규약).
        NumberExpression<Long> rowCount = ORDER.id.count();
        Map<Long, Long> counts = new HashMap<>();
        for (Tuple row : queryFactory.select(ORDER.seller.id, rowCount)
            .from(ORDER)
            .where(ORDER.seller.id.in(sellerIds))
            .groupBy(ORDER.seller.id)
            .fetch()) {
            counts.put(row.get(ORDER.seller.id), row.get(rowCount));
        }
        return counts;
    }

    @Override
    public long countCompletedSalesBySellerId(Long sellerId) {
        Long count = queryFactory.select(ORDER.id.count())
            .from(ORDER)
            .where(ORDER.seller.id.eq(sellerId))
            .fetchOne();
        return count == null ? 0L : count;
    }

    /**
     * IDOR 스코프(B1) — 요청자가 당사자인 주문만 노출한다. {@code roleFilter} 가 없으면 {@code buyer OR seller},
     * BUYER 면 구매분만, SELLER 면 판매분만으로 좁힌다. 인덱스 {@code sale_order (buyer_id)}·{@code (seller_id)} 커버.
     */
    private BooleanExpression partyScope(Long userId, OrderRole roleFilter) {
        if (roleFilter == OrderRole.BUYER) {
            return ORDER.buyer.id.eq(userId);
        }
        if (roleFilter == OrderRole.SELLER) {
            return ORDER.seller.id.eq(userId);
        }
        return ORDER.buyer.id.eq(userId).or(ORDER.seller.id.eq(userId));
    }

    private BooleanExpression sourceTypeEq(SaleOrderSourceType sourceType) {
        return sourceType == null ? null : ORDER.sourceType.eq(sourceType);
    }

    /** keyset cursor 경계 — {@code created_at desc, id desc} 정렬과 정확히 일치한다(어긋나면 페이징 버그). */
    private BooleanExpression keyset(SaleOrderCursor cursor) {
        if (cursor.isFirstPage()) {
            return null;
        }
        Instant createdAt = cursor.createdAt();
        Long lastId = cursor.id();
        return ORDER.createdAt.lt(createdAt)
            .or(ORDER.createdAt.eq(createdAt).and(ORDER.id.lt(lastId)));
    }
}
