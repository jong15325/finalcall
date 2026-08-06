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
 * 게시글 엔티티(EPIC-BOARD, FC-198) — board 귀속·작성자 귀속·soft delete. erd §4.5 · board-spec §2.2.
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}(private)·{@code @Setter} 금지
 * → 상태 변경은 도메인 메서드({@link #update}·{@link #delete}·{@link #increaseViewCount})로만. 시각 필드는
 * {@link BaseTimeEntity}(created_at·updated_at)가 관리한다.
 *
 * <p>{@code boardId}·{@code authorId} 는 FK 컬럼으로만 참조한다 — 표시 데이터({@code authorNickname})는 작성 시점
 * 스냅샷(R1 닉 변경·탈퇴 대비, 목록 조인 회피)이라 조회 시 user 로 내비게이션할 필요가 없어 연관 매핑을 두지 않는다
 * (작성자 인가는 {@code authorId} 비교로 충분). {@code authorId} 는 nullable — 웹 작성은 항상 값(인가 주체)이나
 * 흡수 공지·시스템 글은 NULL(memo {@code sender_id} 선례). {@code viewCount}·{@code commentCount} 는 비정규화 카운터다
 * ({@code viewCount}=상세 조회 원자 증가·{@code commentCount}=댓글 생성/삭제와 동일 TX 증감, board-spec §6).
 */
@Entity
@Getter
@Table(name = "post")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "board_id", nullable = false, updatable = false)
    private Long boardId;

    @Column(name = "author_id", updatable = false)
    private Long authorId;

    @Column(name = "author_nickname", nullable = false, length = 30)
    private String authorNickname;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

    @Column(name = "comment_count", nullable = false)
    private int commentCount;

    @Column(name = "is_pinned", nullable = false)
    private boolean isPinned;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Builder
    private Post(String publicId, Long boardId, Long authorId, String authorNickname, String title, String content,
        boolean isPinned) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.boardId = boardId;
        this.authorId = authorId;
        this.authorNickname = authorNickname;
        this.title = title;
        this.content = content;
        this.viewCount = 0;
        this.commentCount = 0;
        this.isPinned = isPinned;
        this.isDeleted = false;
    }

    /** 이 글이 주어진 게시판에 귀속되는지(경로 slug 게시판과 글의 board 정합 검증). */
    public boolean belongsToBoard(Long targetBoardId) {
        return targetBoardId != null && targetBoardId.equals(boardId);
    }

    /** 주체가 이 글의 작성자인지(IDOR 가드 I-2). authorId 가 NULL(시스템 글)이면 어떤 주체도 소유자가 아니다. */
    public boolean isOwnedBy(Long userId) {
        return userId != null && userId.equals(authorId);
    }

    /** 내용 수정(도메인 메서드, api §6.2 PUT). @Setter 대신 사용 — dirty checking 으로 flush 시 반영. */
    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    /** soft delete(api §6.2 DELETE) — 이미 삭제면 no-op. 삭제 글은 조회·목록·카운트에서 제외(board-spec P-2). */
    public void delete(Instant now) {
        if (isDeleted) {
            return;
        }
        this.isDeleted = true;
        this.deletedAt = now;
    }

    /**
     * 조회수 증가(표시 반영용, board-spec §6.2). 내구 증가는 동시성 안전한 원자 UPDATE 로 수행하고
     * ({@code PostRepository.incrementViewCount}), 이 메서드는 detach 된 인스턴스의 in-memory 값만 올려 응답이
     * "이번 조회까지 반영된 값"을 보이게 한다(read-modify-write 로 인한 손실 증분을 피하려 dirty checking 을 쓰지 않는다).
     */
    public void increaseViewCount() {
        this.viewCount++;
    }
}
