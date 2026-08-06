package com.finalcall.domain.board.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.domain.board.entity.CommentReaction;

import jakarta.persistence.LockModeType;

/**
 * 댓글 반응 리포지토리(EPIC-COMMENT-V2, FC-208). 반응은 대상 댓글 하위 토글이라 public_id 가 없어 조회 키는
 * {@code (comment_id, user_id)}(UK) 다 — 별도 보조 인덱스 없이 UK 가 단건·배치 조회를 모두 커버한다(erd §5).
 *
 * <p><b>토글 단건</b>: {@link #findByCommentIdAndUserId}로 현재 유저의 반응 유무·종류를 읽어 등록/전환/취소를 판정한다
 * (board-spec §13.2 표). <b>myReaction 배치</b>: {@link #findByCommentIdInAndUserId}로 목록의 댓글 id 들에 대한 뷰어 반응을
 * 한 번에 조회해 N+1 을 회피한다({@code comment_id IN (…) AND user_id=?}, UK 커버). 카운트 비정규화·유일성 강제는 각각
 * {@code CommentRepository} 원자 UPDATE 와 DB UK(V24)가 담당하므로 여기엔 카운트 로직을 두지 않는다.
 */
public interface CommentReactionRepository extends JpaRepository<CommentReaction, Long> {

    /** 유저의 특정 댓글 반응 단건(UK 조회) — 없으면 무반응. 표시·검증용 비잠금 read. */
    Optional<CommentReaction> findByCommentIdAndUserId(Long commentId, Long userId);

    /**
     * 토글 판정용 <b>잠금(FOR UPDATE) 단건 조회</b>(FC-208 M-1). 비잠금 read 는 REPEATABLE READ 스냅샷을 보므로, 앞선
     * 비잠금 read(post 조회)로 스냅샷이 고정된 뒤 comment 행 락을 기다린 패자 TX 가 승자의 커밋된 반응 행을 못 봐 재-INSERT →
     * UK 위반(500)이 난다. 잠금 read 는 항상 <b>최신 커밋본</b>을 읽어(스냅샷 우회) 패자가 승자의 행을 보고 전환/취소로
     * 수렴하게 한다(spec §13.2). comment 행 X 락으로 이미 직렬화돼 있어 대상 없을 때의 갭 락도 경합을 만들지 않는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM CommentReaction r WHERE r.commentId = :commentId AND r.userId = :userId")
    Optional<CommentReaction> findByCommentIdAndUserIdForUpdate(
        @Param("commentId") Long commentId, @Param("userId") Long userId);

    /**
     * 뷰어의 댓글별 반응 배치 조회(myReaction 채움, board-spec §13.2) — {@code comment_id IN (…) AND user_id=?}. 목록·답글
     * 응답을 조립할 때 한 번만 호출해 N+1 을 피한다(UK 가 커버). 빈 컬렉션이면 빈 리스트(서비스가 호출 전 가드).
     */
    List<CommentReaction> findByCommentIdInAndUserId(Collection<Long> commentIds, Long userId);
}
