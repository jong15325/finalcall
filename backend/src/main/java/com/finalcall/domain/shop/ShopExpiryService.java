package com.finalcall.domain.shop;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.service.InventoryService;

import lombok.RequiredArgsConstructor;

/**
 * 고정가 만료 정산 서비스(shop, EPIC-SHOP) — 판매 기한이 지난 리스팅 1건을 EXPIRED 로 영속 전이하고 아이템을
 * 판매자 임시보관(TEMP)으로 회수한다. 경매 마감({@code CloseService})보다 훨씬 단순하다: 금전 이동·정산이 없고
 * 아이템 회수만 한다.
 *
 * <h2>직렬화·idempotency 설계(shop-spec §4.4)</h2>
 * {@link #expireOne} 은 리스팅 1건 = 독립 트랜잭션이다. 진입 즉시 shop 행에 배타 락({@code FOR UPDATE})을 걸어
 * 구매·취소와 동일 행을 잡는다. idempotency 의 핵심은 <b>행 락 하 재검증 + 종료성 CAS</b>다: 두 워커 인스턴스가
 * 같은 리스팅을 동시에 집어도 먼저 락을 쥔 쪽이 EXPIRED 로 전이·커밋하면, 뒤이어 락을 얻은 쪽은 재검증에서
 * {@code status ≠ ACTIVE} 를 보고 조용히 return 한다(부작용 0, S-F). 분산락 불요.
 *
 * <h2>★ 회수 목적지 = TEMP 직행(소유자 불변)</h2>
 * 취소(인벤토리 복귀 우선)와 비대칭이다 — 만료는 워커 자동 처리라 판매자가 슬롯을 관리하지 않고, 한 tick 에 다수
 * 리스팅이 만료될 때 슬롯 경합·{@code slot_key} UK flush 를 원천 없애기 위해 TEMP(슬롯 없음)로 직행한다
 * ({@link InventoryService#recoverExpiredToTemp}, §4.4). 잔액 이동이 없어 PC clear 함정도 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopExpiryService {

    private final ShopRepository shopRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final InventoryService inventoryService;

    /**
     * 고정가 1건을 만료 처리한다(독립 트랜잭션). shop 행 배타 락 → 재검증 → 아이템 TEMP 회수 → 종료성 CAS.
     *
     * <p>재검증이 idempotency·경합(구매·취소 선점)·다중 인스턴스 안전을 한꺼번에 처리한다: 이미 종결됐거나 무기한이
     * 됐으면 무부작용 return 한다(S-F·S-G). 아이템 회수(TEMP)를 CAS 보다 먼저 두어 회수 실패를 먼저 표면화한다
     * (settleUnsold 선례 동형 — 단일 TX 라 순서가 바뀌어도 정합성은 동일).
     *
     * @param shopId 만료 대상 고정가 PK(후보 스캔 {@code findExpirableIds} 가 뽑은 id)
     * @param now    만료 판정 기준 시각(한 tick 의 스캔 시각)
     */
    @Transactional
    @ServiceLog
    public void expireOne(Long shopId, Instant now) {
        // 1) shop 행 배타 락 + 값 스냅샷. 이 시점부터 커밋까지 동일 고정가의 구매·취소는 여기서 대기한다.
        ShopExpireContext shop = shopRepository.findExpireContextForUpdate(shopId).orElse(null);
        if (shop == null) {
            return; // 리스팅이 삭제됨 — 정상 skip
        }

        // 2) 재검증(락 스냅샷 근거). 이미 종결됐거나(구매·취소 선점) 무기한/기한 전이면 무부작용 return.
        boolean expirable = shop.status() == ShopStatus.ACTIVE
            && shop.endAt() != null && !shop.endAt().isAfter(now);
        if (!expirable) {
            return;
        }

        // 3) 아이템 회수(LISTED→TEMP 무조건, 소유자 불변). 별도 빈 경유 동일 TX 참여.
        ItemInstance item = itemInstanceRepository.findByIdOrThrow(
            shop.itemInstanceId(), CommonErrorCode.INTERNAL_ERROR);
        inventoryService.recoverExpiredToTemp(item);

        // 4) 종료성 CAS(ACTIVE ∧ end_at IS NOT NULL ∧ end_at<=now → EXPIRED). 0행 = 이미 종결 = 불변식 위반 → 롤백.
        Preconditions.validate(
            shopRepository.markShopExpiredIfExpirable(shopId, now) == 1, CommonErrorCode.INTERNAL_ERROR);
    }
}
