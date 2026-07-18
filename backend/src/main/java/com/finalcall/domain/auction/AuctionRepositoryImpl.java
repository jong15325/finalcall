package com.finalcall.domain.auction;

import static com.finalcall.domain.auction.QAuction.auction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.finalcall.domain.bid.QBid;
import com.finalcall.domain.item.QItemInstance;
import com.finalcall.domain.item.QItemTemplate;
import com.finalcall.domain.item.QSkillDefinition;
import com.finalcall.domain.member.QUser;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;
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
    private static final QUser HIGHEST_BIDDER = new QUser("highestBidder");
    private static final QBid BID = QBid.bid;

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<AuctionWithBidCount> findDetailByPublicId(String publicId) {
        Expression<Long> bidCount = bidCountSubQuery();
        Tuple result = queryFactory.select(auction, bidCount)
            .from(auction)
            .join(auction.itemInstance, ITEM).fetchJoin()
            .join(ITEM.template, TEMPLATE).fetchJoin()
            .leftJoin(ITEM.skill1, SKILL1).fetchJoin()
            .leftJoin(ITEM.skill2, SKILL2).fetchJoin()
            .join(auction.seller, SELLER).fetchJoin()
            // 최고입찰자는 nullable 연관이라 leftJoin 이다(입찰 없는 경매가 목록·상세에서 사라지면 안 된다).
            .leftJoin(auction.highestBidder, HIGHEST_BIDDER).fetchJoin()
            .where(auction.publicId.eq(publicId))
            .fetchOne();
        return Optional.ofNullable(result).map(row -> toRow(row, bidCount));
    }

    @Override
    public List<AuctionWithBidCount> findByCursor(
        AuctionSearchCondition condition, AuctionCursor cursor, int size, Instant now) {
        Expression<Long> bidCount = bidCountSubQuery();
        return queryFactory.select(auction, bidCount)
            .from(auction)
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
            .fetch().stream()
            .map(row -> toRow(row, bidCount))
            .toList();
    }

    /**
     * 입찰 수 상관 서브쿼리 {@code (SELECT COUNT(*) FROM bid WHERE auction_id = a.id)}(spec §7.3 확정).
     *
     * <p>경매 행마다 한 번 평가되지만 <b>쿼리 왕복은 1회</b>다 — 애플리케이션이 경매 건수만큼 쿼리를 던지는
     * N+1 과는 다르다. 인덱스 {@code (auction_id, amount DESC)} 의 range count 라 페이지당 비용이 작다.
     * 비정규화 컬럼({@code auction.bid_count})을 두지 않는 근거는 {@link AuctionWithBidCount} 참조.
     */
    private Expression<Long> bidCountSubQuery() {
        return JPAExpressions.select(BID.count()).from(BID).where(BID.auction.id.eq(auction.id));
    }

    private AuctionWithBidCount toRow(Tuple row, Expression<Long> bidCount) {
        Long count = row.get(bidCount);
        return new AuctionWithBidCount(row.get(auction), count == null ? 0L : count);
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
            case HIGHEST_BID_AMOUNT -> highestBidKeyset(sortValue, lastId, asc);
        };
    }

    /**
     * ★ {@code highestBidAmount} 정렬의 keyset 경계 — <b>nullable 정렬 필드</b>라 별도 취급한다(FC-033).
     *
     * <p>EPIC-AUCTION 은 이 컬럼이 전건 NULL 이라는 전제로 경계를 id 만으로 잡고 있었다. EPIC-BID 로 실값이
     * 들어오면 그 전제가 깨지면서 <b>페이지 경계가 어긋나 중복·누락이 조용히 발생</b>한다(예외도 로그도 없다).
     * 그래서 최고가 실값 대체와 같은 티켓에서 함께 고친다.
     *
     * <p><b>NULL 정렬 위치 확정: MySQL 네이티브 순서(NULL = 최소값)를 그대로 채택한다</b> →
     * ASC 는 NULLS FIRST, DESC 는 NULLS LAST. 명시적 {@code NULLS LAST} 를 쓰지 않는 이유는 MySQL 이 그 문법을
     * 지원하지 않아 Hibernate 가 {@code ORDER BY (col IS NULL), col} 식으로 <b>표현식 정렬로 에뮬레이트</b>하고,
     * 그 순간 F6 인덱스 {@code auction(status, highest_bid_amount)} 를 쓸 수 없게 되기 때문이다. 아래 경계식은
     * 이 "NULL 최소" 순서와 정확히 일치하도록 작성했다 — ORDER BY 와 keyset 이 어긋나면 그 자체가 페이징 버그다.
     *
     * @param sortValue 직전 페이지 마지막 행의 최고가. <b>null 이면 그 행이 입찰 없는 경매</b>였다는 뜻이다
     */
    private BooleanExpression highestBidKeyset(String sortValue, Long lastId, boolean asc) {
        if (sortValue == null) {
            // 경계 행이 NULL 그룹에 있다. ASC: NULL 그룹의 나머지(id 큰 쪽) + 값 있는 행 전부가 뒤에 온다.
            //                          DESC: NULL 그룹이 맨 뒤이므로 같은 그룹의 나머지(id 작은 쪽)만 남는다.
            return asc
                ? auction.highestBidAmount.isNull().and(idAfter(lastId, true))
                    .or(auction.highestBidAmount.isNotNull())
                : auction.highestBidAmount.isNull().and(idAfter(lastId, false));
        }
        long value = Long.parseLong(sortValue);
        if (asc) {
            return auction.highestBidAmount.gt(value)
                .or(auction.highestBidAmount.eq(value).and(idAfter(lastId, true)));
        }
        // DESC: 더 작은 값 → 동값 tiebreak → 마지막으로 NULL 그룹 전부. isNull 을 빠뜨리면 입찰 없는 경매가
        //       페이지 2 이후에서 통째로 사라진다(누락).
        return auction.highestBidAmount.lt(value)
            .or(auction.highestBidAmount.eq(value).and(idAfter(lastId, false)))
            .or(auction.highestBidAmount.isNull());
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
