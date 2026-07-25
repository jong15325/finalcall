package com.finalcall.domain.item.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.item.entity.ItemTemplate;

/**
 * 아이템 템플릿 리포지토리(item, FC-020). 카탈로그 검색 커스텀 쿼리는 {@link ItemTemplateRepositoryCustom}(QueryDSL).
 */
public interface ItemTemplateRepository
    extends JpaRepository<ItemTemplate, Long>, ItemTemplateRepositoryCustom {

    /** 외부 식별자(type_code)로 템플릿 조회. type_code 는 UK 라 최대 1건(035). */
    Optional<ItemTemplate> findByTypeCode(int typeCode);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default ItemTemplate findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
