package com.finalcall.domain.settlement;

import java.time.Instant;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.item.InventoryService;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemOwnershipHistory;
import com.finalcall.domain.item.ItemOwnershipHistoryRepository;
import com.finalcall.domain.item.TransferType;
import com.finalcall.domain.member.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 판매 성립(SOLD) 정산의 <b>공통 꼬리(잔액 외 기록)</b>를 단일화하는 컴포넌트(settlement, purchase-spec §6-A).
 * 마감 낙찰({@link CloseService})과 즉시구매({@code PurchaseService})가 공유하는 <b>sale_order INSERT → 수익 원장
 * INSERT → 아이템 이전 → 소유 이력 append</b> 를 여기 한 곳에 응집한다.
 *
 * <p><b>잔액 이동은 recorder 밖(호출 측)에 있다(A4 락 순서 규율).</b> 판매자 크레딧을 포함한 모든 {@code user_balance}
 * 갱신은 <b>{@code user_id} 오름차순</b>으로 획득해야 데드락이 없다(MoneyHoldService §4.4). 즉시구매는 buyer·seller·
 * loser 최대 3개 잔액 행을 건드리므로 그 정렬을 호출 측이 관장해야 한다 — 그래서 판매자 크레딧을 recorder 에서
 * 빼내 호출 측(정렬된 잔액 단계)으로 옮기고, recorder 는 <b>잔액을 건드리지 않는 기록</b>만 담당한다. 마감 경로도
 * 대칭으로 판매자 크레딧을 {@link CloseService} 가 수행한다(winner capture → seller credit 순서 무회귀 유지).
 *
 * <p><b>단일화하는 이유</b>: 이 구간이 곧 게임머니 총량 보존(I-H·P-H)·수수료 정합(I-B·P-B)을 지는 임계 코드다.
 * 두 경로에 복제하면 드리프트 표면이 생긴다. 진입(동기 vs 워커)·머니-인·패자 처리·result_type·종료성 CAS 시간조건은
 * 경로별로 다르므로 <b>머리(head)는 분리</b>하고, 잔액 외 공통 꼬리만 이 recorder 로 모은다. EPIC-SHOP 도 재사용.
 *
 * <p><b>{@code Propagation.MANDATORY}</b> — 반드시 호출자(마감·즉시구매 TX)에 참여한다. 정산 꼬리가 자체 TX 로
 * 독립 커밋되면 머리(차감·전이)와 원자성이 깨진다. 트랜잭션 없이 호출하면 런타임에 즉시 실패하므로 그런 배선이
 * 배포까지 가지 못한다({@code MoneyHoldService} 선례).
 *
 * <p><b>★ PC clear 함정(closing §4.2 승계)</b>: 호출 측 잔액 갱신({@code increaseGameMoney} 등)이
 * {@code clearAutomatically} 라 영속성 컨텍스트를 비운 <b>뒤</b> 이 recorder 가 실행된다. 따라서 모든 기록은 fresh
 * INSERT({@code getReferenceById} FK 프록시)·{@code @Modifying} CAS 로만 수행한다 — dirty-checking 에 의존하지 않는다.
 * 판정 근거(id·금액)는 전부 원시 인자로 받아 clear 사정권 밖이다.
 */
@Component
@RequiredArgsConstructor
public class SettlementRecorder {

    private final UserRepository userRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final SaleOrderRepository saleOrderRepository;
    private final PlatformRevenueLedgerRepository platformRevenueLedgerRepository;
    private final ItemOwnershipHistoryRepository itemOwnershipHistoryRepository;
    private final InventoryService inventoryService;

    /**
     * 정산 공통 꼬리(잔액 외 기록)를 원자적으로 기록한다. <b>전제</b>: 호출 측이 이미 잔액 이동(구매자 차감·판매자
     * 크레딧·패자 해제)을 {@code user_id} 오름차순으로 마쳤다(A4). 그 잔액 갱신이 PC 를 clear 한 뒤이므로 여기서는
     * fresh INSERT/CAS 만 수행하고, sale_order INSERT 를 수익 원장·소유 이력보다 앞세워 그 id 를 참조하게 한다.
     * {@code (source_type, source_id)} UK 가 동일 리스팅의 이중 SOLD 를 sale_order INSERT 시점에 차단하고(I-C·P-C),
     * {@code platform_revenue_ledger.sale_order_id} UK 가 수수료 이중 적립을 차단한다(I-H·P-H).
     *
     * @param sourceType     정산 출처(코어는 {@code AUCTION})
     * @param sourceId       출처 리스팅 id(= auction.id)
     * @param buyerId        구매자 PK(낙찰자·즉시구매자)
     * @param sellerId       판매자 PK
     * @param itemInstanceId 이전 대상 아이템 PK
     * @param finalPrice     최종가(낙찰가·즉시구매가). {@code = settle + fee}
     * @param fee            플랫폼 수수료(계산기 1회 산출값 — 재계산 없이 그대로 기재)
     * @param settle         판매자 정산액 {@code = finalPrice − fee}
     * @param version        적용 수수료 정책 버전 스냅샷
     * @param now            정산 완료 시각(settled_at·transferred_at)
     * @return 생성된 거래 레코드(sale_order) — 호출 측이 {@code publicId}·{@code id} 로 응답·후속 참조에 쓴다
     */
    @ServiceLog
    @Transactional(propagation = Propagation.MANDATORY)
    public SaleOrder record(SaleOrderSourceType sourceType, Long sourceId, Long buyerId, Long sellerId,
        Long itemInstanceId, long finalPrice, long fee, long settle, String version, Instant now) {
        // (1) 거래 레코드. (source_type, source_id) UK 가 동일 리스팅 이중 SOLD 를 여기서 차단한다(I-C·P-C). id 획득.
        SaleOrder order = saleOrderRepository.saveAndFlush(SaleOrder.builder()
            .sourceType(sourceType)
            .sourceId(sourceId)
            .buyer(userRepository.getReferenceById(buyerId))
            .seller(userRepository.getReferenceById(sellerId))
            .itemInstance(itemInstanceRepository.getReferenceById(itemInstanceId))
            .finalPrice(finalPrice)
            .feeAmount(fee)
            .settleAmount(settle)
            .feePolicyVersion(version)
            .settledAt(now)
            .build());
        Long orderId = order.getId();

        // (2) 사업자 수익 적립(④-C). sale_order_id UK 가 수수료 이중 적립을 차단한다(I-H·P-H 정합). fee 는 재계산 없음.
        platformRevenueLedgerRepository.saveAndFlush(PlatformRevenueLedger.builder()
            .saleOrder(saleOrderRepository.getReferenceById(orderId))
            .amount(fee)
            .feePolicyVersion(version)
            .build());

        // (3) 아이템 소유 이전(owner→buyer, LISTED→INVENTORY/만실 TEMP). 별도 빈 경유(self-invocation 아님).
        inventoryService.transferListedToBuyer(itemInstanceId, buyerId);

        // (4) 소유 이력 append(seller→buyer, TRADE, sale_order_id). TransferType.TRADE(closing §4.4).
        itemOwnershipHistoryRepository.saveAndFlush(ItemOwnershipHistory.builder()
            .instanceId(itemInstanceId)
            .fromOwnerId(sellerId)
            .toOwnerId(buyerId)
            .transferType(TransferType.TRADE)
            .saleOrderId(orderId)
            .transferredAt(now)
            .build());

        return order;
    }
}
