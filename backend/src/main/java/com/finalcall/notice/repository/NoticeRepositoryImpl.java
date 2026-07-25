package com.finalcall.notice.repository;

import static com.finalcall.notice.entity.QNotice.notice;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.notice.entity.Notice;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 공지 커스텀 쿼리 QueryDSL 구현(Stage D). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합.
 */
@RequiredArgsConstructor
public class NoticeRepositoryImpl implements NoticeRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Notice findActiveByIdOrThrow(Long id, ErrorCode errorCode) {
        Notice result = queryFactory.selectFrom(notice)
            .where(notice.id.eq(id), notice.isDeleted.isFalse())
            .fetchOne();
        if (result == null) {
            throw new BusinessException(errorCode);
        }
        return result;
    }

    @Override
    public Page<Notice> findActivePage(Pageable pageable) {
        List<Notice> content = queryFactory.selectFrom(notice)
            .where(notice.isDeleted.isFalse())
            .orderBy(notice.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory.select(notice.count())
            .from(notice)
            .where(notice.isDeleted.isFalse())
            .fetchOne();

        return new PageImpl<>(content, pageable, total == null ? 0L : total);
    }

    @Override
    public List<Notice> findActiveByCursor(Long cursor, int size) {
        return queryFactory.selectFrom(notice)
            .where(notice.isDeleted.isFalse(), cursorLt(cursor))
            .orderBy(notice.id.desc())
            .limit(size + 1L) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    /** cursor 가 null 이면 조건 제외(첫 페이지). */
    private BooleanExpression cursorLt(Long cursor) {
        return cursor == null ? null : notice.id.lt(cursor);
    }
}
