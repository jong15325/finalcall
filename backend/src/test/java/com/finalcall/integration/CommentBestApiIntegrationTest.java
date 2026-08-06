package com.finalcall.integration;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Comment;
import com.finalcall.domain.board.entity.CommentReaction;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.ReactionType;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.CommentReactionRepository;
import com.finalcall.domain.board.repository.CommentRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * BEST 댓글 선정 통합 검증(EPIC-COMMENT-V2, FC-209) — 실제 MySQL(Testcontainers) + Flyway V24 + Security 필터.
 *
 * <p>계약 api §6.3 {@code GET /posts/{postPublicId}/comments/best} · board-spec §13.3. 임계({@code min-likes})·상위 N
 * ({@code max-count})·순공감({@code like−dislike}) DESC·id DESC 랭킹·삭제/tombstone 제외·빈 배열·글 없음(POST_001)·
 * {@code myReaction} 뷰어 종속을 고정한다. 기본 설정(min-likes=3·max-count=3)을 그대로 쓰고, 카운트는 반응 API 를 우회해
 * {@code CommentRepository} 원자 UPDATE 로 직접 세운다(반응자 다수 준비 회피 — BEST 랭킹 자체를 결정적으로 검증). 읽기·롤백이라
 * {@code @Transactional}, 설정 후 {@code em.flush()/clear()} 로 요청이 DB 최신을 읽게 한다.
 */
@Transactional
class CommentBestApiIntegrationTest extends IntegrationTest {

    @Autowired
    private EntityManager em;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BoardRepository boardRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private CommentReactionRepository commentReactionRepository;

    // ---------------- 선정(임계·상위 N·순공감 랭킹) ----------------

    @Test
    void BEST는_임계이상만_순공감순으로_상위N건_반환한다() throws Exception {
        // 기본: min-likes=3, max-count=3. 임계(like>=3) 통과 4개 중 순공감(like−dislike) 상위 3개만, 미달 1개는 배제.
        User author = persistUser("best_a1", "베스트작성자1");
        Post post = persistPost(boardId("community"), author, "베스트글");
        Comment qualHigh = persistComment(post, author, "순공감5"); // like6 dislike1 → net5
        Comment qualMid = persistComment(post, author, "순공감4"); // like4 dislike0 → net4
        Comment qualLow = persistComment(post, author, "순공감3"); // like3 dislike0 → net3
        Comment qualExtra = persistComment(post, author, "순공감1"); // like3 dislike2 → net1(임계통과·N초과)
        Comment below = persistComment(post, author, "임계미달"); // like2 → 임계 미달 배제
        bump(qualHigh, 6, 1);
        bump(qualMid, 4, 0);
        bump(qualLow, 3, 0);
        bump(qualExtra, 3, 2);
        bump(below, 2, 0);
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            // 상위 N=3(qualExtra net1·below 임계미달 제외). 순공감 DESC: 5 > 4 > 3.
            .andExpect(jsonPath("$.data.comments.length()").value(3))
            .andExpect(jsonPath("$.data.comments[0].content").value("순공감5"))
            .andExpect(jsonPath("$.data.comments[0].likeCount").value(6))
            .andExpect(jsonPath("$.data.comments[0].dislikeCount").value(1))
            .andExpect(jsonPath("$.data.comments[1].content").value("순공감4"))
            .andExpect(jsonPath("$.data.comments[2].content").value("순공감3"))
            // BEST 항목도 replyCount 를 싣는다(CommentResponse 코어). 비로그인 조회는 myReaction=null·editable=false.
            .andExpect(jsonPath("$.data.comments[0].replyCount").value(0))
            .andExpect(jsonPath("$.data.comments[0].editable").value(false))
            .andExpect(jsonPath("$.data.comments[0].myReaction").value(nullValue()));
    }

    @Test
    void 순공감_동률은_id_DESC로_최신이_앞선다() throws Exception {
        User author = persistUser("best_a2", "베스트작성자2");
        Post post = persistPost(boardId("community"), author, "동률글");
        Comment older = persistComment(post, author, "동률-과거"); // like5 dislike0 → net5, id 작음
        Comment newer = persistComment(post, author, "동률-최신"); // like5 dislike0 → net5, id 큼
        bump(older, 5, 0);
        bump(newer, 5, 0);
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments.length()").value(2))
            .andExpect(jsonPath("$.data.comments[0].content").value("동률-최신"))
            .andExpect(jsonPath("$.data.comments[1].content").value("동률-과거"));
    }

