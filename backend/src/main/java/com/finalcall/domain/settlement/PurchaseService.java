package com.finalcall.domain.settlement;

import java.time.Instant;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auction.AuctionErrorCode;
import com.finalcall.domain.auction.AuctionPurchaseContext;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.bid.BidSnapshot;
import com.finalcall.domain.currency.MoneyHoldService;
import com.finalcall.domain.member.UserBalanceRepository;

import lombok.RequiredArgsConstructor;

/**
 * 즉시구매 서비스(settlement, EPIC-PURCHASE) — "라이브 상태에서의 SOLD"(purchase-spec §1). money·concurrency
 * 최고위험 구간이다. 마감(SOLD)과 정산 꼬리는 같되(→ {@link SettlementRecorder} 공유), <b>머리는 고유</b>하다:
 * 동기 HTTP 진입 · 구매자 잔액 직접 차감 · 진행 최고입찰 홀드 해제 · live 종료성 CAS(result_type=BUYNOW).
 *
 * <h2>직렬화 설계(purchase-spec §3.1)</h2>
 * 즉시구매는 입찰·마감과 <b>동일한 auction 행</b>을 {@code FOR UPDATE} 로 잡는다. 세 경로가 한 행에서 직렬화되므로
 * 별도 조정이 불요하다 — 진행 입찰 뒤에서 대기하고, 락을 얻으면 최신 최고입찰을 본다. 즉시구매 vs 마감은 종료성
 * CAS 의 시간 조건({@code end_at > now} vs {@code <= now})이 시간축을 배타 분할해 한쪽만 성립시킨다(§3.3).
 *
 * <h2>★ 영속성 컨텍스트 clear 함정(§3.4)</h2>
 * {@link MoneyHoldService#release}(패자 해제)·{@link UserBalanceRepository#decreaseGameMoney}(구매자 차감)·
 * {@link SettlementRecorder}(판매자 크레딧)가 모두 영속성 컨텍스트를 비운다. 따라서 (1) 판정 근거는 락 스냅샷
 * ({@link AuctionPurchaseContext})으로 전부 값 복사하고, (2) 이후 전이는 {@code @Modifying} CAS·fresh INSERT 로만
 * 수행한다({@code AuctionPurchaseContext} 는 엔티티가 아닌 스칼라 프로젝션이라 애초에 detach 함정이 없다).
 *
 * <h2>실행 순서 근거(§3.5)</h2>
 * 패자 홀드 해제(5)를 구매자 차감(6)보다 <b>앞세운다</b> — 구매자가 곧 현재 최고 입찰자일 수 있기 때문이다(즉시구매는
 * 연속입찰 차단 BID_004 대상이 아니라 최고 입찰자 본인 구매를 허용, A2). 그 경우 5단계가 구매자 자신의 홀드를 먼저
 * 풀어 가용 잔액을 회복시켜야 6단계 {@code decreaseGameMoney}(available-gated)가 통과한다. 일반 경로(구매자 ≠
 * 최고 입찰자)에서도 서로 다른 잔액 행이라 무해하다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PurchaseService {

    private final AuctionRepository auctionRepository;
    private final BidRepository bidRepository;
    private final MoneyHoldService moneyHoldService;
    private final UserBalanceRepository userBalanceRepository;
    private final SettlementRecorder settlementRecorder;
    private final FeeCalculator feeCalculator;
    private final FeePolicyProperties feePolicy;

    /**
     * 즉시구매를 수용한다(계약 §3.1 {@code POST /auctions/{id}/purchase}). 경매 행 배타 락 아래에서 재검증 →
     * 진행 최고입찰 홀드 해제 → 구매자 직접 차감 → 정산 꼬리 → live 종료성 CAS 를 원자적으로 수행한다.
     *
     * @param auctionPublicId 대상 경매(구매자는 SecurityContext 주체)
     * @return 생성된 주문의 외부 식별자·최종 결제가
     * @throws BusinessException {@code AUCTION_004}(404 없음)·{@code AUCTION_005}(422 미설정)·
     *                           {@code AUCTION_006}(409 미개시·종료)·{@code AUCTION_009}(403 자기구매)·
     *                           {@code BID_005}(422 잔액 부족)
     */
    @Transactional
    @ServiceLog
    public PurchaseResult purchase(String auctionPublicId) {
        Long buyerId = currentUserId();
        Instant now = Instant.now();

        // 1) 경매 행 배타 락 + 값 스냅샷. 이 시점부터 커밋까지 동일 경매의 입찰·마감·다른 즉시구매는 여기서 대기한다.
        AuctionPurchaseContext auction = auctionRepository.findPurchaseContextForUpdate(auctionPublicId)
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));

        // 2) 재검증 — 전부 락 스냅샷 근거(§3.2). 락 밖 값으로 판정하면 TOCTOU 다.
        //    즉시구매 미설정 → AUCTION_005. 자기구매(wash trade·SEC-003) → AUCTION_009. live 실패(미개시·종료) → AUCTION_006.
        Preconditions.validate(auction.buyNowPrice() != null, AuctionErrorCode.AUCTION_BUY_NOW_NOT_SET);
        Preconditions.validate(!buyerId.equals(auction.sellerId()), AuctionErrorCode.AUCTION_SELF_PURCHASE);
        Preconditions.validate(isLive(auction, now), AuctionErrorCode.AUCTION_ALREADY_CLOSED);

        long price = auction.buyNowPrice();

        // 3) 진행 중 최고 입찰 식별. 락 아래라 경매당 ACTIVE 입찰은 최대 1건(I1). 없으면 입찰 0건 경매의 즉시구매.
        BidSnapshot loser = bidRepository.findActiveByAuctionId(auction.id()).orElse(null);

        // 4) 수수료 계산 1회(순수 함수). settle = P − fee, 항상 final=settle+fee(P-B). buyNowPrice 기준 동일 계산기.
        long fee = feeCalculator.compute(price);
        long settle = price - fee;
        String version = feePolicy.version();

        // 5) 패자 홀드 해제 + 입찰 강등 — 구매자 차감보다 앞(§3.5). 최고 입찰자 본인 구매면 자기 홀드를 먼저 풀어야
        //    6단계 available-gated 차감이 통과한다. release·markOutbidIfActive 는 EPIC-BID 패스 재사용. ★ PC clear.
        if (loser != null) {
            moneyHoldService.release(loser.bidId());
            Preconditions.validate(
                bidRepository.markOutbidIfActive(loser.bidId()) == 1, CommonErrorCode.INTERNAL_ERROR);
        }

        // 6) 구매자 직접 차감(available-gated, 홀드 미경유). 0행 = 가용 게임머니 부족 = 정상 실패 → BID_005. ★ PC clear.
        Preconditions.validate(
            userBalanceRepository.decreaseGameMoney(buyerId, price) == 1, BidErrorCode.BID_INSUFFICIENT_BALANCE);

        // 7) 정산 공통 꼬리(판매자 크레딧 → sale_order → 수익 원장 → 아이템 이전 → 소유 이력)를 recorder 에 위임.
        //    source_type=AUCTION(BID/BUYNOW 구분은 auction.result_type 이 진다 — B3 코어 미노출).
        SaleOrder order = settlementRecorder.record(
            SaleOrderSourceType.AUCTION, auction.id(), buyerId, auction.sellerId(), auction.itemInstanceId(),
            price, fee, settle, version, now);

        // 8) 경매 종료 전이(live 종료성 CAS). status=SOLD·result_type=BUYNOW. end_at > now 라 마감 워커와 시간축 배타(§3.3).
        //    0행 = 다른 구매자·마감이 선점 = 불변식 위반(재검증이 앞서므로 정상 경로에서 항상 1행) → 롤백.
        Preconditions.validate(
            auctionRepository.markSoldBuyNowIfLive(auction.id(), now) == 1,
            SettlementErrorCode.SETTLEMENT_TERMINAL_TRANSITION_FAILED);

        return new PurchaseResult(order.getPublicId(), price);
    }

    /**
     * live 판정(§3.2) — (ACTIVE 이거나 개시 도래한 SCHEDULED)이고 아직 마감 전({@code now < end_at})이다.
     * 입찰 가능 판정({@code BidService.isBiddable})과 동일 규칙이다 — 즉시구매도 "구매 가능한 진행 중 경매"만 대상이다.
     */
    private boolean isLive(AuctionPurchaseContext auction, Instant now) {
        boolean started = auction.status() == AuctionStatus.ACTIVE
            || (auction.status() == AuctionStatus.SCHEDULED
                && (auction.startAt() == null || !auction.startAt().isAfter(now)));
        return started && now.isBefore(auction.endAt());
    }

    /** 인증 주체(내부 PK). 인증 필요 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009, IDOR 차단). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
