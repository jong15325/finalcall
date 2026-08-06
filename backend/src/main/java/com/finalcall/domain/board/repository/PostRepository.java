package com.finalcall.domain.board.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.board.entity.Post;

/**
 * 게시글 리포지토리(EPIC-BOARD, FC-198). 커서 목록은 {@link PostRepositoryCustom}(QueryDSL)로 분리한다.
 *
 * <p>단건(상세·수정·삭제)은 활성(soft delete 제외)만 조회한다 — 삭제 글은 {@code POST_001}(404)로 수렴한다
 * (board-spec P-2, 활성 필터 동반 필수). 조회수 증가는 동시성 안전한 원자 UPDATE 로 수행한다({@link #incrementViewCount}).
 */
public interface PostRepository extends JpaRepository<Post, Long>, PostRepositoryCustom {

    /** public_id 로 활성 단건 조회(상세·수정·삭제) — 삭제행 제외(board-spec P-2). */
    Optional<Post> findByPublicIdAndIsDeletedFalse(String publicId);

    /** OrThrow default 메서드 패턴 — 활성 글이 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Post findActiveByPublicIdOrThrow(String publicId, ErrorCode errorCode) {
        return findByPublicIdAndIsDeletedFalse(publicId).orElseThrow(() -> new BusinessException(errorCode));
    }

    /**
     * 조회수 원자 증가(board-spec §6.2 {@code UPDATE post SET view_count = view_count + 1 WHERE id=?}). 상세 조회 동시성에서
     * read-modify-write 손실 증분을 피한다(단순 카운터·디둡 없음). {@code clearAutomatically} 로 영속성 컨텍스트를 비워
     * 이후 stale 엔티티가 실수로 flush 되지 않게 한다(응답은 detach 인스턴스의 in-memory +1 로 표시).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Post p SET p.viewCount = p.viewCount + 1 WHERE p.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /**
     * 댓글 수 원자 증가(board-spec §6.1·N-1). 댓글 생성과 동일 TX 에서 실행한다. 조건부 CAS 없이 {@code +1}만 하되
     * read-modify-write(엔티티 dirty checking)를 피해 동시 댓글 폭주에서 손실 증분을 막는다 — 서비스는 이 원자 UPDATE 만
     * 쓰고 로드한 Post 의 카운터를 in-memory 로 만지지 않는다(그러면 stale 값 재-flush 로 원자성이 깨진다).
     */
    @Modifying
    @Query("UPDATE Post p SET p.commentCount = p.commentCount + 1 WHERE p.id = :id")
    void incrementCommentCount(@Param("id") Long id);

    /**
     * 댓글 수 원자 감소(board-spec §6.1·N-1). 댓글 soft delete 와 동일 TX 에서 실행한다. {@code commentCount > 0} 가드로
     * 음수 언더플로를 막는다(재삭제·경합 시에도 0 미만이 되지 않는다). 원자 UPDATE 로 손실 감소분을 방지한다.
     */
    @Modifying
    @Query("UPDATE Post p SET p.commentCount = p.commentCount - 1 WHERE p.id = :id AND p.commentCount > 0")
    void decrementCommentCount(@Param("id") Long id);
}
