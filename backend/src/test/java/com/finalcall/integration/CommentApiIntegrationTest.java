package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Comment;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.CommentRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 댓글 CRUD·인가·allow_comments 게이팅·comment_count 동기화 통합 검증(EPIC-BOARD, FC-199) — 실제 MySQL(Testcontainers)
 * + Flyway V22 시드 + Security 필터.
 *
 * <p>계약 api §6.3·§4. 목록(offset·공개·작성순)·작성(allow_comments on/off 게시판별·인증)·수정삭제 IDOR(작성자 OR ROLE_ADMIN)·
 * comment_count 원자 증감(동일 TX)·soft delete 를 고정한다. 설정 mutation 후 {@code em.flush()/clear()} 로 요청이 DB 최신을
 * 읽게 한다(프로덕션 요청별 독립 트랜잭션과 동일 거동). 읽기·롤백이라 {@code @Transactional}.
 */
@Transactional
class CommentApiIntegrationTest extends IntegrationTest {

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

    // ---------------- 목록(offset·공개) ----------------

    @Test
    void 목록은_작성순으로_인증없이_조회된다() throws Exception {
        User author = persistUser("cmt_list1", "목록작성자1");
        Post post = persistPost(boardId("community"), author, "댓글대상글", false);
        persistComment(post, author, "첫 댓글");
        persistComment(post, author, "둘째 댓글");
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content.length()").value(2))
            .andExpect(jsonPath("$.data.content[0].content").value("첫 댓글"))
            .andExpect(jsonPath("$.data.content[1].content").value("둘째 댓글"))
            .andExpect(jsonPath("$.data.totalElements").value(2))
            // 비로그인 조회는 editable=false.
            .andExpect(jsonPath("$.data.content[0].editable").value(false));
    }

    @Test
    void 목록_없는_글은_404_POST_001() throws Exception {
        mockMvc.perform(get("/api/v1/posts/{p}/comments", "NONEXISTENTPOST00000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("POST_001"));
    }

    @Test
    void 목록_작성자_조회는_editable_true() throws Exception {
        User author = persistUser("cmt_list2", "목록작성자2");
        Post post = persistPost(boardId("community"), author, "글", false);
        persistComment(post, author, "내 댓글");
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId())
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].editable").value(true));
    }

    // ---------------- 작성(allow_comments 게이팅·인증·카운터) ----------------

