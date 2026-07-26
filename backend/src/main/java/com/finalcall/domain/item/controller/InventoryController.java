package com.finalcall.domain.item.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.item.dto.InventoryResponse;
import com.finalcall.domain.item.dto.RelocateRequest;
import com.finalcall.domain.item.dto.RelocateResponse;
import com.finalcall.domain.item.dto.TempStorageItemResponse;
import com.finalcall.domain.item.service.InventoryService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 인벤토리 컨트롤러(item, FC-022) — 계약 §4.2 {@code /api/v1/me/inventory}·{@code /me/temp-storage}.
 *
 * <p>{@code me} 접두는 인증 주체(SecurityContext) 기준 리소스다 — 경로에 사용자 식별자를 받지 않아 타인 인벤토리
 * 접근이 불가하다(IDOR 방지). 전부 인증 필요(SecurityConfig). 반환은 항상 {@link ApiResponse}, try-catch 금지.
 */
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    /** 내 정규 인벤토리(96칸) — 비페이지네이션 단일 응답, slotNo asc. */
    @GetMapping("/inventory")
    public ApiResponse<InventoryResponse> getInventory() {
        return ApiResponse.success(InventoryResponse.from(inventoryService.getMyInventory()));
    }

    /** 내 임시보관(오버플로우) — cursor 페이지((stored_at desc, instance_id desc)). */
    @GetMapping("/temp-storage")
    public ApiResponse<CursorResponse<TempStorageItemResponse, String>> getTempStorage(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.success(inventoryService.getMyTempStorage(cursor, size));
    }

    /**
     * 임시보관→정규 슬롯 이동(relocate) — 소유자·TEMP·용량 검증 후 이동. 성공 200 {@code { slotNo }}.
     * body 는 optional 이며 {@code slotNo} 미지정 시 빈 슬롯 자동 배정한다.
     */
    @PostMapping("/temp-storage/{itemInstancePublicId}/relocate")
    public ApiResponse<RelocateResponse> relocate(
        @PathVariable String itemInstancePublicId,
        @Valid @RequestBody(required = false) RelocateRequest request) {
        Integer requestedSlotNo = request == null ? null : request.slotNo();
        int slotNo = inventoryService.relocate(itemInstancePublicId, requestedSlotNo);
        return ApiResponse.success(new RelocateResponse(slotNo));
    }
}
