package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * 댓글 공감/비공감 토글 통합 검증(EPIC-COMMENT-V2, FC-208) — 실제 MySQL(Testcontainers) + Flyway V24 + Security 필터.
 *
 * <p>계약 api §6.3 · board-spec §13.2·R-1~R-3. 등록·전환(LIKE↔DISLIKE)·취소(같은 종류 재요청)·자기 반응 금지
 * ({@code COMMENT_003})·미인증(401)·대상 없음({@code COMMENT_001})·타입 검증(400)·{@code myReaction} 뷰어 종속(인증/비인증)·
 * 카운트 비정규화(동일 TX 원자 UPDATE)·UK 중복 차단을 고정한다. 설정 mutation 후 {@code em.flush()/clear()} 로 요청이 DB
 * 최신을 읽게 한다(요청별 독립 TX 와 동일 거동). 읽기·롤백이라 {@code @Transactional}.
 */
@Transactional
class CommentReactionApiIntegrationTest extends IntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

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

    // ---------------- 등록·전환·취소 ----------------

    @Test
    void 공감_등록시_200이고_likeCount_1_myReaction_LIKE이며_반응행1개다() throws Exception {
        User author = persistUser("rx_a1", "글쓴이1");
        User reactor = persistUser("rx_r1", "반응러1");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트 댓글");
        flushClear();

        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.LIKE))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.likeCount").value(1))
            .andExpect(jsonPath("$.data.dislikeCount").value(0))
            .andExpect(jsonPath("$.data.myReaction").value("LIKE"));

        flushClear();
        Comment reloaded = commentRepository.findById(comment.getId()).orElseThrow();
        assertThat(reloaded.getLikeCount()).isEqualTo(1);
        assertThat(reloaded.getDislikeCount()).isZero();
        assertThat(commentReactionRepository.findByCommentIdAndUserId(comment.getId(), reactor.getId()))
            .get().extracting(CommentReaction::getReactionType).isEqualTo(ReactionType.LIKE);
    }

    @Test
    void 전환은_한쪽_감소_다른쪽_증가하고_반응행은_1개로_유지된다() throws Exception {
        User author = persistUser("rx_a2", "글쓴이2");
        User reactor = persistUser("rx_r2", "반응러2");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();

        // 먼저 LIKE 등록.
        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.LIKE)).andExpect(status().isOk());
        flushClear();

        // LIKE → DISLIKE 전환.
        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.DISLIKE))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.likeCount").value(0))
            .andExpect(jsonPath("$.data.dislikeCount").value(1))
            .andExpect(jsonPath("$.data.myReaction").value("DISLIKE"));

        flushClear();
        Comment reloaded = commentRepository.findById(comment.getId()).orElseThrow();
        assertThat(reloaded.getLikeCount()).isZero();
        assertThat(reloaded.getDislikeCount()).isEqualTo(1);
        // 유저당 댓글당 1행 유지(전환은 UPDATE, 2행 생성 없음).
        assertThat(commentReactionRepository.findByCommentIdInAndUserId(
            java.util.List.of(comment.getId()), reactor.getId())).hasSize(1);
    }

    @Test
    void 같은_종류_재요청은_취소되어_카운트0_myReaction_null_반응행0개다() throws Exception {
        User author = persistUser("rx_a3", "글쓴이3");
        User reactor = persistUser("rx_r3", "반응러3");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();

        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.LIKE)).andExpect(status().isOk());
        flushClear();

        // 같은 LIKE 재요청 → 취소.
        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.LIKE))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.likeCount").value(0))
            .andExpect(jsonPath("$.data.myReaction").value(nullValue()));

        flushClear();
        assertThat(commentRepository.findById(comment.getId()).orElseThrow().getLikeCount()).isZero();
        assertThat(commentReactionRepository.findByCommentIdAndUserId(comment.getId(), reactor.getId())).isEmpty();
    }

    // ---------------- 인가·검증 ----------------

    @Test
    void 자기_댓글_반응은_422_COMMENT_003() throws Exception {
        User author = persistUser("rx_a4", "글쓴이4");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "내 댓글");
        flushClear();

        mockMvc.perform(reactRequest(post, comment, author, ReactionType.LIKE))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("COMMENT_003"));

        flushClear();
        assertThat(commentRepository.findById(comment.getId()).orElseThrow().getLikeCount()).isZero();
    }

    @Test
    void 미인증_반응은_401() throws Exception {
        User author = persistUser("rx_a5", "글쓴이5");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}/reaction", post.getPublicId(), comment.getPublicId())
            .contentType(MediaType.APPLICATION_JSON).content(body(ReactionType.LIKE)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 없는_댓글_반응은_404_COMMENT_001() throws Exception {
        User author = persistUser("rx_a6", "글쓴이6");
        User reactor = persistUser("rx_r6", "반응러6");
        Post post = persistPost(boardId("community"), author, "글");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}/reaction",
            post.getPublicId(), "NONEXISTENTCMT000000000001")
            .with(user(String.valueOf(reactor.getId())))
            .contentType(MediaType.APPLICATION_JSON).content(body(ReactionType.LIKE)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("COMMENT_001"));
    }

    @Test
    void 화이트리스트_외_타입은_400() throws Exception {
        User author = persistUser("rx_a7", "글쓴이7");
        User reactor = persistUser("rx_r7", "반응러7");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}/reaction", post.getPublicId(), comment.getPublicId())
            .with(user(String.valueOf(reactor.getId())))
            .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"LOVE\"}"))
            .andExpect(status().isBadRequest());
    }

    // ---------------- myReaction 뷰어 종속 ----------------

    @Test
    void 목록_myReaction은_반응한_뷰어에게만_LIKE_타인과_비인증은_null이다() throws Exception {
        User author = persistUser("rx_a8", "글쓴이8");
        User reactor = persistUser("rx_r8", "반응러8");
        User other = persistUser("rx_o8", "타인8");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();
        mockMvc.perform(reactRequest(post, comment, reactor, ReactionType.LIKE)).andExpect(status().isOk());
        flushClear();

        // 반응한 본인 → myReaction=LIKE.
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId())
            .with(user(String.valueOf(reactor.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].likeCount").value(1))
            .andExpect(jsonPath("$.data.content[0].myReaction").value("LIKE"));

        // 반응 안 한 타인 → myReaction=null(카운트는 공통).
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId())
            .with(user(String.valueOf(other.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].likeCount").value(1))
            .andExpect(jsonPath("$.data.content[0].myReaction").value(nullValue()));

        // 비인증 → myReaction=null(optional-auth).
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].myReaction").value(nullValue()));
    }

    @Test
    void 답글_목록_myReaction도_반응한_뷰어에게_채워진다() throws Exception {
        User author = persistUser("rx_a9", "글쓴이9");
        User replier = persistUser("rx_p9", "답글러9");
        User reactor = persistUser("rx_r9", "반응러9");
        Post post = persistPost(boardId("community"), author, "글");
        Comment root = persistComment(post, author, "루트");
        Comment reply = persistReply(post, replier, "답글", root);
        flushClear();
        mockMvc.perform(reactRequest(post, reply, reactor, ReactionType.DISLIKE)).andExpect(status().isOk());
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), root.getPublicId())
            .with(user(String.valueOf(reactor.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].dislikeCount").value(1))
            .andExpect(jsonPath("$.data.content[0].myReaction").value("DISLIKE"));
    }

    // ---------------- UK 중복 차단 ----------------

    @Test
    void 같은_유저_같은_댓글_두_반응행은_UK로_차단된다() throws Exception {
        User author = persistUser("rx_a10", "글쓴이10");
        User reactor = persistUser("rx_r10", "반응러10");
        Post post = persistPost(boardId("community"), author, "글");
        Comment comment = persistComment(post, author, "루트");
        flushClear();

        commentReactionRepository.saveAndFlush(CommentReaction.builder()
            .commentId(comment.getId()).userId(reactor.getId()).reactionType(ReactionType.LIKE).build());

        // 같은 (comment_id, user_id) 두 번째 행 → UK(uk_comment_reaction) 위반.
        assertThatThrownBy(() -> commentReactionRepository.saveAndFlush(CommentReaction.builder()
            .commentId(comment.getId()).userId(reactor.getId()).reactionType(ReactionType.DISLIKE).build()))
            .isInstanceOf(DataIntegrityViolationException.class);
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

    private String body(ReactionType type) throws Exception {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("type", type.name());
        return objectMapper.writeValueAsString(map);
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder reactRequest(
        Post post, Comment comment, User reactor, ReactionType type) throws Exception {
        return put("/api/v1/posts/{p}/comments/{c}/reaction", post.getPublicId(), comment.getPublicId())
            .with(user(String.valueOf(reactor.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(type));
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