    @Test
    void 임계미달만_있으면_빈_배열이다() throws Exception {
        User author = persistUser("best_a3", "베스트작성자3");
        Post post = persistPost(boardId("community"), author, "미달글");
        Comment weak = persistComment(post, author, "공감2"); // like2 < 3
        bump(weak, 2, 0);
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments.length()").value(0));
    }

    // ---------------- 삭제/tombstone 제외 ----------------

    @Test
    void 삭제된_인기_루트는_tombstone이어도_BEST에서_제외된다() throws Exception {
        User author = persistUser("best_a4", "베스트작성자4");
        User replier = persistUser("best_r4", "답글러4");
        Post post = persistPost(boardId("community"), author, "삭제글");
        Comment root = persistComment(post, author, "삭제될 인기 루트"); // like5 → 임계 통과
        bump(root, 5, 0);
        persistReply(post, replier, "답글", root);
        commentRepository.incrementReplyCount(root.getId()); // reply_count=1 → 삭제 시 tombstone
        flushClear();

        // 루트 soft delete(활성 답글 보유 → tombstone). BEST 는 is_deleted=false 필터로 배제한다.
        Comment reloaded = commentRepository.findById(root.getId()).orElseThrow();
        reloaded.delete(Instant.now());
        commentRepository.save(reloaded);
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments.length()").value(0));
    }

    // ---------------- myReaction 뷰어 종속 ----------------

    @Test
    void BEST_myReaction은_반응한_뷰어에게만_채워진다() throws Exception {
        User author = persistUser("best_a5", "베스트작성자5");
        User reactor = persistUser("best_r5", "반응러5");
        User other = persistUser("best_o5", "타인5");
        Post post = persistPost(boardId("community"), author, "myReaction글");
        Comment comment = persistComment(post, author, "인기 루트"); // like3 → 임계 통과
        bump(comment, 3, 0);
        commentReactionRepository.save(CommentReaction.builder()
            .commentId(comment.getId()).userId(reactor.getId()).reactionType(ReactionType.LIKE).build());
        flushClear();

        // 반응한 뷰어 → myReaction=LIKE.
        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId())
            .with(user(String.valueOf(reactor.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments[0].myReaction").value("LIKE"));

        // 반응 안 한 타인 → null.
        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId())
            .with(user(String.valueOf(other.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments[0].myReaction").value(nullValue()));

        // 비인증 → null(optional-auth).
        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.comments[0].myReaction").value(nullValue()));
    }

    // ---------------- 글 없음 ----------------

    @Test
    void 없는_글_BEST는_404_POST_001() throws Exception {
        mockMvc.perform(get("/api/v1/posts/{p}/comments/best", "NONEXISTENTPOST00000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("POST_001"));
    }

    // ---------------- helpers ----------------

    private void flushClear() {
        em.flush();
        em.clear();
    }

    private Long boardId(String slug) {
        Board board = boardRepository.findBySlugAndIsActiveTrue(slug).orElseThrow();
        return board.getId();
    }

    /** 반응 API 를 우회해 like/dislike_count 를 원자 UPDATE 로 직접 세운다(BEST 랭킹 픽스처). */
    private void bump(Comment comment, int likes, int dislikes) {
        for (int i = 0; i < likes; i++) {
            commentRepository.incrementLikeCount(comment.getId());
        }
        for (int i = 0; i < dislikes; i++) {
            commentRepository.incrementDislikeCount(comment.getId());
        }
    }

    private Post persistPost(Long boardId, User author, String title) {
        return postRepository.save(Post.builder()
            .boardId(boardId).authorId(author.getId()).authorNickname(author.getNickname())
            .title(title).content("본문").isPinned(false).build());
    }

    private Comment persistComment(Post post, User author, String content) {
        return commentRepository.save(Comment.builder()
            .postId(post.getId()).authorId(author.getId()).authorNickname(author.getNickname())
            .content(content).build());
    }

    private Comment persistReply(Post post, User author, String content, Comment root) {
        return commentRepository.save(Comment.builder()
            .postId(post.getId()).authorId(author.getId()).authorNickname(author.getNickname())
            .content(content).parentCommentId(root.getId()).build());
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }
}
