package com.finalcall.domain.board.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 댓글 엔티티(EPIC-BOARD, FC-199 · EPIC-COMMENT-V2, FC-207) — post 귀속·작성자 귀속·soft delete + 대댓글 1단계 확장.
 * erd §4.5 · board-spec §2.3·§13.
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}(private)·{@code @Setter} 금지
 * → 상태 변경은 도메인 메서드({@link #update}·{@link #delete})로만. 시각 필드는 {@link BaseTimeEntity}(created_at·updated_at)가
 * 관리한다.
 *
 * <p>{@code postId}·{@code authorId} 는 FK 컬럼으로만 참조한다 — 표시 데이터({@code authorNickname})는 작성 시점 스냅샷
 * (R1 닉 변경·탈퇴 대비, 목록 조인 회피)이라 조회 시 user 로 내비게이션할 필요가 없어 연관 매핑을 두지 않는다(작성자 인가는
 * {@code authorId} 비교로 충분). {@code authorId} 는 nullable — 웹 작성은 항상 값(인가 주체)이나 시스템 댓글 대비 NULL 허용.
 *
 * <p><b>대댓글 1단계(FC-207, board-spec §13.1·C-2)</b>: {@code parentCommentId} 는 대댓글 앵커(self-FK)로 <b>활성</b>이다 —
 * 답글은 항상 <b>최상위(루트) 댓글</b>을 가리킨다(2단계 트리 금지·답글의 답글도 같은 루트로 평탄화). 루트 댓글은 {@code null}.
 * {@code mentionedNickname} 은 답글의 답글일 때 @멘션 대상(그 답글 작성자) 닉 스냅샷이며 직접 답글·루트는 {@code null}
 * (표시 전용, 대상 댓글 참조는 저장하지 않는다).
 *
 * <p><b>비정규화 카운트</b>: {@code likeCount}·{@code dislikeCount}(공감/비공감, 반응과 동일 TX 원자 증감 — 값 갱신 로직은
 * FC-208)·{@code replyCount}(루트만 유효, 답글 생성/삭제 동일 TX 원자 증감 — {@code CommentRepository} 원자 UPDATE). 삭제 루트
 * tombstone 판정({@code isDeleted && replyCount>0})에 {@code replyCount} 를 쓴다(board-spec §13.4).
 */
@Entity
@Getter
@Table(name = "comment")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Comment extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "post_id", nullable = false, updatable = false)
    private Long postId;

    @Column(name = "author_id", updatable = false)
    private Long authorId;

    @Column(name = "author_nickname", nullable = false, length = 30)
    private String authorNickname;

    @Column(nullable = false, length = 1000)
    private String content;

    // 대댓글 앵커(self-FK, FC-207 활성) — 답글은 항상 루트 댓글 id(1단계). 루트 댓글은 null. 작성 시 확정·불변.
    @Column(name = "parent_comment_id", updatable = false)
    private Long parentCommentId;

    // 답글의 답글일 때 @멘션 대상(그 답글 작성자) 닉 스냅샷. 직접 답글·루트는 null. 표시 전용·작성 시 확정·불변(board-spec §13.1).
    @Column(name = "mentioned_nickname", updatable = false, length = 30)
    private String mentionedNickname;

    // 공감 수(비정규화). 반응과 동일 TX 원자 증감(값 갱신 로직 FC-208, CommentRepository UPDATE). 엔티티 dirty 로 만지지 않는다.
    @Column(name = "like_count", nullable = false)
    private int likeCount;

    // 비공감 수(비정규화). 반응과 동일 TX 원자 증감(FC-208).
    @Column(name = "dislike_count", nullable = false)
    private int dislikeCount;

    // 답글 수(비정규화, 루트만 유효). 답글 생성/삭제 동일 TX 원자 증감. tombstone 판정(isDeleted && replyCount>0)에 사용.
    @Column(name = "reply_count", nullable = false)
    private int replyCount;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Builder
    private Comment(String publicId, Long postId, Long authorId, String authorNickname, String content,
        Long parentCommentId, String mentionedNickname) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.postId = postId;
        this.authorId = authorId;
        this.authorNickname = authorNickname;
        this.content = content;
        // parentCommentId != null 이면 답글(루트 id 로 정규화된 값을 서비스가 전달). null 이면 루트 댓글.
        this.parentCommentId = parentCommentId;
        this.mentionedNickname = mentionedNickname;
        this.likeCount = 0;
        this.dislikeCount = 0;
        this.replyCount = 0;
        this.isDeleted = false;
    }

    /** 루트 댓글(최상위)인지 — {@code parentCommentId IS NULL}(board-spec §13.1). 답글이면 false. */
    public boolean isRoot() {
        return parentCommentId == null;
    }

    /** 삭제됐으나 활성 답글이 남아 목록에 잔류하는 tombstone 인지(board-spec §13.4 — 본문·작성자·반응 마스킹 대상). */
    public boolean isTombstone() {
        return isDeleted && replyCount > 0;
    }

    /** 이 댓글이 주어진 게시글에 귀속되는지(경로 postPublicId 게시글과 댓글의 post 정합 검증). */
    public boolean belongsToPost(Long targetPostId) {
        return targetPostId != null && targetPostId.equals(postId);
    }

    /** 주체가 이 댓글의 작성자인지(IDOR 가드 I-2). authorId 가 NULL(시스템 댓글)이면 어떤 주체도 소유자가 아니다. */
    public boolean isOwnedBy(Long userId) {
        return userId != null && userId.equals(authorId);
    }

    /** 내용 수정(도메인 메서드, api §6.3 PUT). @Setter 대신 사용 — dirty checking 으로 flush 시 반영. */
    public void update(String content) {
        this.content = content;
    }

    /** soft delete(api §6.3 DELETE) — 이미 삭제면 no-op. 삭제 댓글은 조회·목록·카운트에서 제외(board-spec P-2). */
    public void delete(Instant now) {
        if (isDeleted) {
            return;
        }
        this.isDeleted = true;
        this.deletedAt = now;
    }
}
