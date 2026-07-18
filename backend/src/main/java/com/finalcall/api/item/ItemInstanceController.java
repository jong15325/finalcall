package com.finalcall.api.item;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.item.ItemInstanceService;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 인스턴스 컨트롤러(item, FC-021) — 계약 §4.1 {@code GET /api/v1/items/{itemInstancePublicId}}.
 *
 * <p>인증 optional(공개 범위 + 소유자 부가정보). 없는 인스턴스는 ITEM_001(404). 반환은 항상 {@link ApiResponse}.
 * 소유 여부 판정·소유자 전용 필드 노출은 서비스가 SecurityContext 로 결정한다(IDOR 방지).
 */
@RestController
@RequestMapping("/api/v1/items")
@RequiredArgsConstructor
public class ItemInstanceController {

    private final ItemInstanceService itemInstanceService;

    @GetMapping("/{itemInstancePublicId}")
    public ApiResponse<ItemInstanceDetailResponse> get(@PathVariable String itemInstancePublicId) {
        return ApiResponse.success(
            ItemInstanceDetailResponse.from(itemInstanceService.getDetail(itemInstancePublicId)));
    }
}
