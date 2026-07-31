package com.finalcall.domain.memo.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.memo.entity.Memo;

/**
 * 메모 리포지토리(memo). 커서 목록(받은함·보낸함)은 {@link MemoRepositoryCustom}(QueryDSL)로 분리한다.
 *
 * <p>단건(상세·삭제)은 활성(soft delete 제외)만 조회한다 — 삭제된 메모는 상세·삭제 대상에서 빠져 {@code MEMO_002}(404)로
 * 수렴한다(§4.2). 미열람 개수는 파생 카운트 쿼리로 받은함 인덱스를 커버한다(erd §5).
 */
public interface MemoRepository extends JpaRepository<Memo, Long>, MemoRepositoryCustom {

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Memo findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }

    /** public_id 로 활성 단건 조회(상세·삭제) — 삭제행 제외(§4.2). */
    Optional<Memo> findByPublicIdAndIsDeletedFalse(String publicId);

    /** 미열람 개수(뱃지, §2.6) — receiver=me AND 미삭제 AND 미열람. 받은함 인덱스 커버. */
    long countByReceiverIdAndIsDeletedFalseAndIsReadFalse(Long receiverId);
}
