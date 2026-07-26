package com.finalcall.domain.shop.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.SettlementErrorCode;
import com.finalcall.common.exception.ShopErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.settlement.FeePolicyProperties;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.settlement.service.FeeCalculator;
import com.finalcall.domain.settlement.service.SettlementRecorder;
import com.finalcall.domain.shop.dto.ShopPurchaseResult;
import com.finalcall.domain.shop.entity.ShopPurchaseContext;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.repository.ShopRepository;

import lombok.RequiredArgsConstructor;

/**
 * 고정가 구매 서비스(shop, EPIC-SHOP) — "입찰 없는 즉시 SOLD"(shop-spec §1). money·concurrency 최고위험 구간이다.
 * 즉시구매({@code PurchaseService})의 <b>더 단순한 변주</b>다: 입찰·홀드·패자 처리·시간축 배타 분할의 복잡성이 없고
 * 잔액 이동이 <b>buyer·seller 2행뿐</b>이다. 정산 꼬리는 경매·즉시구매와 완전히 같아 {@link SettlementRecorder} 를
 * 그대로 재사용한다(source_type=SHOP).
 *
 * <h2>직렬화 설계(shop-spec §4.1)</h2>
 * 구매는 shop 행을 {@code FOR UPDATE} 로 잡는다. 구매·취소·만료가 한 행에서 직렬화되므로 별도 조정이 불요하다 —
 * 종료성 CAS 의 시간 조건({@code end_at > now} live vs 만료 워커 {@code end_at <= now} expired)이 시간축을 배타
 * 분할해 경계 리스팅이 한쪽으로만 종결된다(§4.1·S-G).
 *
 * <h2>★ 영속성 컨텍스트 clear 함정(§4.1)</h2>
 * {@link UserBalanceRepository#decreaseGameMoney}(구매자 차감)·{@code increaseGameMoney}(판매자 크레딧)·
 * {@link SettlementRecorder}(정산 꼬리)가 영속성 컨텍스트를 비운다. 따라서 (1) 판정 근거는 락 스냅샷
 * ({@link ShopPurchaseContext})으로 전부 값 복사하고, (2) 이후 전이는 {@code @Modifying} CAS·fresh INSERT 로만
 * 수행한다(스칼라 프로젝션이라 애초에 detach 함정이 없다).
 *
 * <h2>잔액 락 순서(§4.1·A4 규율)</h2>
 * buyer·seller 2행뿐이고 자기구매 차단으로 {@code buyer ≠ seller} 라 겹침이 없다. {@code user_id} 오름차순 적용으로
 * 교차거래(두 사용자가 서로의 리스팅 동시 구매) 데드락을 원천 차단한다(purchase-spec §7-A4 규율 재사용). 즉시구매
 * (최대 3행·loser 분기)보다 단순하다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopPurchaseService {

    private final ShopRepository shopRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final SettlementRecorder settlementRecorder;
    private final FeeCalculator feeCalculator;
    private final FeePolicyProperties feePolicy;

    /**
     * 고정가 구매를 수용한다(계약 §3.2 {@code POST /shops/{id}/purchase}). shop 행 배타 락 아래에서 재검증 →
     * 수수료 1회 → 잔액 이동(buyer/seller user_id 오름차순) → 정산 꼬리 → 종료성 CAS 를 원자적으로 수행한다.
     * 요청 본문 없음(금액=서버 shop.price 확정, 클라이언트 금액 신뢰 없음).
     *
     * @param shopPublicId 대상 고정가(구매자는 SecurityContext 주체)
     * @return 생성된 주문의 외부 식별자·최종 결제가(= shop.price)
     * @throws BusinessException {@code SHOP_003}(404 없음)·{@code SHOP_004}(409 이미 판매·종료)·
     *                           {@code SHOP_005}(422 잔액 부족)·{@code SHOP_006}(403 자기구매)
     */
    @Transactional
    @ServiceLog
    public ShopPurchaseResult purchase(String shopPublicId) {
        Long buyerId = currentUserId();
        Instant now = Instant.now();

        // 1) shop 행 배타 락 + 값 스냅샷. 이 시점부터 커밋까지 동일 고정가의 다른 구매·취소·만료는 여기서 대기한다.
        ShopPurchaseContext shop = shopRepository.findPurchaseContextForUpdate(shopPublicId)
            .orElseThrow(() -> new BusinessException(ShopErrorCode.SHOP_NOT_FOUND));

        // 2) 재검증 — 전부 락 스냅샷 근거(§4.1). 자기구매(wash trade·SEC-003) → SHOP_006. live 실패(판매·종료) → SHOP_004.
        Preconditions.validate(!buyerId.equals(shop.sellerId()), ShopErrorCode.SHOP_SELF_PURCHASE);
        Preconditions.validate(isLive(shop, now), ShopErrorCode.SHOP_ALREADY_SOLD_OR_CLOSED);

        long price = shop.price();

        // 3) 수수료 계산 1회(순수 함수). settle = price − fee, 항상 final=settle+fee(S-B). shop.price 기준 동일 계산기.
        long fee = feeCalculator.compute(price);
        long settle = price - fee;
        String version = feePolicy.version();

        // 4) 잔액 이동을 user_id 오름차순으로 적용한다(§4.1 데드락 방지, A4 규율 재사용). ★ PC clear.
        applyBalanceInUserIdOrder(buyerId, shop.sellerId(), price, settle);

        // 5) 정산 공통 꼬리(잔액 외: sale_order → 수익 원장 → 아이템 이전 → 소유 이력)를 recorder 에 위임(source=SHOP).
        //    (source_type=SHOP, source_id=shop.id) UK 가 동일 리스팅의 이중 SOLD 를 sale_order INSERT 시점에 차단한다(S-C).
        SaleOrder order = settlementRecorder.record(
            SaleOrderSourceType.SHOP, shop.id(), buyerId, shop.sellerId(), shop.itemInstanceId(),
            price, fee, settle, version, now);

        // 6) 종료성 CAS(live). status=SOLD. end_at IS NULL OR end_at > now 라 만료 워커와 시간축 배타(§4.1·S-G).
        //    0행 = 다른 구매자·취소·만료가 선점 = 불변식 위반(재검증이 앞서므로 정상 경로에서 항상 1행) → 롤백.
        Preconditions.validate(
            shopRepository.markShopSoldIfPurchasable(shop.id(), now) == 1,
            SettlementErrorCode.SETTLEMENT_TERMINAL_TRANSITION_FAILED);

        return new ShopPurchaseResult(order.getPublicId(), price);
    }

    /**
     * 잔액 이동(구매자 차감·판매자 크레딧)을 <b>{@code user_id} 오름차순</b>으로 적용한다(§4.1·A4). buyer·seller 2행뿐
     * 이고 자기구매 차단으로 {@code buyer ≠ seller} 라 두 스텝은 서로 다른 행이다. 서로 다른 두 리스팅에서 두 사용자가
     * 교차로 상대의 리스팅을 구매하면 락 순서가 역전돼 순환 대기(InnoDB 데드락)가 성립할 수 있는데 — shop 행 락은
     * 서로 다른 행이라 이를 막지 못한다 — 전역 순서를 {@code user_id} 오름차순 하나로 고정하면 순환이 성립할 수 없다
     * (purchase-spec §7-A4 규율 재사용). 즉시구매의 loser 분기가 없어 2행 버전이다.
     */
    private void applyBalanceInUserIdOrder(Long buyerId, Long sellerId, long price, long settle) {
        List<BalanceStep> steps = new ArrayList<>(2);
        // 구매자 스텝: 가용 게임머니 직접 차감(홀드 미경유). 0행 = 잔액 부족 → SHOP_005.
        steps.add(new BalanceStep(buyerId, () -> Preconditions.validate(
            userBalanceRepository.decreaseGameMoney(buyerId, price) == 1, ShopErrorCode.SHOP_INSUFFICIENT_BALANCE)));
        // 판매자 스텝: 정산 크레딧. 0행 = 잔액 행 부재 = 불변식 위반.
        steps.add(new BalanceStep(sellerId, () -> Preconditions.validate(
            userBalanceRepository.increaseGameMoney(sellerId, settle) == 1,
            SettlementErrorCode.SETTLEMENT_SELLER_CREDIT_FAILED)));
        steps.sort(Comparator.comparingLong(BalanceStep::userId));
        steps.forEach(step -> step.action().run());
    }

    /** user_id 오름차순 정렬을 위한 잔액 갱신 스텝(§4.1). buyer ≠ seller 라 두 스텝의 user_id 는 서로 다르다. */
    private record BalanceStep(long userId, Runnable action) {
    }

    /**
     * live 판정(§4.1) — ACTIVE 이고 아직 판매 기한 전({@code end_at == null || now < end_at})이다. 무기한(NULL)은
     * 항상 구매 가능하다. 만료 워커의 {@code end_at <= now}(expired)와 시간축을 배타 분할한다.
     */
    private boolean isLive(ShopPurchaseContext shop, Instant now) {
        return shop.status() == ShopStatus.ACTIVE
            && (shop.endAt() == null || now.isBefore(shop.endAt()));
    }

    /** 인증 주체(내부 PK). 인증 필요 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009, IDOR 차단). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