    @Test
    void 작성_allow_comments_게시판은_인증유저가_201로_작성되고_comment_count가_증가한다() throws Exception {
        User author = persistUser("cmt_w1", "작성자W1");
        User commenter = persistUser("cmt_c1", "댓글러1");
        Post post = persistPost(boardId("community"), author, "댓글허용글", false);
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments", post.getPublicId())
            .with(user(String.valueOf(commenter.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("좋은 글이네요")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.commentPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.createdAt").isNotEmpty());

        flushClear();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isEqualTo(1);
    }

    @Test
    void 작성_미인증은_401() throws Exception {
        User author = persistUser("cmt_w2", "작성자W2");
        Post post = persistPost(boardId("community"), author, "글", false);
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments", post.getPublicId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("비로그인 댓글")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 작성_allow_comments_false_게시판은_422_BOARD_003() throws Exception {
        // 공지(notice) 게시판은 allow_comments=false(V22 시드).
        Post noticePost = persistPost(boardId("notice"), null, "공지글", false, "공지사항");
        User commenter = persistUser("cmt_c2", "댓글러2");
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments", noticePost.getPublicId())
            .with(user(String.valueOf(commenter.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("공지 댓글 시도")))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BOARD_003"));

        flushClear();
        // 게이팅으로 차단됐으니 카운터는 그대로 0.
        assertThat(postRepository.findById(noticePost.getId()).orElseThrow().getCommentCount()).isZero();
    }

    @Test
    void 작성_없는_글은_404_POST_001() throws Exception {
        User commenter = persistUser("cmt_c3", "댓글러3");
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments", "NONEXISTENTPOST00000000001")
            .with(user(String.valueOf(commenter.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("유령글 댓글")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("POST_001"));
    }

    // ---------------- 수정·삭제 IDOR ----------------

    @Test
    void 수정_작성자는_204() throws Exception {
        User author = persistUser("cmt_u1", "댓글작성자1");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment comment = persistComment(post, author, "수정 전");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), comment.getPublicId())
            .with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("수정 후")))
            .andExpect(status().isNoContent());

        flushClear();
        assertThat(commentRepository.findById(comment.getId()).orElseThrow().getContent()).isEqualTo("수정 후");
    }

    @Test
    void 수정_타인은_403_COMMENT_002() throws Exception {
        User author = persistUser("cmt_u2", "댓글작성자2");
        User attacker = persistUser("cmt_atk2", "타인2");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment comment = persistComment(post, author, "원본 댓글");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), comment.getPublicId())
            .with(user(String.valueOf(attacker.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("탈취 수정")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("COMMENT_002"));
    }

    @Test
    void 수정_관리자는_타인_댓글도_204() throws Exception {
        User author = persistUser("cmt_u3", "댓글작성자3");
        User admin = persistUser("cmt_adm3", "관리자3");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment comment = persistComment(post, author, "원본3");
        flushClear();

        mockMvc.perform(put("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), comment.getPublicId())
            .with(adminUser(admin))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("관리자 수정")))
            .andExpect(status().isNoContent());
    }

    @Test
    void 삭제_작성자는_204_soft삭제되고_comment_count가_감소한다() throws Exception {
        User author = persistUser("cmt_d1", "삭제작성자1");
        User commenter = persistUser("cmt_dc1", "댓글러D1");
        Post post = persistPost(boardId("community"), author, "글", false);
        // 작성 API 로 달아 카운터를 1로 만든 뒤 삭제로 0 복귀를 검증한다.
        flushClear();
        mockMvc.perform(post("/api/v1/posts/{p}/comments", post.getPublicId())
            .with(user(String.valueOf(commenter.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(commentBody("지울 댓글")))
            .andExpect(status().isCreated());
        flushClear();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isEqualTo(1);

        Comment saved = commentRepository.findByPostIdAndIsDeletedFalseOrderByIdAsc(
            post.getId(), org.springframework.data.domain.PageRequest.of(0, 10)).getContent().get(0);
        flushClear();

        mockMvc.perform(delete("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), saved.getPublicId())
            .with(user(String.valueOf(commenter.getId()))))
            .andExpect(status().isNoContent());

        flushClear();
        assertThat(commentRepository.findById(saved.getId()).orElseThrow().isDeleted()).isTrue();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isZero();
        // soft delete 댓글은 목록에서 배제된다.
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void 삭제_없는_댓글은_404_COMMENT_001() throws Exception {
        User author = persistUser("cmt_d2", "삭제작성자2");
        Post post = persistPost(boardId("community"), author, "글", false);
        flushClear();

        mockMvc.perform(delete("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), "NONEXISTENTCMT000000000001")
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("COMMENT_001"));
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

    private String commentBody(String content) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        return objectMapper.writeValueAsString(body);
    }

    private Post persistPost(Long boardId, User author, String title, boolean pinned) {
        return persistPost(boardId, author, title, pinned, author != null ? author.getNickname() : "시스템");
    }

    private Post persistPost(Long boardId, User author, String title, boolean pinned, String nickname) {
        return postRepository.save(Post.builder()
            .boardId(boardId)
            .authorId(author != null ? author.getId() : null)
            .authorNickname(nickname)
            .title(title).content("본문").isPinned(pinned).build());
    }

    private Comment persistComment(Post post, User author, String content) {
        return commentRepository.save(Comment.builder()
            .postId(post.getId())
            .authorId(author != null ? author.getId() : null)
            .authorNickname(author != null ? author.getNickname() : "시스템")
            .content(content).build());
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor adminUser(User admin) {
        return user(String.valueOf(admin.getId())).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
