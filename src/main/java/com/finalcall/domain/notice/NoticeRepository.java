package com.finalcall.domain.notice;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 공지 리포지토리(Stage D). 커스텀 쿼리는 {@link NoticeRepositoryCustom}(QueryDSL)로 분리.
 */
public interface NoticeRepository extends JpaRepository<Notice, Long>, NoticeRepositoryCustom {

    /**
     * OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}.
     * 삭제 여부와 무관하게 단건을 조회한다(수정/삭제 시 삭제 상태 검증을 위해 사용).
     */
    default Notice findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
