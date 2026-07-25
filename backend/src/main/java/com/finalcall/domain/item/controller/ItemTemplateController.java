package com.finalcall.domain.item.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.item.dto.ItemTemplateResponse;
import com.finalcall.domain.item.entity.ItemTemplateSearchCondition;
import com.finalcall.domain.item.service.ItemTemplateService;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 카탈로그 컨트롤러(item, FC-020) — 계약 §4.1 {@code GET /api/v1/item-templates}.
 *
 * <p>인증 불요(마스터 데이터, 공개). 오프셋 페이지네이션(카탈로그는 소규모·안정, spec §5.1). 반환은 항상
 * {@link ApiResponse}, 정렬은 서비스/리포지토리가 typeCode asc 로 고정한다(외부 sort 미신뢰).
 */
@RestController
@RequestMapping("/api/v1/item-templates")
@RequiredArgsConstructor
public class ItemTemplateController {

    private final ItemTemplateService itemTemplateService;

    /** 카탈로그 검색(offset 페이지). 필터 축은 전부 optional 화이트리스트(등급 없음, D-073). */
    @GetMapping
    public ApiResponse<Page<ItemTemplateResponse>> getCatalog(
        @RequestParam(required = false) Integer mainCategory,
        @RequestParam(required = false) Integer subGroup,
        @RequestParam(required = false) Integer element,
        @RequestParam(required = false) Integer kind,
        Pageable pageable) {
        ItemTemplateSearchCondition condition = new ItemTemplateSearchCondition(mainCategory, subGroup, element, kind);
        return ApiResponse.success(itemTemplateService.getCatalog(condition, pageable).map(ItemTemplateResponse::from));
    }
}
