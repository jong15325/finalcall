package com.finalcall.domain.board.repository;

import static com.finalcall.domain.board.entity.QPost.post;

import java.util.List;

import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.PostCursor;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 게시글 커서 목록 QueryDSL 구현(EPIC-BOARD). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합한다.
 *
 * <p>정렬 = {@code is_pinned DESC, id DESC}(고정 최상단·그 외 최신순, board-spec §6.3). 커서 경계는 (pinned, id)
 * 2축 keyset 이다 — DESC 튜플에서 "경계 이후" 행은 {@code (pinnedRank < cursorPinnedRank) OR (pinnedRank =
 * cursorPinnedRank AND id < cursorId)}. is_pinned 는 boolean 이라 pinnedRank ∈ {고정=상위, 일반=하위}로 전개한다.
 */
@RequiredArgsConstructor
public class PostRepositoryImpl implements PostRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Post> findByBoardCursor(Long boardId, PostCursor cursor, int size) {
        return queryFactory.selectFrom(post)
            .where(post.boardId.eq(boardId), post.isDeleted.isFalse(), cursorPredicate(cursor))
            .orderBy(post.isPinned.desc(), post.id.desc())
            .limit(size + 1L) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    /**
     * (is_pinned DESC, id DESC) keyset 경계. 첫 페이지면 조건 없음. 경계 글이 고정이면 "일반 글 전부" + "고정 글 중 id 더 작은 것",
     * 경계 글이 일반이면 "일반 글 중 id 더 작은 것"이 다음 페이지다(고정 글은 이미 앞 페이지에서 소진).
     */
    private BooleanExpression cursorPredicate(PostCursor cursor) {
        if (cursor.isFirstPage()) {
            return null;
        }
        if (Boolean.TRUE.equals(cursor.pinned())) {
            return post.isPinned.isFalse().or(post.isPinned.isTrue().and(post.id.lt(cursor.id())));
        }
        return post.isPinned.isFalse().and(post.id.lt(cursor.id()));
    }
}
