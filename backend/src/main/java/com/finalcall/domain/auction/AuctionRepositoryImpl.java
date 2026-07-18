package com.finalcall.domain.auction;

import static com.finalcall.domain.auction.QAuction.auction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.finalcall.domain.item.QItemInstance;
import com.finalcall.domain.item.QItemTemplate;
import com.finalcall.domain.item.QSkillDefinition;
import com.finalcall.domain.member.QUser;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 경매 커스텀 쿼리 QueryDSL 구현(auction). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합한다.
 *
 * <p>목록/상세는 item 표시 블록(template·skill live join)과 seller 를 함께 노출하므로 to-one fetch join 으로 N+1 을
 * 제거한다(표현 계층 lazy 접근 없음, OSIV off). 목록은 keyset cursor 로 안정 페이지네이션한다 — 정렬 필드 + id
 * tiebreaker 로 동일 정렬값에서도 결정적 순서를 보장한다(concurrency-review: 삽입 중에도 페이지 경계 흔들림 최소).
 */
@RequiredArgsConstructor
public class AuctionRepositoryImpl implements AuctionRepositoryCustom {

    private static final QItemInstance ITEM = QItemInstance.itemInstance;
    private static final QItemTemplate TEMPLATE = QItemTemplate.itemTemplate;
    private static final QSkillDefinition SKILL1 = new QSkillDefinition("skill1");
    private static final QSkillDefinition SKILL2 = new QSkillDefinition("skill2");
    private static final QUser SELLER = new QUser("seller");

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Auction> findDetailByPublicId(String publicId) {
        Auction result = queryFactory.selectFrom(auction)
            .join(auction.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(auction.seller, SELLER).fetchJoin()
            .where(auction.publicId.eq(publicId))
            .fetchOne();
        return Optional.ofNullable(result);
    }

    @Override
    public List<Auction> findByCursor(AuctionSearchCondition condition, AuctionCursor cursor, int size, Instant now) {
        return queryFactory.selectFrom(auction)
            .join(auction.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(auction.seller, SELLER).fetchJoin()
            .where(
                statusScope(condition),
                mainCategoryEq(condition.mainCategory()),
                subGroupEq(condition.subGroup()),
                elementEq(condition.element()),
                kindEq(condition.kind()),
                levelGoe(condition.minLevel()),
                levelLoe(condition.maxLevel()),
                skill1Eq(condition.skill1()),
                skill2Eq(condition.skill2()),
                goldforce(condition.goldforceActive(), now),
                priceGoe(condition.minPrice()),
                priceLoe(condition.maxPrice()),
                keyset(condition.sort(), condition.ascending(), cursor))
            .orderBy(orderBy(condition.sort(), condition.ascending()))
            .limit((long)size + 1) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    /** status 미지정이면 진행 가능(SCHEDULED·ACTIVE) 기본 노출, 지정이면 해당 영속 상태만(종료분 조회 허용, spec §5.2). */
    private BooleanExpression statusScope(AuctionSearchCondition condition) {
        if (condition.status() == null) {
            return auction.status.in(AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE);
        }
        return auction.status.eq(condition.status());
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

    private BooleanExpression skill1Eq(Integer skillCode) {
        return skillCode == null ? null : SKILL1.skillCode.eq(skillCode);
    }

    private BooleanExpression skill2Eq(Integer skillCode) {
        return skillCode == null ? null : SKILL2.skillCode.eq(skillCode);
    }

    /** 골드포스 활성(gf_expire_at &gt; now) 필터. TRUE=활성만, FALSE=비활성(null 또는 만료)만, null=미필터. */
    private BooleanExpression goldforce(Boolean active, Instant now) {
        if (active == null) {
            return null;
        }
        return active
            ? ITEM.gfExpireAt.gt(now)
            : ITEM.gfExpireAt.isNull().or(ITEM.gfExpireAt.loe(now));
    }

    private BooleanExpression priceGoe(Long value) {
        return value == null ? null : auction.startPrice.goe(value);
    }

    private BooleanExpression priceLoe(Long value) {
        return value == null ? null : auction.startPrice.loe(value);
    }

    /**
     * keyset cursor 경계 predicate. 정렬 필드 값 {@code v} 와 tiebreaker id 로 다음 페이지 경계를 만든다.
     * highestBidAmount 는 본 에픽 전건 NULL 이라 id 만으로 경계를 잡는다(정렬값 비교가 무의미·NULL 비교 회피).
     */
    private BooleanExpression keyset(AuctionSort sort, boolean asc, AuctionCursor cursor) {
        if (cursor.isFirstPage()) {
            return null;
        }
        Long lastId = cursor.id();
        String sortValue = cursor.sortValue();
        return switch (sort) {
            case PRICE -> {
                long value = Long.parseLong(sortValue);
                yield asc
                    ? auction.startPrice.gt(value).or(auction.startPrice.eq(value).and(idAfter(lastId, true)))
                    : auction.startPrice.lt(value).or(auction.startPrice.eq(value).and(idAfter(lastId, false)));
            }
            case END_AT -> instantKeyset(auction.endAt, sortValue, lastId, asc);
            case CREATED_AT -> instantKeyset(auction.createdAt, sortValue, lastId, asc);
            case HIGHEST_BID_AMOUNT -> idAfter(lastId, asc);
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
        return asc ? auction.id.gt(lastId) : auction.id.lt(lastId);
    }

    private OrderSpecifier<?>[] orderBy(AuctionSort sort, boolean asc) {
        OrderSpecifier<?> primary = switch (sort) {
            case PRICE -> asc ? auction.startPrice.asc() : auction.startPrice.desc();
            case END_AT -> asc ? auction.endAt.asc() : auction.endAt.desc();
            case CREATED_AT -> asc ? auction.createdAt.asc() : auction.createdAt.desc();
            case HIGHEST_BID_AMOUNT -> asc ? auction.highestBidAmount.asc() : auction.highestBidAmount.desc();
        };
        OrderSpecifier<Long> tiebreak = asc ? auction.id.asc() : auction.id.desc();
        List<OrderSpecifier<?>> specifiers = new ArrayList<>();
        specifiers.add(primary);
        specifiers.add(tiebreak);
        return specifiers.toArray(new OrderSpecifier<?>[0]);
    }
}
