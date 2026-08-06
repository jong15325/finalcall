package com.finalcall.domain.board.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.board.entity.Comment;

import jakarta.persistence.LockModeType;

/**
 * 댓글 리포지토리(EPIC-BOARD, FC-199 · EPIC-COMMENT-V2, FC-207). 목록은 글당 소규모라 offset 페이지(api §6.3 예외 — 커서 아님).
 *
 * <p><b>루트 목록(FC-207)</b>: {@code post_id=? AND parent_comment_id IS NULL AND (is_deleted=false OR reply_count>0)} —
 * tombstone(삭제됐으나 활성 답글 보유) 루트를 포함한다(board-spec §13.4). 정렬은 {@link Pageable} 의 {@code Sort} 로 주입
 * (LATEST id DESC·OLDEST id ASC·LIKES like_count DESC — 화이트리스트는 {@code CommentSort} 가 강제, B-006). <b>답글 목록</b>은
 * 항상 {@code parent_comment_id=루트 AND is_deleted=false}, id asc 고정(시간순). 답글 삭제는 완전 배제(tombstone 없음).
 *
 * <p>단건(수정·삭제)은 활성만 조회한다({@code COMMENT_001}, board-spec P-2). 반응/답글 카운트는 in-memory 증감을 피하고
 * {@code @Modifying} 원자 UPDATE 로만 증감한다(동시 폭주 손실 방지, N-1·R-2). reply_count 값 갱신은 여기, like/dislike_count 는
 * FC-208 이 담당한다.
 */
public interface CommentRepository extends JpaRepository<Comment, Long> {

    /**
     * 글별 루트 댓글 offset 목록(api §6.3, FC-207) — {@code parent_comment_id IS NULL AND (is_deleted=false OR reply_count>0)}.
     * tombstone 을 포함해 인출하고, 마스킹 판정은 매핑({@code CommentResponse.fromRoot})에서 수행한다(글당 소규모, erd §5 인덱스 주).
     * 정렬은 {@code pageable} 의 {@code Sort}(LATEST/OLDEST/LIKES)로 결정한다.
     */
    @Query("SELECT c FROM Comment c "
        + "WHERE c.postId = :postId AND c.parentCommentId IS NULL AND (c.isDeleted = false OR c.replyCount > 0)")
    Page<Comment> findRootComments(@Param("postId") Long postId, Pageable pageable);

    /** 루트의 활성 답글 offset 목록(api §6.3) — {@code parent_comment_id=루트 AND is_deleted=false}, id asc(시간순 고정). */
    Page<Comment> findByParentCommentIdAndIsDeletedFalseOrderByIdAsc(Long parentCommentId, Pageable pageable);

    /** public_id 로 활성 단건 조회(수정·삭제·답글 대상) — 삭제행 제외(board-spec P-2). */
    Optional<Comment> findByPublicIdAndIsDeletedFalse(String publicId);

    /** public_id 로 단건 조회(삭제행 포함) — 답글 목록의 tombstone 루트 도달을 위해 활성 필터 없이 조회(board-spec §13.4). */
    Optional<Comment> findByPublicId(String publicId);

    /** OrThrow default 메서드 패턴 — 활성 댓글이 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Comment findActiveByPublicIdOrThrow(String publicId, ErrorCode errorCode) {
        return findByPublicIdAndIsDeletedFalse(publicId).orElseThrow(() -> new BusinessException(errorCode));
    }

    /**
     * public_id 로 활성 단건을 비관적 X 락(FOR UPDATE)으로 조회한다(반응 토글 전용, FC-208 M-1). 대상 comment 행을 잠가
     * 이 댓글의 반응 요청을 직렬화한다 — 동일 유저 더블서브밋의 UK 위반(500)을 재판정 수렴으로 흡수하고, 멀티 유저 카운트
     * 누적을 손실 없이 유지한다(board-spec §13.2, auction 행 배타 락 선례). 삭제행은 제외({@code COMMENT_001} 수렴).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Comment c WHERE c.publicId = :publicId AND c.isDeleted = false")
    Optional<Comment> findActiveByPublicIdForUpdate(@Param("publicId") String publicId);

    /**
     * 답글 수 원자 증가(board-spec §6.4·R-2). 답글 생성과 동일 TX 에서 루트 댓글 대상으로 실행한다. read-modify-write(엔티티
     * dirty checking)를 피해 동시 답글 폭주에서 손실 증분을 막는다 — 서비스는 이 원자 UPDATE 만 쓰고 로드한 루트의 카운터를
     * in-memory 로 만지지 않는다.
     */
    @Modifying
    @Query("UPDATE Comment c SET c.replyCount = c.replyCount + 1 WHERE c.id = :id")
    void incrementReplyCount(@Param("id") Long id);

    /**
     * 답글 수 원자 감소(board-spec §6.4·R-2). 답글 soft delete 와 동일 TX 에서 루트 대상으로 실행한다. {@code replyCount > 0}
     * 가드로 음수 언더플로를 막는다(재삭제·경합 시에도 0 미만이 되지 않는다).
     */
    @Modifying
    @Query("UPDATE Comment c SET c.replyCount = c.replyCount - 1 WHERE c.id = :id AND c.replyCount > 0")
    void decrementReplyCount(@Param("id") Long id);

    /**
     * 공감 수 원자 증가(board-spec §6.4·R-2, FC-208). 반응 등록(무→LIKE)·전환(DISLIKE→LIKE)과 동일 TX 에서 실행한다.
     * read-modify-write(엔티티 dirty checking)를 피해 동시 반응 폭주에서 손실 증분을 막는다 — 서비스는 이 원자 UPDATE 만 쓰고
     * 로드한 댓글의 카운터를 in-memory 로 만지지 않는다(UK 가 이중 반응을, 이 UPDATE 가 이중 카운트를 각각 차단한다).
     */
    @Modifying
    @Query("UPDATE Comment c SET c.likeCount = c.likeCount + 1 WHERE c.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 공감 수 원자 감소(board-spec §6.4·R-2, FC-208). 반응 취소(LIKE→무)·전환(LIKE→DISLIKE)과 동일 TX 에서 실행한다.
     * {@code likeCount > 0} 가드로 음수 언더플로를 막는다(경합·중복 요청에도 0 미만이 되지 않는다).
     */
    @Modifying
    @Query("UPDATE Comment c SET c.likeCount = c.likeCount - 1 WHERE c.id = :id AND c.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);

    /** 비공감 수 원자 증가(board-spec §6.4·R-2, FC-208). 등록(무→DISLIKE)·전환(LIKE→DISLIKE)과 동일 TX. incrementLikeCount 대칭. */
    @Modifying
    @Query("UPDATE Comment c SET c.dislikeCount = c.dislikeCount + 1 WHERE c.id = :id")
    void incrementDislikeCount(@Param("id") Long id);

    /** 비공감 수 원자 감소(board-spec §6.4·R-2, FC-208). 취소·전환(DISLIKE→LIKE)과 동일 TX. {@code dislikeCount > 0} 언더플로 가드. */
    @Modifying
    @Query("UPDATE Comment c SET c.dislikeCount = c.dislikeCount - 1 WHERE c.id = :id AND c.dislikeCount > 0")
    void decrementDislikeCount(@Param("id") Long id);
}
