package com.finalcall.domain.bid;

import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auction.AuctionBidContext;
import com.finalcall.domain.auction.AuctionErrorCode;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.currency.service.MoneyHoldService;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 입찰 서비스(bid, EPIC-BID) — 프로젝트 최고위험 구간.
 *
 * <h2>직렬화 설계(게이트2 a 확정)</h2>
 * 경매 행 비관적 락({@code FOR UPDATE}) + 금전 조건부 CAS 의 <b>이중 방어</b>다. Redis 분산락은 정확성 경계로
 * 쓰지 않는다 — 락 임대는 트랜잭션 수명과 무관해 만료·GC 정지 시 상호배제가 조용히 풀리고, Redis 장애가 입찰
 * 전면 중단으로 전파된다. DB 행 락은 락 수명 = 트랜잭션 수명이라 그 창이 존재하지 않는다(domain-spec §8
 * "정합성은 DB, 처리량은 락"). 경합이 어차피 단일 경매 행에 집중되므로 앱락의 처리량 이점도 실현되지 않는다.
 *
 * <h2>트랜잭션 경계(게이트2 b 확정)</h2>
 * 검증 → 입찰 기록 → 홀드 → 직전 홀드 즉시 해제 → 최고가·연장 갱신이 <b>전부 하나의 트랜잭션</b>이다. 직전 홀드
 * 해제가 실패하면 입찰 자체가 롤백되므로 "홀드는 잡혔는데 해제는 안 된" 부분 실패 상태가 성립하지 않는다.
 * 그래서 정합 회복 절차가 <b>필요 없다</b> — 회복 로직은 그 자체가 검증 부담이자 새로운 결함면이다.
 *
 * <h2>★ 영속성 컨텍스트 clear 함정(§4.2)</h2>
 * {@link MoneyHoldService#placeHold} 는 내부적으로 {@code clearAutomatically} 잔액 UPDATE 를 호출해
 * <b>영속성 컨텍스트를 통째로 비운다</b>. 따라서 이 클래스는 (1) 판정 근거를 전부 값 스냅샷으로 들고 다니고,
 * (2) 경매 갱신을 dirty-checking 이 아닌 {@code @Modifying} UPDATE 로 수행하며, (3) 새 입찰의 식별자를
 * {@code placeHold} <b>호출 전에</b> 지역 변수로 복사한다. 어기면 갱신이 예외 없이 조용히 유실된다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BidService {

    private final AuctionRepository auctionRepository;
    private final BidRepository bidRepository;
    private final UserRepository userRepository;
    private final MoneyHoldService moneyHoldService;
    private final BidIncrementProperties incrementProperties;

    /**
     * 입찰을 수용한다(계약 §3.1). 경매 행 배타 락 아래에서 검증 → 입찰 기록 → 홀드 왕복 → 최고가·연장 갱신을
     * 원자적으로 수행한다.
     *
     * @param command 대상 경매와 입찰액(입찰자는 SecurityContext 주체)
     * @return 성립한 입찰의 식별자·금액·연장 반영 마감 시각
     * @throws BusinessException 계약 §5 의 {@code AUCTION_004}·{@code BID_001~007}
     */
    @Transactional
    @ServiceLog
    public BidPlaceResult place(BidPlaceCommand command) {
        Long bidderId = currentUserId();
        long amount = command.amount();
        Instant now = Instant.now();

        // 1) 경매 행 배타 락 + 값 스냅샷. 이 시점부터 커밋까지 동일 경매의 다른 입찰은 여기서 대기한다.
        AuctionBidContext auction = auctionRepository.findBidContextForUpdate(command.auctionPublicId())
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));

        // 2) 검증 — 전부 락 스냅샷 근거(§3.1). 락 밖 값으로 판정하면 TOCTOU 다.
        validate(auction, bidderId, amount, now);

        // 3) 직전 최고 입찰 식별. 락 아래라 경매당 ACTIVE 입찰은 최대 1건이다(I1).
        BidSnapshot previous = bidRepository.findActiveByAuctionId(auction.id()).orElse(null);
        Long previousBidId = previous == null ? null : previous.bidId();

        // 4) 입찰 기록 — 홀드보다 먼저다. money_hold.bid_id 가 NOT NULL FK + UK 라 bid 행이 선행해야 한다.
        //    식별자는 여기서 복사한다: 다음 단계가 영속성 컨텍스트를 비워 이 엔티티가 detach 되기 때문이다.
        Bid bid = bidRepository.saveAndFlush(Bid.builder()
            .auction(auctionRepository.getReferenceById(auction.id()))
            .bidder(userRepository.getReferenceById(bidderId))
            .amount(amount)
            .build());
        String bidPublicId = bid.getPublicId();
        Long bidId = bid.getId();

        // 5) 금전 이동 — 신규 홀드 + 직전 홀드 즉시 해제(P-008)를 한 진입점에서 처리한다. 외부 빈 호출이라
        //    프록시를 타며(self-invocation 아님) 동일 트랜잭션에 참여한다. 잔액 부족은 여기서 BID_005 가 된다.
        //    ★ 이 호출 이후 영속성 컨텍스트는 비어 있다.
        moneyHoldService.placeHold(bidderId, bidId, amount, previousBidId);

        // 6) 직전 입찰 ACTIVE→OUTBID 조건부 CAS. 0행이면 밀어낼 최고 입찰이 이미 없었다는 뜻 = 불변식 위반이라
        //    무시하지 않고 롤백한다(조용한 최고가 드리프트 방지).
        if (previousBidId != null) {
            Preconditions.validate(
                bidRepository.markOutbidIfActive(previousBidId) == 1, CommonErrorCode.INTERNAL_ERROR);
        }

        // 7) 경매 갱신 — 최고가·최고입찰자·상태 승격·마감 연장을 단일 UPDATE 로. 연장을 입찰과 같은 문장에 두어
        //    "입찰은 성공했는데 연장이 누락"되는 틈을 원천 차단한다(domain-spec §8).
        SoftCloseDecision softClose = SoftCloseDecision.decide(
            now, auction.endAt(), auction.maxEndAt(), auction.softCloseWindowSec(), auction.softCloseExtendSec());
        int extensionCount = auction.extensionCount() + (softClose.extended() ? 1 : 0);
        int affected = auctionRepository.applyBid(
            auction.id(), amount, userRepository.getReferenceById(bidderId),
            promoteStatus(auction), softClose.endAt(), extensionCount);
        Preconditions.validate(affected == 1, CommonErrorCode.INTERNAL_ERROR);

        return new BidPlaceResult(bidPublicId, amount, amount, softClose.endAt());
    }

    /**
     * 입찰 이력을 조회한다(계약 §3.1 {@code GET /auctions/{id}/bids}) — <b>인증 불요</b> 공개 조회다.
     *
     * <p>경매 존재를 먼저 확인해 {@code AUCTION_004}(404)를 내는 이유는, 없는 경매에 빈 페이지를 돌려주면
     * 클라이언트가 "입찰 0건"과 "잘못된 링크"를 구분할 수 없기 때문이다. 경매 존재 여부는 공개 상세로 이미
     * 노출되는 정보라 열거 리스크가 없다(SEC-007 무관).
     *
     * <p>응답에는 입찰자 실식별자(userPublicId·loginId·실 nickname)와 자금 정보(홀드·잔액)를 싣지 않는다 —
     * 마스킹·필드 선별은 표현 계층({@code BidSummaryResponse})이 수행한다.
     *
     * @return 입찰 이력 페이지(금액 내림차순). 입찰이 없으면 빈 페이지
     * @throws BusinessException 경매가 없으면 {@code AUCTION_004}
     */
    @ServiceLog
    public Page<Bid> getBids(String auctionPublicId, Pageable pageable) {
        Long auctionId = auctionRepository.findIdByPublicId(auctionPublicId)
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));
        return bidRepository.findPageByAuctionId(auctionId, pageable);
    }

    /**
     * 검증 순서(§3.1 확정): 상태(2·3) → 주체(4·5) → 금액(6·7). 자금(8)은 {@code placeHold} 가 마지막에 판정한다.
     *
     * <p>자금 검증을 뒤로 미루는 것은 의도적이다 — 앞선 검증에서 어차피 거부될 요청이 잔액 행 배타 락을 잡지
     * 않게 되어 락 보유 시간이 짧아지고 데드락 표면이 줄어든다.
     */
    private void validate(AuctionBidContext auction, Long bidderId, long amount, Instant now) {
        // (2) 미개시 — "아직 시작 안 함"과 "이미 끝남"은 안내·재시도 가능성이 정반대라 코드를 나눈다.
        Preconditions.validate(!isNotStarted(auction, now), BidErrorCode.BID_NOT_STARTED);
        // (3) 마감·종료 — 판정 기준은 status 가 아니라 시각(now >= end_at)이다. 마감 워커(EPIC-CLOSING)가
        //     아직 없어 status 가 ACTIVE 로 고여 있어도 정확히 거부된다.
        Preconditions.validate(isBiddable(auction, now), BidErrorCode.BID_NOT_BIDDABLE);
        // (4) 자기 경매 — wash trade·shill bidding 방지(SEC-003). 판매자 판정은 락 스냅샷으로만 한다.
        Preconditions.validate(!bidderId.equals(auction.sellerId()), BidErrorCode.BID_SELF_AUCTION);
        // (5) 연속 입찰 — 현재 최고가 보유자의 재입찰 차단(자기 가격 인상). 앵커는 이미 락으로 읽은 컬럼이라
        //     추가 쿼리도 staleness 도 없다(§13-e).
        Preconditions.validate(!bidderId.equals(auction.highestBidderId()), BidErrorCode.BID_CONSECUTIVE);
        // (6) 즉시구매가 상한 — 즉시구매를 항상 유효하게 유지하기 위한 제약(domain-spec §4 "상한선").
        Preconditions.validate(
            auction.buyNowPrice() == null || amount < auction.buyNowPrice(), BidErrorCode.BID_EXCEEDS_BUY_NOW);
        // (7) 최소 증분 — 첫 입찰 하한은 시작가다(F5). 시작가·증분이 모두 양수이므로 이 검증이 0·음수 입찰도
        //     함께 차단한다(MoneyHoldService 의 부호 검증·DB CHECK 와 3중 방어).
        Preconditions.validate(amount >= minNextBidAmount(auction), BidErrorCode.BID_BELOW_MIN_INCREMENT);
    }

    /** 미개시(BID_007) ⇔ 영속 상태가 SCHEDULED 이고 개시 시각이 아직 오지 않았다. */
    private boolean isNotStarted(AuctionBidContext auction, Instant now) {
        return auction.status() == AuctionStatus.SCHEDULED
            && auction.startAt() != null && auction.startAt().isAfter(now);
    }

    /** 입찰 가능 ⇔ (ACTIVE 이거나 개시 도래한 SCHEDULED) 이고 아직 마감 전이다(§3.2). */
    private boolean isBiddable(AuctionBidContext auction, Instant now) {
        boolean started = auction.status() == AuctionStatus.ACTIVE
            || (auction.status() == AuctionStatus.SCHEDULED
                && (auction.startAt() == null || !auction.startAt().isAfter(now)));
        return started && now.isBefore(auction.endAt());
    }

    /**
     * 첫 입찰이면 시작가, 후속이면 최고가 + 해당 구간 증분(§3.3). 산출은 {@link BidIncrementProperties} 가 단독으로
     * 책임진다 — 경매 상세의 {@code minNextBidAmount} 파생값도 같은 메서드를 호출하므로 안내 금액과 검증 하한이
     * 갈라질 수 없다.
     */
    private long minNextBidAmount(AuctionBidContext auction) {
        return incrementProperties.minNextBidAmount(auction.startPrice(), auction.highestBidAmount());
    }

    /**
     * 개시 시각이 도래한 SCHEDULED 경매는 입찰 성립과 동일 UPDATE 에서 ACTIVE 로 <b>영속 승격</b>한다(게이트2 d).
     *
     * <p>승격 비용이 0(이미 실행되는 UPDATE 에 컬럼 하나)이라 미룰 이유가 없다. 입찰이 들어온 경매는 영속값이
     * 자연 치유되고, 입찰 없는 경매는 조회 시 lazy 파생으로 충분하다 — 워커(EPIC-CLOSING)를 당겨오지 않는다.
     */
    private AuctionStatus promoteStatus(AuctionBidContext auction) {
        if (auction.status() == AuctionStatus.SCHEDULED) {
            return AuctionStatus.ACTIVE;
        }
        return auction.status();
    }

    /** 인증 주체(내부 PK). 인증 필요 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
