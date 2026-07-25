package com.finalcall.domain.settlement.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auction.AuctionErrorCode;
import com.finalcall.domain.auction.entity.AuctionPurchaseContext;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.entity.BidSnapshot;
import com.finalcall.domain.bid.repository.BidRepository;
import com.finalcall.domain.currency.service.MoneyHoldService;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.settlement.FeePolicyProperties;
import com.finalcall.domain.settlement.SettlementErrorCode;
import com.finalcall.domain.settlement.dto.PurchaseResult;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;

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
 * <h2>잔액 락 순서 · 실행 순서 근거(§7-A4·§3.5)</h2>
 * 즉시구매는 서로 다른 최대 3개 {@code user_balance} 행(buyer·seller·loser)에 배타 락을 건다. 교차거래(두 사용자가
 * 서로의 경매를 동시에 구매)에서 경매 행 락은 서로 다른 행이라 순환 대기를 못 막으므로, 잔액 갱신을
 * <b>{@code user_id} 오름차순</b>으로 적용해 데드락을 원천 차단한다({@link #applyBalanceInUserIdOrder},
 * MoneyHoldService §4.4 규율 재사용). §3.5 의 "패자 해제가 구매자 차감보다 앞" 제약은 <b>구매자 == 최고입찰자</b>
 * (동일 행)일 때만 유효한데(자기 홀드를 먼저 풀어야 available-gated 차감 통과, A2 본인구매 허용), 그 경우 둘이 같은
 * user_id 스텝에 묶여 교차-행 정렬과 충돌하지 않는다.
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

        // 5) 잔액 이동을 user_id 오름차순으로 적용한다(§7-A4 데드락 방지, MoneyHoldService §4.4 규율 재사용). ★ PC clear.
        applyBalanceInUserIdOrder(buyerId, auction.sellerId(), price, settle, loser);

        // 6) 패자 입찰 강등(ACTIVE→OUTBID). bid 행이라 잔액 락 사이클과 무관해 순서 자유다. 0행 = 불변식 위반 → 롤백.
        if (loser != null) {
            Preconditions.validate(
                bidRepository.markOutbidIfActive(loser.bidId()) == 1, CommonErrorCode.INTERNAL_ERROR);
        }

        // 7) 정산 공통 꼬리(잔액 외: sale_order → 수익 원장 → 아이템 이전 → 소유 이력)를 recorder 에 위임.
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
     * 잔액 이동(구매자 차감·판매자 크레딧·패자 홀드 해제)을 <b>{@code user_id} 오름차순</b>으로 적용한다(§7-A4).
     * 즉시구매는 서로 다른 최대 3개 {@code user_balance} 행에 배타 락을 거는데, 서로 다른 두 경매에서 두 사용자가
     * 교차로 상대의 경매를 구매하면 락 순서가 역전돼 순환 대기(InnoDB 데드락)가 성립한다 — 경매 행 락은 서로 다른
     * 행이라 이를 막지 못한다. 전역 순서를 {@code user_id} 오름차순 하나로 고정하면 순환이 성립할 수 없다
     * (MoneyHoldService §4.4·bid 경로 규율 재사용).
     *
     * <p><b>§3.5 제약과의 정합</b>: "패자 해제가 구매자 차감보다 앞" 제약은 <b>구매자 == 최고입찰자(동일 행)</b>일
     * 때만 유효하다(자기 홀드를 먼저 풀어야 available-gated 차감이 통과). 그 경우 두 연산은 같은 {@code user_id}
     * 스텝 안에서 release→debit 순으로 묶여 교차-행 정렬과 충돌하지 않는다. 구매자 ≠ 최고입찰자면 세 행이 독립이라
     * user_id 오름차순으로 자유롭게 정렬한다(판매자는 자기 경매 입찰 불가라 loser ≠ seller, 자기구매 차단으로
     * buyer ≠ seller — 따라서 겹치는 행은 buyer==loser 뿐이다).
     */
    private void applyBalanceInUserIdOrder(Long buyerId, Long sellerId, long price, long settle, BidSnapshot loser) {
        boolean selfPurchase = loser != null && loser.bidderId().equals(buyerId);
        List<BalanceStep> steps = new ArrayList<>(3);
        // 구매자 스텝: 본인구매면 자기 홀드 해제(§3.5)를 차감보다 먼저(같은 행이라 사이클 무관), 이어서 직접 차감.
        steps.add(new BalanceStep(buyerId, () -> {
            if (selfPurchase) {
                moneyHoldService.release(loser.bidId());
            }
            Preconditions.validate(
                userBalanceRepository.decreaseGameMoney(buyerId, price) == 1, BidErrorCode.BID_INSUFFICIENT_BALANCE);
        }));
        // 판매자 스텝: 정산 크레딧. 0행 = 잔액 행 부재 = 불변식 위반.
        steps.add(new BalanceStep(sellerId, () -> Preconditions.validate(
            userBalanceRepository.increaseGameMoney(sellerId, settle) == 1,
            SettlementErrorCode.SETTLEMENT_SELLER_CREDIT_FAILED)));
        // 패자 스텝(구매자 ≠ 최고입찰자일 때만 별도 행): 진행 최고입찰 홀드 해제.
        if (loser != null && !selfPurchase) {
            steps.add(new BalanceStep(loser.bidderId(), () -> moneyHoldService.release(loser.bidId())));
        }
        steps.sort(Comparator.comparingLong(BalanceStep::userId));
        steps.forEach(step -> step.action().run());
    }

    /** user_id 오름차순 정렬을 위한 잔액 갱신 스텝(§7-A4). 스텝별 user_id 는 서로 다르다(buyer==loser 는 한 스텝). */
    private record BalanceStep(long userId, Runnable action) {
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
