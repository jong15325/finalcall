package com.finalcall.domain.board.entity;

import com.finalcall.common.entity.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 댓글 공감/비공감 반응 엔티티(EPIC-COMMENT-V2, FC-208) — 유저당 댓글당 1행. erd §4.5({@code comment_reaction}) · board-spec
 * §13.2·R-1.
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}(private)·{@code @Setter} 금지 →
 * 전환은 도메인 메서드({@link #switchTo})로만. 시각은 {@link BaseTimeEntity}(created_at 최초 반응·updated_at 전환)가 관리한다.
 *
 * <p><b>유일성(R-1)</b>: {@code UK(comment_id, user_id)}(V24)가 유저당 댓글당 1행을 DB 에서 강제한다 — 중복 반응·이중 카운트를
 * 차단한다(money_exchange·charge 멱등 UK 선례와 동류의 유일성 앵커). {@code public_id} 가 없다 — 반응은 URL 리소스가 아니라
 * 대상 댓글 하위 토글이라 외부 식별자가 불필요하다(대상은 {@code comment}+{@code user} 로 upsert). soft delete 도 없다 — 취소는
 * 물리 DELETE 다(append 원장 아님).
 *
 * <p>{@code commentId}·{@code userId} 는 FK 컬럼으로만 참조한다(내비게이션 매핑 없음) — 반응 로직은 대상 댓글의 카운트를
 * {@code CommentRepository} 원자 UPDATE 로 증감하고(동일 TX·R-2), 반응 조회는 {@code (comment_id, user_id)} 키로 직접 한다.
 * {@code reactionType} 은 전환 시 이 컬럼만 UPDATE 한다(board-spec §13.2 표).
 */
@Entity
@Getter
@Table(name = "comment_reaction")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommentReaction extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "comment_id", nullable = false, updatable = false)
    private Long commentId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    // LIKE|DISLIKE. VARCHAR(10) 저장(문자열) — 전환 시 이 컬럼만 UPDATE(취소는 행 DELETE).
    @Enumerated(EnumType.STRING)
    @Column(name = "reaction_type", nullable = false, length = 10)
    private ReactionType reactionType;

    @Builder
    private CommentReaction(Long commentId, Long userId, ReactionType reactionType) {
        this.commentId = commentId;
        this.userId = userId;
        this.reactionType = reactionType;
    }

    /**
     * 반응 종류를 전환한다(LIKE↔DISLIKE, board-spec §13.2). @Setter 대신 도메인 메서드 — dirty checking 으로 flush 시
     * {@code reaction_type} 만 UPDATE 된다(1행 유지·2행 생성 없음). 카운트 증감은 서비스가 원자 UPDATE 로 동일 TX 에서 반영한다.
     */
    public void switchTo(ReactionType newType) {
        this.reactionType = newType;
    }
}
