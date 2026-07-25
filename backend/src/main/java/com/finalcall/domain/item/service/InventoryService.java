package com.finalcall.domain.item.service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.item.InventoryErrorCode;
import com.finalcall.domain.item.ItemErrorCode;
import com.finalcall.domain.item.dto.InventoryData;
import com.finalcall.domain.item.dto.TempStorageSlice;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.TempStorage;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.TempStorageRepository;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 인벤토리 서비스(item, FC-022) — 정규 인벤토리(96칸) 조회·임시보관 커서 조회·relocate(TEMP→INVENTORY).
 *
 * <p>주체는 SecurityContext 기준이다(B-009, IDOR 방지 — 타인 인벤토리 접근 불가). 클래스 레벨
 * {@code @Transactional(readOnly = true)}, relocate 만 쓰기로 오버라이드한다(CLAUDE.md §5).
 *
 * <p><b>동시성(concurrency-review):</b> relocate 는 앱 선검사(용량·슬롯 점유) + DB slot_key UK(spec §3.2)의
 * 이중 방어다. 서로 다른 두 아이템을 같은 슬롯으로 동시에 옮기면 앱 선검사를 함께 통과할 수 있으나, 커밋 전
 * 강제 flush 시 {@code uk_item_instance_slot} 위반으로 한쪽만 성공하고 나머지는 INV_002 로 매핑된다(이중 배정 차단).
 * 커밋 시점 flush 는 서비스 밖(전역 핸들러 500)이라 이 계층에서 flush 를 강제해 위반을 잡는다(MemberService 선례).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryService {

    /** 정규 인벤토리 용량(96칸 = slot_no 0~95). 스키마 컬럼이 아니라 앱 상수다(spec §3.3). */
    private static final int CAPACITY = 96;

    private final ItemInstanceRepository itemInstanceRepository;
    private final TempStorageRepository tempStorageRepository;
    private final UserRepository userRepository;

    @ServiceLog
    public InventoryData getMyInventory() {
        Long userId = currentUserId();
        List<ItemInstance> items = itemInstanceRepository.findInventory(userId);
        return new InventoryData(CAPACITY, items);
    }

    @ServiceLog
    public TempStorageSlice getMyTempStorage(String cursor, int size) {
        Long userId = currentUserId();
        TempStorageCursor decoded = TempStorageCursor.decode(cursor);
        List<TempStorage> fetched = tempStorageRepository.findByCursor(userId, decoded.storedAt(), decoded.instanceId(),
            size);

        boolean hasNext = fetched.size() > size;
        List<TempStorage> content = hasNext ? fetched.subList(0, size) : fetched;
        String nextCursor = content.isEmpty() ? null : encodeLast(content);
        return new TempStorageSlice(content, nextCursor, hasNext);
    }

    /**
     * 임시보관 아이템을 정규 슬롯으로 이동한다(계약 §4.2, 단일 TX). 소유자·TEMP 검증 → 슬롯 확보(자동/명시) →
     * location TEMP→INVENTORY + slot_no 세팅 → temp_storage 행 삭제. 최종 정합성은 slot UK 가 보증한다.
     *
     * @param requestedSlotNo 명시 슬롯(null 이면 최소 빈 슬롯 자동 배정). 범위 검증(0~95)은 요청 DTO 가 담당한다.
     * @return 확정된 slot_no
     */
    @Transactional
    @ServiceLog
    public int relocate(String itemInstancePublicId, Integer requestedSlotNo) {
        Long userId = currentUserId();
        ItemInstance instance = itemInstanceRepository.findByPublicId(itemInstancePublicId)
            .orElseThrow(() -> new BusinessException(ItemErrorCode.ITEM_NOT_FOUND));
        Preconditions.validate(instance.isOwnedBy(userId), ItemErrorCode.ITEM_NOT_OWNER);
        Preconditions.validate(instance.getLocation() == ItemLocation.TEMP, ItemErrorCode.ITEM_NOT_IN_TEMP);

        long used = itemInstanceRepository.countByOwnerIdAndLocation(userId, ItemLocation.INVENTORY);
        Preconditions.validate(used < CAPACITY, InventoryErrorCode.INVENTORY_FULL);

        int targetSlot = resolveSlot(userId, requestedSlotNo);

        TempStorage temp = tempStorageRepository.findByInstanceId(instance.getId())
            // 불변식: location=TEMP 면 temp_storage 행이 존재한다. 부재는 깨진 상태라 위치 불일치로 처리한다.
            .orElseThrow(() -> new BusinessException(ItemErrorCode.ITEM_NOT_IN_TEMP));

        instance.placeInInventory(targetSlot); // location INVENTORY + slot_no 세팅(dirty checking)
        tempStorageRepository.delete(temp); // TEMP 행 제거(동일 TX)
        try {
            itemInstanceRepository.flush(); // 커밋 전 강제 flush — 이중 배정 UK 위반을 이 계층에서 매핑
        } catch (DataIntegrityViolationException ex) {
            throw toSlotConflict(ex);
        }
        return targetSlot;
    }

    /**
     * 출품(LISTED) 아이템의 에스크로를 해제한다(auction 취소·유찰 복귀 경로, FC-028 신규 §4.2 — relocate 와 방향 반대).
     * 소유자 인벤토리에 여유가 있으면 빈 슬롯으로 복귀(LISTED→INVENTORY), 만실(96칸)이면 임시보관(LISTED→TEMP)한다.
     *
     * <p>호출 측(취소) 트랜잭션에 참여한다(propagation REQUIRED — 별도 빈이라 프록시 경유, self-invocation 아님).
     * 따라서 실패 시 취소 CAS 까지 함께 롤백된다(부록 C 락-트랜잭션 순서 정합). 슬롯 정합성의 최종 방어선은
     * slot_key UK(spec §3.2)이며, 동시 복귀가 같은 빈 슬롯을 노려도 커밋 전 flush 시 하나만 성공한다(나머지 INV_002).
     *
     * @param instance LISTED 상태의 managed 인스턴스(소유자=출품 판매자). 상태 선검사는 호출 측 책임이다.
     */
    @Transactional
    public void releaseFromListing(ItemInstance instance) {
        Long ownerId = instance.getOwner().getId();
        long used = itemInstanceRepository.countByOwnerIdAndLocation(ownerId, ItemLocation.INVENTORY);
        if (used >= CAPACITY) {
            instance.moveToTemp(); // 만실 오버플로우 — 상한 없음(spec §2.5)
            tempStorageRepository.save(TempStorage.builder()
                .instance(instance).ownerId(ownerId).storedAt(Instant.now()).build());
            return;
        }
        int targetSlot = resolveSlot(ownerId, null); // 빈 슬롯 자동 배정
        instance.placeInInventory(targetSlot);
        try {
            itemInstanceRepository.flush(); // 커밋 전 강제 flush — 동시 복귀 이중 배정 UK 위반을 이 계층에서 매핑
        } catch (DataIntegrityViolationException ex) {
            throw toSlotConflict(ex);
        }
    }

    /**
     * 출품(LISTED) 아이템을 낙찰자에게 이전한다(SOLD 정산 경로, closing-domain-spec §4.4 — releaseFromListing 과
     * 방향 반대: 소유자가 <b>바뀐다</b>). 낙찰자 인벤토리에 여유가 있으면 빈 슬롯으로(LISTED→INVENTORY),
     * 만실(96칸)이면 임시보관으로(LISTED→TEMP) 옮긴다. 소유 이력({@code item_ownership_history}) append 는 호출
     * 측(정산 TX)이 {@code sale_order_id} 와 함께 기록한다.
     *
     * <p>호출 측(SOLD TX)에 참여한다({@code Propagation.MANDATORY} — 별도 빈이라 프록시 경유, self-invocation 아님).
     * SOLD TX 는 잔액 조건부 UPDATE 가 영속성 컨텍스트를 clear 한 뒤 이 메서드를 호출하므로 dirty-checking 이 아니라
     * {@code @Modifying} CAS({@code transferListedToInventory}/{@code transferListedToTemp})로 전이한다(§4.2).
     * 슬롯 정합성의 최종 방어선은 {@code slot_key} UK 다.
     *
     * @param instanceId 출품(LISTED) 아이템 PK
     * @param winnerId   낙찰자 PK(신규 소유자)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void transferListedToBuyer(Long instanceId, Long winnerId) {
        long used = itemInstanceRepository.countByOwnerIdAndLocation(winnerId, ItemLocation.INVENTORY);
        if (used >= CAPACITY) {
            int moved = itemInstanceRepository.transferListedToTemp(
                instanceId, userRepository.getReferenceById(winnerId));
            Preconditions.validate(moved == 1, CommonErrorCode.INTERNAL_ERROR);
            tempStorageRepository.save(TempStorage.builder()
                .instance(itemInstanceRepository.getReferenceById(instanceId))
                .ownerId(winnerId).storedAt(Instant.now()).build());
            return;
        }
        int targetSlot = resolveSlot(winnerId, null); // 빈 슬롯 자동 배정
        int moved = itemInstanceRepository.transferListedToInventory(
            instanceId, userRepository.getReferenceById(winnerId), targetSlot);
        Preconditions.validate(moved == 1, CommonErrorCode.INTERNAL_ERROR);
        try {
            itemInstanceRepository.flush(); // 커밋 전 강제 flush — 이중 배정 UK 위반을 이 계층에서 매핑
        } catch (DataIntegrityViolationException ex) {
            throw toSlotConflict(ex);
        }
    }

    /**
     * 만료된 출품(LISTED) 아이템을 임시보관으로 <b>무조건</b> 회수한다(shop 만료 경로, shop-spec §4.4 — 소유자 불변).
     * {@link #releaseFromListing}(인벤토리 복귀 우선, 만실 시 TEMP)의 만실 분기를 무조건화한 형태다: 워커 자동
     * 처리라 판매자가 슬롯을 관리하지 않고, 한 tick 에 다수 리스팅이 만료될 때 슬롯 해석·{@code slot_key} UK flush
     * 경합을 원천 없애기 위해 TEMP(슬롯 없음)로 직행한다. 판매자는 다음 방문 시 기존 {@code relocate}(TEMP→INVENTORY)로
     * 되돌린다. 소유자는 바뀌지 않는다({@code moveToTemp} — LISTED→TEMP, owner 불변).
     *
     * <p>호출 측(만료 TX)에 참여한다(propagation REQUIRED — 별도 빈이라 프록시 경유, self-invocation 아님). 따라서
     * 실패 시 만료 CAS 까지 함께 롤백된다. 만료 절차는 잔액 이동이 없어 PC clear 가 없으므로 dirty-checking
     * ({@code moveToTemp})을 그대로 쓴다({@code settleUnsold} 의 {@code releaseFromListing} 선례와 동형).
     *
     * @param instance LISTED 상태의 managed 인스턴스(소유자=출품 판매자). 상태 선검사는 호출 측 책임이다.
     */
    @Transactional
    public void recoverExpiredToTemp(ItemInstance instance) {
        Long ownerId = instance.getOwner().getId();
        instance.moveToTemp(); // LISTED→TEMP, slot_no 해제, 소유자 불변. temp_storage 는 상한 없음(spec §2.5)이라 슬롯 경합 없음.
        tempStorageRepository.save(TempStorage.builder()
            .instance(instance).ownerId(ownerId).storedAt(Instant.now()).build());
    }

    /** 명시 슬롯이면 점유 선검사, 미지정이면 최소 빈 슬롯을 자동 배정한다. */
    private int resolveSlot(Long userId, Integer requestedSlotNo) {
        if (requestedSlotNo != null) {
            Preconditions.validate(
                !itemInstanceRepository.existsByOwnerIdAndLocationAndSlotNo(
                    userId, ItemLocation.INVENTORY, requestedSlotNo),
                InventoryErrorCode.SLOT_OCCUPIED);
            return requestedSlotNo;
        }
        Set<Integer> occupied = new HashSet<>(itemInstanceRepository.findOccupiedSlotNos(userId));
        for (int slot = 0; slot < CAPACITY; slot++) {
            if (!occupied.contains(slot)) {
                return slot;
            }
        }
        // 용량 선검사(used < CAPACITY)를 통과했다면 빈 슬롯이 반드시 있으므로 도달하지 않는다(방어적).
        throw new BusinessException(InventoryErrorCode.INVENTORY_FULL);
    }

    /**
     * slot 유일성 UK({@code uk_item_instance_slot}) 위반을 INV_002(409)로 변환한다(동시 이중 배정 방어선).
     * 그 외 무결성 위반은 원본을 유지해 전역 핸들러(500)가 처리한다.
     */
    private BusinessException toSlotConflict(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause().getMessage();
        String lower = cause == null ? "" : cause.toLowerCase(Locale.ROOT);
        if (lower.contains("uk_item_instance_slot")) {
            return new BusinessException(InventoryErrorCode.SLOT_OCCUPIED);
        }
        throw ex;
    }

    private String encodeLast(List<TempStorage> content) {
        TempStorage last = content.get(content.size() - 1);
        return TempStorageCursor.encode(last.getStoredAt(), last.getInstance().getId());
    }

    /** 인증 주체(내부 PK)를 해석한다. {@code /me/**} 는 SecurityConfig 가 인증을 강제하므로 항상 존재한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
