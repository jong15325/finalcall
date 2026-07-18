package com.finalcall.domain.item;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;

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
