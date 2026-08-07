package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
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
 * 대댓글 threading 통합 검증(EPIC-COMMENT-V2, FC-207) — 실제 MySQL(Testcontainers) + Flyway V22/V24 + Security 필터.
 *
 * <p>계약 api §6.3 · board-spec §13. 답글 작성(루트 정규화·@멘션 파생)·답글 목록(id asc)·최상위 목록(루트만·replyCount)·
 * tombstone(활성 답글 보유 루트 삭제 시 마스킹 잔류·해소 시 완전 배제)·comment_count(루트+답글 총계) 동기화·정렬(LATEST/OLDEST)를
 * 고정한다. 설정 mutation 후 {@code em.flush()/clear()} 로 요청이 DB 최신을 읽게 한다(요청별 독립 TX 와 동일 거동).
 */
@Transactional
class CommentThreadingApiIntegrationTest extends IntegrationTest {

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

    // ---------------- 답글 작성·카운터 ----------------

    @Test
    void 답글_작성시_201이고_루트_replyCount와_post_comment_count가_증가한다() throws Exception {
        User author = persistUser("thr_w1", "글쓴이1");
        User replier = persistUser("thr_r1", "답글러1");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "루트 댓글", null, null);
        flushClear();
        // 루트 자체의 comment_count 를 1 로 만들어(작성 API 대신 직접 세팅) 답글 +1 로 총계 2 를 검증한다.
        postRepository.incrementCommentCount(post.getId());
        flushClear();

        String replyId = createReplyApi(post, root, replier, "답글입니다");

