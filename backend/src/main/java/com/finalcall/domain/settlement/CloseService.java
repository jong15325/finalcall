package com.finalcall.domain.settlement;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auction.AuctionCloseContext;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.bid.BidSnapshot;
import com.finalcall.domain.currency.MoneyHoldRepository;
import com.finalcall.domain.currency.MoneyHoldService;
import com.finalcall.domain.item.InventoryService;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemOwnershipHistory;
import com.finalcall.domain.item.ItemOwnershipHistoryRepository;
import com.finalcall.domain.item.TransferType;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 경매 마감·정산 서비스(settlement, EPIC-CLOSING) — 마감 시각이 지난 경매 1건을 실제 종료 상태로 영속 전이하고
 * 그에 수반하는 금전·소유 정산을 원자적으로 수행한다. money·concurrency 최고위험 구간이다.
 *
 * <h2>직렬화·idempotency 설계(closing-domain-spec §3.2)</h2>
 * {@link #closeOne} 은 경매 1건 = 독립 트랜잭션이다. 진입 즉시 auction 행에 배타 락({@code FOR UPDATE})을 걸어
 * <b>입찰과 동일 행</b>을 잡는다(bid-domain-spec §4.1) — 진행 중 입찰 뒤에서 대기하고, 락을 얻으면 그 입찰이
 * 반영된 최신 상태를 본다. idempotency 의 핵심은 <b>행 락 하 재검증 + 종료성 CAS</b>다: 두 워커 인스턴스가 같은
 * 경매를 동시에 집어도 먼저 락을 쥔 쪽이 SOLD/UNSOLD 로 전이·커밋하면, 뒤이어 락을 얻은 쪽은 재검증에서
 * {@code status ∉ (SCHEDULED,ACTIVE)} 를 보고 조용히 return 한다(부작용 0, I-F). 분산락(Redisson) 불요.
 *
 * <h2>★ 영속성 컨텍스트 clear 함정(§4.2)</h2>
 * {@code UserBalanceRepository.capture}/{@code increaseGameMoney} 는 {@code clearAutomatically} 라 영속성 컨텍스트를
 * 통째로 비운다. 따라서 SOLD 절차는 (1) 판정 근거를 전부 값 스냅샷으로 들고 다니고, (2) 모든 상태 전이를
 * {@code @Modifying} CAS 또는 fresh INSERT({@code getReferenceById} FK)로 수행한다. 어기면 갱신이 조용히 유실된다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CloseService {

    private final AuctionRepository auctionRepository;
    private final BidRepository bidRepository;
    private final MoneyHoldService moneyHoldService;
    private final MoneyHoldRepository moneyHoldRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final UserRepository userRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final ItemOwnershipHistoryRepository itemOwnershipHistoryRepository;
    private final InventoryService inventoryService;
    private final SaleOrderRepository saleOrderRepository;
    private final PlatformRevenueLedgerRepository platformRevenueLedgerRepository;
    private final FeeCalculator feeCalculator;
    private final FeePolicyProperties feePolicy;

    /**
     * 경매 1건을 마감한다(독립 트랜잭션). auction 행 배타 락 → 재검증 → SOLD/UNSOLD 분기 → 종료성 CAS.
     *
     * <p>재검증(§3.2 2단계)이 idempotency·소프트클로즈 경합·다중 인스턴스 안전을 한꺼번에 처리한다: 이미 종결됐으면
     * (다른 인스턴스가 처리) 조용히 return, 막판 연장으로 {@code end_at > now} 가 됐으면(소프트클로즈) 마감하지 않고
     * return 한다(다음 tick 이 새 end_at 후 재시도, I-G).
     *
     * @param auctionId 마감 대상 경매 PK(후보 스캔 {@code findClosableIds} 가 뽑은 id)
     * @param now       마감 판정 기준 시각(한 tick 의 스캔 시각)
     */
    @Transactional
    @ServiceLog
    public void closeOne(Long auctionId, Instant now) {
        // 1) auction 행 배타 락 + 값 스냅샷. 이 시점부터 커밋까지 동일 경매의 입찰·다른 마감은 여기서 대기한다.
        AuctionCloseContext auction = auctionRepository.findCloseContextForUpdate(auctionId).orElse(null);
        if (auction == null) {
            return; // 경매가 삭제됨 — 정상 skip
        }

        // 2) 재검증(락 스냅샷 근거). 이미 종결됐거나(다른 인스턴스 처리) 막판 연장으로 마감이 밀렸으면 무부작용 return.
        boolean closable = (auction.status() == AuctionStatus.SCHEDULED || auction.status() == AuctionStatus.ACTIVE)
            && !auction.endAt().isAfter(now);
        if (!closable) {
            return;
        }

        // 3) 분기: 최고입찰자 유무가 축이다(§3.2 3단계).
        if (auction.highestBidderId() != null) {
            settleSold(auction, now);
        } else {
            settleUnsold(auction, now);
        }
    }

    /**
     * 낙찰(SOLD) 정산(§4.1) — 낙찰 bid WON · 홀드 CAPTURED · 판매자 크레딧 · sale_order · 수익 원장 · 아이템 이전.
     * 실행 순서는 PC clear 함정과 FK 의존을 함께 만족한다: 잔액 갱신(PC clear) 뒤 fresh INSERT/CAS 만 수행하고,
     * sale_order INSERT 를 수익 원장·소유 이력보다 앞세워 그 id 를 참조하게 한다.
     */
    private void settleSold(AuctionCloseContext auction, Instant now) {
        // 판정 근거는 잔액 호출 전에 전부 지역 변수(long/Long)로 복사한다 — PC clear 의 사정권 밖.
        Long auctionId = auction.id();
        Long sellerId = auction.sellerId();
        Long winnerId = auction.highestBidderId();
        Long itemInstanceId = auction.itemInstanceId();

        // (1) 낙찰 bid 식별. 락 아래라 경매당 ACTIVE 입찰은 최대 1건(I1)이라 단건 바인딩 안전. 없으면 불변식 위반.
        BidSnapshot win = bidRepository.findActiveByAuctionId(auctionId)
            .orElseThrow(() -> new BusinessException(SettlementErrorCode.SETTLEMENT_NO_WINNING_BID));
        long price = win.amount();
        Preconditions.validate(
            auction.highestBidAmount() != null && auction.highestBidAmount() == price,
            SettlementErrorCode.SETTLEMENT_PRICE_MISMATCH);

        // (2) 수수료 계산 1회(순수 함수 — 누진→반올림→cap→최소). settle = P − fee, 항상 final=settle+fee(I-B).
        long fee = feeCalculator.compute(price);
        long settle = price - fee;
        String version = feePolicy.version();

        // (3) 낙찰 bid ACTIVE→WON CAS. 0행 = 대상이 ACTIVE 아님 = 불변식 위반.
        Preconditions.validate(
            bidRepository.markWonIfActive(win.bidId()) == 1, SettlementErrorCode.SETTLEMENT_BID_NOT_WON);

        // (4) 홀드 확정 차감(HELD→CAPTURED + 실차감). ★ 이 호출 이후 영속성 컨텍스트는 비어 있다.
        moneyHoldService.capture(win.bidId(), now);

        // (5) 판매자 정산 지급(게임머니 크레딧). 0행 = 잔액 행 부재 = 불변식 위반.
        Preconditions.validate(
            userBalanceRepository.increaseGameMoney(sellerId, settle) == 1,
            SettlementErrorCode.SETTLEMENT_SELLER_CREDIT_FAILED);

        // (6) 거래 레코드. (source_type, source_id) UK 가 동일 경매 이중 SOLD 를 여기서 차단한다(I-C). id 획득.
        SaleOrder order = saleOrderRepository.saveAndFlush(SaleOrder.builder()
            .sourceType(SaleOrderSourceType.AUCTION)
            .sourceId(auctionId)
            .buyer(userRepository.getReferenceById(winnerId))
            .seller(userRepository.getReferenceById(sellerId))
            .itemInstance(itemInstanceRepository.getReferenceById(itemInstanceId))
            .finalPrice(price)
            .feeAmount(fee)
            .settleAmount(settle)
            .feePolicyVersion(version)
            .settledAt(now)
            .build());
        Long orderId = order.getId();

        // (7) 사업자 수익 적립(④-C). sale_order_id UK 가 수수료 이중 적립을 차단한다(I-H 정합). fee 는 재계산 없음.
        platformRevenueLedgerRepository.saveAndFlush(PlatformRevenueLedger.builder()
            .saleOrder(saleOrderRepository.getReferenceById(orderId))
            .amount(fee)
            .feePolicyVersion(version)
            .build());

        // (8) 아이템 소유 이전(owner→winner, LISTED→INVENTORY/만실 TEMP). 별도 빈 경유(self-invocation 아님).
        inventoryService.transferListedToBuyer(itemInstanceId, winnerId);

        // (9) 소유 이력 append(TRADE, sale_order_id). TransferType.TRADE 첫 사용(§4.4).
        itemOwnershipHistoryRepository.saveAndFlush(ItemOwnershipHistory.builder()
            .instanceId(itemInstanceId)
            .fromOwnerId(sellerId)
            .toOwnerId(winnerId)
            .transferType(TransferType.TRADE)
            .saleOrderId(orderId)
            .transferredAt(now)
            .build());

        // (10) 경매 종료 전이(종료성 CAS). status·result_type 만 세팅(highest_* 는 입찰 TX 가 세팅 — 덮지 않음).
        Preconditions.validate(
            auctionRepository.markSoldIfClosable(auctionId, now) == 1,
            SettlementErrorCode.SETTLEMENT_TERMINAL_TRANSITION_FAILED);
    }

    /**
     * 유찰(UNSOLD) 정산(§5) — 홀드 0건 확인 · 아이템 판매자 반환(에스크로 해제) · UNSOLD CAS. 금전 이동 없음.
     * PC clear 가 없으므로(잔액 미갱신) 아이템 반환은 managed 엔티티 dirty-checking({@code releaseFromListing})을 쓴다.
     */
    private void settleUnsold(AuctionCloseContext auction, Instant now) {
        Long auctionId = auction.id();

        // (1) 홀드 없음 확인(방어). 입찰 0건이므로 HELD 홀드도 0건이어야 한다(I3). 아니면 정합 위반이라 진행 불가.
        Preconditions.validate(
            moneyHoldRepository.countHeldByAuctionId(auctionId) == 0,
            SettlementErrorCode.SETTLEMENT_UNEXPECTED_HOLD);

        // (2) 아이템 반환(LISTED→INVENTORY/만실 TEMP, 소유자=판매자 불변). 별도 빈 경유 동일 TX 참여.
        ItemInstance item = itemInstanceRepository.findByIdOrThrow(
            auction.itemInstanceId(), SettlementErrorCode.SETTLEMENT_ITEM_TRANSFER_FAILED);
        inventoryService.releaseFromListing(item);

        // (3) 경매 종료 전이(종료성 CAS). result_type 은 NULL 유지(SOLD 아님).
        Preconditions.validate(
            auctionRepository.markUnsoldIfClosable(auctionId, now) == 1,
            SettlementErrorCode.SETTLEMENT_TERMINAL_TRANSITION_FAILED);
    }
}
