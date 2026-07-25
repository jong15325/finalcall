package com.finalcall.domain.shop;

import static com.finalcall.domain.shop.QShop.shop;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.finalcall.domain.item.entity.QItemInstance;
import com.finalcall.domain.item.entity.QItemTemplate;
import com.finalcall.domain.item.entity.QSkillDefinition;
import com.finalcall.domain.member.entity.QUser;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 고정가 커스텀 쿼리 QueryDSL 구현(shop). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합한다.
 *
 * <p>목록/상세는 item 표시 블록(template·skill live join)과 seller 를 to-one fetch join 으로 끌어와 표현 계층 lazy
 * 접근을 없앤다(OSIV off). 목록은 keyset cursor 로 안정 페이지네이션한다 — 정렬 필드 + id tiebreaker 로 동일 정렬값
 * 에서도 결정적 순서를 보장한다(AuctionRepositoryImpl 선례). 정렬 필드는 이 에픽에서 전부 NOT NULL 이라 nullable
 * 정렬 keyset(경매 highestBidAmount 같은)의 복잡성이 없다.
 */
@RequiredArgsConstructor
public class ShopRepositoryImpl implements ShopRepositoryCustom {

    private static final QItemInstance ITEM = QItemInstance.itemInstance;
    private static final QItemTemplate TEMPLATE = QItemTemplate.itemTemplate;
    private static final QSkillDefinition SKILL1 = new QSkillDefinition("skill1");
    private static final QSkillDefinition SKILL2 = new QSkillDefinition("skill2");
    private static final QUser SELLER = new QUser("seller");

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Shop> findDetailByPublicId(String publicId) {
        return Optional.ofNullable(queryFactory.selectFrom(shop)
            .join(shop.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(shop.seller, SELLER).fetchJoin()
            .where(shop.publicId.eq(publicId))
            .fetchOne());
    }

    @Override
    public List<Shop> findByCursor(ShopSearchCondition condition, ShopCursor cursor, int size) {
        return queryFactory.selectFrom(shop)
            .join(shop.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(shop.seller, SELLER).fetchJoin()
            .where(
                statusScope(condition),
                mainCategoryEq(condition.mainCategory()),
                subGroupEq(condition.subGroup()),
                elementEq(condition.element()),
                kindEq(condition.kind()),
                levelGoe(condition.minLevel()),
                levelLoe(condition.maxLevel()),
                priceGoe(condition.minPrice()),
                priceLoe(condition.maxPrice()),
                keyset(condition.sort(), condition.ascending(), cursor))
            .orderBy(orderBy(condition.sort(), condition.ascending()))
            .limit((long)size + 1) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    @Override
    public List<Shop> findBySellerCursor(
        Long sellerId, ShopStatus status, ShopSort sort, boolean ascending, ShopCursor cursor, int size) {
        return queryFactory.selectFrom(shop)
            .join(shop.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(shop.seller, SELLER).fetchJoin()
            .where(
                shop.seller.id.eq(sellerId), // 인증 주체 스코프(IDOR) — 인덱스 (seller_id, status) 선두
                sellerStatusEq(status),
                keyset(sort, ascending, cursor))
            .orderBy(orderBy(sort, ascending))
            .limit((long)size + 1) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    @Override
    public List<Shop> findByPublicIds(List<String> publicIds) {
        if (publicIds.isEmpty()) {
            return List.of();
        }
        return queryFactory.selectFrom(shop)
            .join(shop.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(shop.seller, SELLER).fetchJoin()
            .where(shop.publicId.in(publicIds))
            .fetch();
    }

    @Override
    public List<Shop> findAllForIndexing() {
        return queryFactory.selectFrom(shop)
            .join(shop.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(shop.seller, SELLER).fetchJoin()
            .fetch();
    }

    @Override
    public Map<ShopStatus, Long> countGroupByStatus() {
        NumberExpression<Long> rowCount = shop.id.count();
        Map<ShopStatus, Long> counts = new LinkedHashMap<>();
        for (Tuple row : queryFactory.select(shop.status, rowCount)
            .from(shop)
            .groupBy(shop.status)
            .fetch()) {
            counts.put(row.get(shop.status), row.get(rowCount));
        }
        return counts;
    }

    @Override
    public Map<Long, Long> countGroupByPriceBucket(long bucketSize) {
        // floor(price / size) = 버킷 인덱스로 그룹핑하고, 하한(index*size)은 Java 에서 곱한다. 하한 곱을 SQL 에 두면
        //   QueryDSL 이 select 는 cast(? as signed)·group by 는 ?로 달리 렌더해 only_full_group_by 에서 깨진다.
        //   price 는 ES 색인 price 원천이라 ES histogram(interval=size) 하한 키와 정합한다.
        NumberExpression<Long> bucketIndex = shop.price.divide(bucketSize).floor();
        NumberExpression<Long> rowCount = shop.id.count();
        Map<Long, Long> counts = new LinkedHashMap<>();
        for (Tuple row : queryFactory.select(bucketIndex, rowCount)
            .from(shop)
            .groupBy(bucketIndex)
            .fetch()) {
            counts.put(row.get(bucketIndex) * bucketSize, row.get(rowCount));
        }
        return counts;
    }

    /** status 미지정이면 판매 중(ACTIVE) 기본 노출, 지정이면 해당 영속 상태만(종료분 조회 허용). */
    private BooleanExpression statusScope(ShopSearchCondition condition) {
        if (condition.status() == null) {
            return shop.status.eq(ShopStatus.ACTIVE);
        }
        return shop.status.eq(condition.status());
    }

    /**
     * '내 판매' status predicate. 공개 {@link #statusScope} 와 달리 {@code null} 은 <b>ALL(무필터)</b>이다 — 기본값
     * (ACTIVE) 해석은 컨트롤러가 이미 마쳤으므로 여기 null 은 전 상태 조회 의도다(계약 §3.2 ALL 센티널).
     */
    private BooleanExpression sellerStatusEq(ShopStatus status) {
        return status == null ? null : shop.status.eq(status);
    }

    private BooleanExpression mainCategoryEq(Integer value) {
        return value == null ? null : TEMPLATE.mainCategory.eq(value);
    }

    private BooleanExpression subGroupEq(Integer value) {
        return value == null ? null : TEMPLATE.subGroup.eq(value);
    }

    private BooleanExpression elementEq(Integer value) {
        return value == null ? null : TEMPLATE.element.eq(value);
    }

    private BooleanExpression kindEq(Integer value) {
        return value == null ? null : TEMPLATE.kind.eq(value);
    }

    private BooleanExpression levelGoe(Integer value) {
        return value == null ? null : ITEM.level.goe(value);
    }

    private BooleanExpression levelLoe(Integer value) {
        return value == null ? null : ITEM.level.loe(value);
    }

    private BooleanExpression priceGoe(Long value) {
        return value == null ? null : shop.price.goe(value);
    }

    private BooleanExpression priceLoe(Long value) {
        return value == null ? null : shop.price.loe(value);
    }

    /** keyset cursor 경계 predicate. 정렬 필드 값 v 와 tiebreaker id 로 다음 페이지 경계를 만든다(전부 NOT NULL). */
    private BooleanExpression keyset(ShopSort sort, boolean asc, ShopCursor cursor) {
        if (cursor.isFirstPage()) {
            return null;
        }
        Long lastId = cursor.id();
        String sortValue = cursor.sortValue();
        return switch (sort) {
            case PRICE -> {
                long value = Long.parseLong(sortValue);
                yield asc
                    ? shop.price.gt(value).or(shop.price.eq(value).and(idAfter(lastId, true)))
                    : shop.price.lt(value).or(shop.price.eq(value).and(idAfter(lastId, false)));
            }
            case END_AT -> instantKeyset(shop.endAt, sortValue, lastId, asc);
            case CREATED_AT -> instantKeyset(shop.createdAt, sortValue, lastId, asc);
        };
    }

    private BooleanExpression instantKeyset(
        com.querydsl.core.types.dsl.DateTimePath<Instant> field, String sortValue, Long lastId, boolean asc) {
        Instant value = Instant.parse(sortValue);
        return asc
            ? field.gt(value).or(field.eq(value).and(idAfter(lastId, true)))
            : field.lt(value).or(field.eq(value).and(idAfter(lastId, false)));
    }

    private BooleanExpression idAfter(Long lastId, boolean asc) {
        return asc ? shop.id.gt(lastId) : shop.id.lt(lastId);
    }

    private OrderSpecifier<?>[] orderBy(ShopSort sort, boolean asc) {
        OrderSpecifier<?> primary = switch (sort) {
            case PRICE -> asc ? shop.price.asc() : shop.price.desc();
            case END_AT -> asc ? shop.endAt.asc() : shop.endAt.desc();
            case CREATED_AT -> asc ? shop.createdAt.asc() : shop.createdAt.desc();
        };
        OrderSpecifier<Long> tiebreak = asc ? shop.id.asc() : shop.id.desc();
        List<OrderSpecifier<?>> specifiers = new ArrayList<>();
        specifiers.add(primary);
        specifiers.add(tiebreak);
        return specifiers.toArray(new OrderSpecifier<?>[0]);
    }
}
