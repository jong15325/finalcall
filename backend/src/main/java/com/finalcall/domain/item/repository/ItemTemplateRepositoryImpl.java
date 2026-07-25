package com.finalcall.domain.item.repository;

import static com.finalcall.domain.item.entity.QItemTemplate.itemTemplate;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.ItemTemplateSearchCondition;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 템플릿 카탈로그 검색 QueryDSL 구현(item, FC-020).
 *
 * <p>정렬은 typeCode asc 로 고정한다(spec §5.1 정렬 화이트리스트) — 외부 sort 파라미터를 신뢰하지 않아
 * 화이트리스트 밖 정렬을 원천 차단한다(B-006 정렬↔인덱스 1:1).
 */
@RequiredArgsConstructor
public class ItemTemplateRepositoryImpl implements ItemTemplateRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<ItemTemplate> search(ItemTemplateSearchCondition condition, Pageable pageable) {
        List<ItemTemplate> content = queryFactory.selectFrom(itemTemplate)
            .where(
                eqMainCategory(condition.mainCategory()),
                eqSubGroup(condition.subGroup()),
                eqElement(condition.element()),
                eqKind(condition.kind()))
            .orderBy(itemTemplate.typeCode.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory.select(itemTemplate.count())
            .from(itemTemplate)
            .where(
                eqMainCategory(condition.mainCategory()),
                eqSubGroup(condition.subGroup()),
                eqElement(condition.element()),
                eqKind(condition.kind()))
            .fetchOne();

        return new PageImpl<>(content, pageable, total == null ? 0L : total);
    }

    private BooleanExpression eqMainCategory(Integer value) {
        return value == null ? null : itemTemplate.mainCategory.eq(value);
    }

    private BooleanExpression eqSubGroup(Integer value) {
        return value == null ? null : itemTemplate.subGroup.eq(value);
    }

    private BooleanExpression eqElement(Integer value) {
        return value == null ? null : itemTemplate.element.eq(value);
    }

    private BooleanExpression eqKind(Integer value) {
        return value == null ? null : itemTemplate.kind.eq(value);
    }
}
