package com.finalcall.domain.notice;

import com.finalcall.common.exception.ErrorCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * 공지 커스텀 쿼리 계약(Stage D, QueryDSL 구현은 {@link NoticeRepositoryImpl}).
 * 삭제된 글(isDeleted=true)은 조회에서 제외한다.
 */
public interface NoticeRepositoryCustom {

    /** 삭제되지 않은 단건 조회(없으면 예외). */
    Notice findActiveByIdOrThrow(Long id, ErrorCode errorCode);

    /** 오프셋 페이지(삭제 제외, content 쿼리와 count 쿼리 분리). */
    Page<Notice> findActivePage(Pageable pageable);

    /** 커서 기반(삭제 제외). hasNext 판단을 위해 size+1 건을 조회한다. */
    List<Notice> findActiveByCursor(Long cursor, int size);
}