        flushClear();
        Comment reply = commentRepository.findByPublicId(replyId).orElseThrow();
        assertThat(reply.getParentCommentId()).isEqualTo(root.getId());
        assertThat(reply.getMentionedNickname()).isNull(); // 루트에 직접 단 답글은 멘션 없음
        assertThat(commentRepository.findById(root.getId()).orElseThrow().getReplyCount()).isEqualTo(1);
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isEqualTo(2);
    }

    @Test
    void 답글의_답글은_같은_루트로_평탄화되고_mentionedNickname이_대상작성자_닉이다() throws Exception {
        User author = persistUser("thr_w2", "글쓴이2");
        User beta = persistUser("thr_b2", "베타");
        User gamma = persistUser("thr_c2", "감마");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "루트", null, null);
        flushClear();

        // 베타가 루트에 답글 → 멘션 없음.
        String reply1Id = createReplyApi(post, root, beta, "베타의 답글");
        flushClear();
        Comment reply1 = commentRepository.findByPublicId(reply1Id).orElseThrow();

        // 감마가 베타의 답글에 답글 → 루트로 평탄화·멘션 = 베타 닉.
        String reply2Id = createReplyApi(post, reply1, gamma, "감마가 베타에게");
        flushClear();

        Comment reply2 = commentRepository.findByPublicId(reply2Id).orElseThrow();
        assertThat(reply2.getParentCommentId()).isEqualTo(root.getId()); // 2단계 아님 — 루트로 평탄화
        assertThat(reply2.getMentionedNickname()).isEqualTo("베타");
        assertThat(commentRepository.findById(root.getId()).orElseThrow().getReplyCount()).isEqualTo(2);
    }

    @Test
    void 답글_대상_댓글이_없으면_404_COMMENT_001() throws Exception {
        User author = persistUser("thr_w3", "글쓴이3");
        User replier = persistUser("thr_r3", "답글러3");
        Post post = persistPost(boardId("community"), author, "글", false);
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), "NONEXISTENTCMT000000000001")
            .with(user(String.valueOf(replier.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body("유령 답글")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("COMMENT_001"));
    }

    @Test
    void 답글_미인증은_401() throws Exception {
        User author = persistUser("thr_w4", "글쓴이4");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "루트", null, null);
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), root.getPublicId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body("비로그인 답글")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 답글_allow_comments_false_게시판은_422_BOARD_003() throws Exception {
        // 공지(notice) 게시판은 allow_comments=false(V22 시드).
        Post noticePost = persistPost(boardId("notice"), null, "공지글", false, "공지사항");
        Comment root = persistComment(noticePost, null, "시스템 루트", null, null);
        User replier = persistUser("thr_r5", "답글러5");
        flushClear();

        mockMvc.perform(post("/api/v1/posts/{p}/comments/{c}/replies", noticePost.getPublicId(), root.getPublicId())
            .with(user(String.valueOf(replier.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body("공지 답글 시도")))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BOARD_003"));
    }

    // ---------------- 답글 목록·최상위 목록 ----------------

    @Test
    void 답글_목록은_시간순_id_asc로_조회되고_mentionedNickname을_싣는다() throws Exception {
        User author = persistUser("thr_w6", "글쓴이6");
        User delta = persistUser("thr_b6", "델타");
        User epsilon = persistUser("thr_c6", "엡실론");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "루트", null, null);
        flushClear();
        String r1 = createReplyApi(post, root, delta, "델타 답글");
        flushClear();
        createReplyApi(post, commentRepository.findByPublicId(r1).orElseThrow(), epsilon, "엡실론이 델타에게");
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), root.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(2))
            .andExpect(jsonPath("$.data.content[0].content").value("델타 답글"))
            .andExpect(jsonPath("$.data.content[0].mentionedNickname").doesNotExist())
            .andExpect(jsonPath("$.data.content[1].content").value("엡실론이 델타에게"))
            .andExpect(jsonPath("$.data.content[1].mentionedNickname").value("델타"))
            .andExpect(jsonPath("$.data.totalElements").value(2));
    }

    @Test
    void 최상위_목록은_루트만_반환하고_replyCount를_싣는다() throws Exception {
        User author = persistUser("thr_w7", "글쓴이7");
        User replier = persistUser("thr_r7", "답글러7");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "루트 댓글", null, null);
        flushClear();
        createReplyApi(post, root, replier, "답글1");
        createReplyApi(post, root, replier, "답글2");
        flushClear();

        // 목록은 루트 1건만(답글 2건은 별도 API), replyCount=2.
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].content").value("루트 댓글"))
            .andExpect(jsonPath("$.data.content[0].replyCount").value(2))
            .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void 답글_목록_대상글이_없으면_404_POST_001() throws Exception {
        mockMvc.perform(get("/api/v1/posts/{p}/comments/{c}/replies",
            "NONEXISTENTPOST00000000001", "NONEXISTENTCMT000000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("POST_001"));
    }

    // ---------------- tombstone ----------------

    @Test
    void 활성답글_보유_루트_삭제는_tombstone으로_마스킹_잔류하고_답글은_접근가능하다() throws Exception {
        User author = persistUser("thr_w8", "글쓴이8");
        User replier = persistUser("thr_r8", "답글러8");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "지울 루트", null, null);
        flushClear();
        postRepository.incrementCommentCount(post.getId()); // 루트 자체 카운트
        String replyId = createReplyApi(post, root, replier, "살아남을 답글");
        flushClear();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isEqualTo(2);

        // 루트 삭제(작성자) → 활성 답글이 있으므로 tombstone.
        mockMvc.perform(delete("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), root.getPublicId())
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isNoContent());
        flushClear();

        // comment_count 는 루트 −1 → 1(답글 1건만 총계).
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isEqualTo(1);

        // 목록: tombstone 잔류(deleted:true·content/author null·replyCount 유지).
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].deleted").value(true))
            .andExpect(jsonPath("$.data.content[0].content").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.data.content[0].authorNickname").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.data.content[0].likeCount").value(0))
            .andExpect(jsonPath("$.data.content[0].replyCount").value(1))
            .andExpect(jsonPath("$.data.content[0].ownedByMe").value(false));

        // 답글은 여전히 접근 가능(tombstone 루트 하위).
        mockMvc.perform(get("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), root.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].content").value("살아남을 답글"));

        // tombstone 루트에는 신규 답글 불가(§13.4) → COMMENT_001.
        mockMvc.perform(post("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), root.getPublicId())
            .with(user(String.valueOf(replier.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body("죽은 루트에 답글")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("COMMENT_001"));

        // 마지막 답글까지 삭제하면 tombstone 이 완전 배제된다.
        mockMvc.perform(delete("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), replyId)
            .with(user(String.valueOf(replier.getId()))))
            .andExpect(status().isNoContent());
        flushClear();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getCommentCount()).isZero();
        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void 답글_없는_루트_삭제는_완전배제된다() throws Exception {
        User author = persistUser("thr_w9", "글쓴이9");
        Post post = persistPost(boardId("community"), author, "글", false);
        Comment root = persistComment(post, author, "외톨이 루트", null, null);
        flushClear();
        postRepository.incrementCommentCount(post.getId());
        flushClear();

        mockMvc.perform(delete("/api/v1/posts/{p}/comments/{c}", post.getPublicId(), root.getPublicId())
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isNoContent());
        flushClear();

        mockMvc.perform(get("/api/v1/posts/{p}/comments", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.totalElements").value(0));
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

    private String body(String content) throws Exception {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("content", content);
        return objectMapper.writeValueAsString(map);
    }

    /** 답글 작성 API 를 호출하고 생성된 답글 publicId 를 반환한다(응답 {@code data.commentPublicId} 파싱). */
    private String createReplyApi(Post post, Comment target, User replier, String content) throws Exception {
        String response = mockMvc.perform(
            post("/api/v1/posts/{p}/comments/{c}/replies", post.getPublicId(), target.getPublicId())
                .with(user(String.valueOf(replier.getId())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(content)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.path("data").path("commentPublicId").asText();
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

    private Comment persistComment(Post post, User author, String content, Long parentCommentId,
        String mentionedNickname) {
        return commentRepository.save(Comment.builder()
            .postId(post.getId())
            .authorId(author != null ? author.getId() : null)
            .authorNickname(author != null ? author.getNickname() : "시스템")
            .content(content)
            .parentCommentId(parentCommentId)
            .mentionedNickname(mentionedNickname)
            .build());
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }
}
