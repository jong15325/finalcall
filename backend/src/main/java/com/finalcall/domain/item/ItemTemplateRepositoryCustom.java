package com.finalcall.domain.item;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * 아이템 템플릿 커스텀 쿼리 계약(item, FC-020, QueryDSL 구현은 {@link ItemTemplateRepositoryImpl}).
 */
public interface ItemTemplateRepositoryCustom {

    /**
     * 카탈로그 오프셋 페이지 조회(계약 §4.1). 필터 축은 화이트리스트(spec §5.1), 정렬은 typeCode asc 고정.
     * content 쿼리와 count 쿼리를 분리한다.
     */
    Page<ItemTemplate> search(ItemTemplateSearchCondition condition, Pageable pageable);
}
