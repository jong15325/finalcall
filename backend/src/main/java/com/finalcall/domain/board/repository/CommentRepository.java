package com.finalcall.domain.board.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.board.entity.Comment;

/**
 * 댓글 리포지토리(EPIC-BOARD, FC-199). 목록은 글당 소규모라 offset 페이지(api §6.3 예외 — 커서 아님).
 *
 * <p>목록·단건(수정·삭제) 모두 활성(soft delete 제외)만 조회한다 — 삭제 댓글은 {@code COMMENT_001}(404)로 수렴한다
 * (board-spec P-2, 활성 필터 동반 필수). 목록 정렬은 {@code id asc}(작성순, api §6.3).
 */
public interface CommentRepository extends JpaRepository<Comment, Long> {

    /** 글별 활성 댓글 offset 목록(api §6.3) — {@code post_id=글 AND is_deleted=false}, id asc(작성순). */
    Page<Comment> findByPostIdAndIsDeletedFalseOrderByIdAsc(Long postId, Pageable pageable);

    /** public_id 로 활성 단건 조회(수정·삭제) — 삭제행 제외(board-spec P-2). */
    Optional<Comment> findByPublicIdAndIsDeletedFalse(String publicId);

    /** OrThrow default 메서드 패턴 — 활성 댓글이 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Comment findActiveByPublicIdOrThrow(String publicId, ErrorCode errorCode) {
        return findByPublicIdAndIsDeletedFalse(publicId).orElseThrow(() -> new BusinessException(errorCode));
    }
}
