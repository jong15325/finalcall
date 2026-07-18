package com.finalcall.domain.bid;

import static com.finalcall.domain.bid.QBid.bid;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.finalcall.domain.member.QUser;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 입찰 커스텀 쿼리 QueryDSL 구현(bid). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합한다.
 */
@RequiredArgsConstructor
public class BidRepositoryImpl implements BidRepositoryCustom {

    private static final QUser BIDDER = new QUser("bidder");

    private final JPAQueryFactory queryFactory;

    /**
     * content 쿼리와 count 쿼리를 분리한다(notice 참조 구현 선례).
     *
     * <p>{@code bidder} 를 fetch join 하는 이유는 응답의 {@code bidderMasked}(닉네임 마스킹)다 — OSIV 가 꺼져 있어
     * 표현 계층에서 lazy 접근이 불가능하고, fetch 하지 않으면 페이지 크기만큼 N+1 이 난다. to-one fetch 라
     * offset/limit 과 충돌하지 않는다(컬렉션 fetch join + limit 의 메모리 페이징 함정 없음).
     */
    @Override
    public Page<Bid> findPageByAuctionId(Long auctionId, Pageable pageable) {
        List<Bid> content = queryFactory.selectFrom(bid)
            .join(bid.bidder, BIDDER).fetchJoin()
            .where(bid.auction.id.eq(auctionId))
            // 금액 단조 증가(I2)라 amount desc 가 곧 최신순. id tiebreaker 로 페이지 경계를 결정적으로 만든다.
            .orderBy(bid.amount.desc(), bid.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory.select(bid.count())
            .from(bid)
            .where(bid.auction.id.eq(auctionId))
            .fetchOne();

        return new PageImpl<>(content, pageable, total == null ? 0L : total);
    }
}
