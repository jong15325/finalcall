package com.finalcall.domain.delivery.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.delivery.repository.ItemDeliveryRepository;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.TempStorageRepository;

import lombok.RequiredArgsConstructor;

/**
 * 배송 라이프사이클(웹 쓰기 소유) 서비스(delivery, delivery-domain-spec §5.4·§6.1·§7.1, FC-188) — 소유 이동
 * (APPLIED→IN_GAME reconcile)·리스 만료 재청구(CLAIMED→PENDING sweep)·하드 실패 격리(→FAILED)를 담당한다.
 *
 * <p><b>쓰기 소유자(§5.4):</b> 게임은 {@code item_delivery} 의 claim/apply/defer 전이와 {@code user_item}(live
 * inventory)만 DB 직접 CAS 로 쓴다. 웹(finalcall)은 <b>{@code item_instance} 소유 정본</b>과 리스 재청구·하드 실패를
 * 소유한다 — 게임은 {@code item_instance} 를 절대 쓰지 않는다. 그래서 APPLIED 관측 후 IN_GAME 전이는 여기(웹) 소관이다.
 *
 * <p><b>금전 미역전(D-G):</b> 배송 실패(만실 DEFERRED·타임아웃 재청구·하드 FAILED)는 판매(sale_order·정산·수익
 * 원장·잔액)를 절대 되돌리지 않는다. 판매는 이미 완결됐고 아이템은 우편함/커스터디에 안전 보관되므로 역전은
 * 불필요·유해하다(총량 보존 I-H). 이 서비스의 어떤 메서드도 잔액·정산 테이블을 건드리지 않는다.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}, 쓰기 메서드만 오버라이드한다(CLAUDE.md §5). 각 쓰기는
 * 독립 트랜잭션이라 개별 실패가 배치 전체를 롤백하지 않는다(워커가 건별 try-catch 로 격리, {@link DeliveryLifecycleWorker}).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryLifecycleService {

    private final ItemDeliveryRepository itemDeliveryRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final TempStorageRepository tempStorageRepository;

    /**
     * APPLIED→IN_GAME 소유 이동(§5.4·§6.1·§9.2·D-F) — 게임 apply 성공(배송 APPLIED)을 관측해 대응
     * {@code item_instance} 를 IN_GAME 으로 전이시킨다(독립 TX). 웹·게임 이중 존재를 막고, 이관 아이템의 재판매를
     * 차단한다(IN_GAME XOR: slot_no NULL·temp_storage 없음·활성 리스팅 없음).
     *
     * <p><b>멱등(D-D 동류):</b> 이미 IN_GAME 이거나 배송이 APPLIED 가 아니면 무부작용 return 한다. 동시 reconcile 은
     * {@code markInGameIfInCustody} 조건부 CAS(WHERE location IN (INVENTORY,TEMP))가 단일 승자로 판정해 이중 전이가
     * 없다(패자는 0행). TEMP 였다면 연계 {@code temp_storage} 행을 같은 TX 로 삭제해 XOR 불변식을 지킨다. 금전 미역전.
     *
     * @param deliveryId APPLIED 배송 PK(reconcile 후보 스캔 {@code findAppliedPendingReconcile} 가 뽑은 id)
     */
    @Transactional
    @ServiceLog
    public void reconcileOne(Long deliveryId) {
        ItemDelivery delivery = itemDeliveryRepository.findById(deliveryId).orElse(null);
        if (delivery == null || delivery.getStatus() != DeliveryStatus.APPLIED) {
            return; // 배송이 사라졌거나 아직 APPLIED 가 아님 — 정상 skip(멱등)
        }
        ItemInstance item = itemInstanceRepository.findById(delivery.getItemInstanceId()).orElse(null);
        if (item == null || item.getLocation() == ItemLocation.IN_GAME) {
            return; // 이미 이관됨(동시/직전 reconcile) — 무부작용 skip(멱등)
        }

        // TEMP 였다면 연계 temp_storage 행 제거(IN_GAME ⇒ temp_storage 없음, spec §3.1 XOR). 서로 다른 테이블이라
        //   CAS 와의 flush 순서가 정합성에 영향 없다(커밋 시 함께 반영). INVENTORY 였다면 행이 없어 no-op.
        tempStorageRepository.findByInstanceId(item.getId()).ifPresent(tempStorageRepository::delete);

        // INVENTORY/TEMP→IN_GAME 조건부 CAS 단일 승자(slot_no 해제). 0행 = 동시 선점 패자/이미 이관됨 → 멱등 skip.
        itemInstanceRepository.markInGameIfInCustody(item.getId());
    }

    /**
     * 리스 만료 재청구 sweep(CLAIMED→PENDING, §5.2·§5.4·§9.1·D-D·D-H) — {@code claimed_at + lease} 를 넘긴 CLAIMED
     * 리스를 PENDING 으로 벌크 회수한다(게임 크래시 회수, at-least-once 원천). 조건부 벌크 CAS 라 다중 웹 인스턴스가
     * 동시에 돌려도 이중 회수가 없다. 이중 지급은 게임 {@code user_item.itm_uuid} UK 로 무해화된다(D-E). 금전 미역전.
     *
     * @param leaseExpiryThreshold 리스 만료 경계 시각(= now − lease). 이보다 이전 청구된 CLAIMED 만 회수
     * @return 이번 호출에 PENDING 으로 회수된 배송 행 수
     */
    @Transactional
    @ServiceLog
    public int reclaimExpiredLeases(Instant leaseExpiryThreshold) {
        return itemDeliveryRepository.reclaimExpiredLeases(leaseExpiryThreshold);
    }

    /**
     * 하드 실패 격리(→FAILED, §5.4·§7.1·D-G·D-H) — 스펙 불량·계정 밴·매핑 불가 usr_id 등 재청구로도 회복 불가능한
     * 배송을 FAILED 로 격리한다(관리자 개입 훅). 종착 상태(APPLIED·FAILED)는 격리 대상이 아니다({@code fail()} 가
     * 가드). <b>금전 미역전</b>: 판매·정산·잔액은 불변이며 아이템은 우편함/커스터디에 안전 보관된다. 관리자 절차의
     * 진입점이라 웹 REST 컨트롤러(배송 조회는 읽기 전용 §10.1)가 아닌 서비스 훅으로 노출한다.
     *
     * @param deliveryId 격리할 배송 PK
     * @return 격리 성립이면 true, 이미 종착이거나 배송 미존재면 false(무부작용)
     */
    @Transactional
    @ServiceLog
    public boolean markFailed(Long deliveryId) {
        ItemDelivery delivery = itemDeliveryRepository.findById(deliveryId).orElse(null);
        if (delivery == null) {
            return false;
        }
        return delivery.fail(); // dirty checking — 잔액·정산 미접촉(금전 미역전 D-G)
    }
}
