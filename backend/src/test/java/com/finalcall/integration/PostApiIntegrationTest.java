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
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 게시글 CRUD·커서목록·인가 통합 검증(EPIC-BOARD, FC-198) — 실제 MySQL(Testcontainers) + Flyway V22 시드 + Security 필터.
 *
 * <p>계약 api §6.2·§4. 커서 목록(고정 우선·최신순)·작성 write_policy 게이팅(AUTHENTICATED/ADMIN_ONLY)·수정삭제 IDOR
 * (작성자 OR ROLE_ADMIN)·상세 조회수 원자 증가를 고정한다. 설정 mutation 후 {@code em.flush()/clear()} 로 요청이 DB 최신을
 * 읽게 한다(프로덕션 요청별 독립 트랜잭션과 동일 거동). 읽기·롤백이라 {@code @Transactional}.
 */
@Transactional
class PostApiIntegrationTest extends IntegrationTest {

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

    // ---------------- 커서 목록(공개) ----------------

    @Test
    void 목록은_고정글_우선_최신순으로_커서반환하고_인증없이_조회된다() throws Exception {
        User author = persistUser("post_list1", "목록작성자1");
        Long communityId = boardId("community");
        persistPost(communityId, author, "일반1", false);
        persistPost(communityId, author, "일반2", false);
        Post pinned = persistPost(communityId, author, "고정공지", true);
        flushClear();

        mockMvc.perform(get("/api/v1/boards/community/posts").param("size", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content.length()").value(2))
            // 고정 글이 최상단(정렬 1순위), 그 다음 최신순.
            .andExpect(jsonPath("$.data.content[0].postPublicId").value(pinned.getPublicId()))
            .andExpect(jsonPath("$.data.content[0].isPinned").value(true))
            .andExpect(jsonPath("$.data.content[0].thumbnailUrl").doesNotExist())
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());
    }

    @Test
    void 목록_없는_게시판은_404_BOARD_001() throws Exception {
        mockMvc.perform(get("/api/v1/boards/nonexistent/posts"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("BOARD_001"));
    }

    // ---------------- 작성 인가(write_policy) ----------------

    @Test
    void 작성_AUTHENTICATED_게시판은_인증유저가_201로_작성된다() throws Exception {
        User writer = persistUser("post_w1", "작성자W1");
        flushClear();

        mockMvc.perform(post("/api/v1/boards/community/posts").with(user(String.valueOf(writer.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("첫 글", "본문 내용")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.postPublicId").isNotEmpty());
    }

    @Test
    void 작성_미인증은_401() throws Exception {
        mockMvc.perform(post("/api/v1/boards/community/posts")
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("제목", "본문")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 작성_ADMIN_ONLY_게시판은_비관리자면_403_BOARD_002() throws Exception {
        User writer = persistUser("post_w2", "작성자W2");
        flushClear();

        mockMvc.perform(post("/api/v1/boards/notice/posts").with(user(String.valueOf(writer.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("공지 시도", "본문")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("BOARD_002"));
    }

    @Test
    void 작성_ADMIN_ONLY_게시판은_관리자면_201() throws Exception {
        User admin = persistUser("post_adm1", "관리자1");
        flushClear();

        mockMvc.perform(post("/api/v1/boards/notice/posts").with(adminUser(admin))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("운영 공지", "본문")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.postPublicId").isNotEmpty());
    }

    // ---------------- 상세(공개·조회수 증가) ----------------

    @Test
    void 상세는_공개조회되고_조회수를_원자증가한다() throws Exception {
        User author = persistUser("post_det1", "상세작성자1");
        Post saved = persistPost(boardId("community"), author, "상세글", false);
        flushClear();

        mockMvc.perform(get("/api/v1/boards/community/posts/{id}", saved.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("상세글"))
            .andExpect(jsonPath("$.data.boardSlug").value("community"))
            .andExpect(jsonPath("$.data.viewCount").value(1))
            .andExpect(jsonPath("$.data.images.length()").value(0))
            // 비로그인 조회는 editable=false.
            .andExpect(jsonPath("$.data.editable").value(false));

        flushClear();
        assertThat(postRepository.findById(saved.getId()).orElseThrow().getViewCount()).isEqualTo(1);
    }

    @Test
    void 상세_없는_글은_404_POST_001() throws Exception {
        mockMvc.perform(get("/api/v1/boards/community/posts/{id}", "NONEXISTENTPOST00000000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("POST_001"));
    }

    @Test
    void 상세_작성자_조회는_editable_true() throws Exception {
        User author = persistUser("post_det2", "상세작성자2");
        Post saved = persistPost(boardId("community"), author, "내 글", false);
        flushClear();

        mockMvc.perform(get("/api/v1/boards/community/posts/{id}", saved.getPublicId())
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.editable").value(true));
    }

    // ---------------- 수정·삭제 IDOR ----------------

    @Test
    void 수정_작성자는_204() throws Exception {
        User author = persistUser("post_u1", "수정작성자1");
        Post saved = persistPost(boardId("community"), author, "수정 전", false);
        flushClear();

        mockMvc.perform(put("/api/v1/boards/community/posts/{id}", saved.getPublicId())
            .with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("수정 후", "수정 본문")))
            .andExpect(status().isNoContent());

        flushClear();
        assertThat(postRepository.findById(saved.getId()).orElseThrow().getTitle()).isEqualTo("수정 후");
    }

    @Test
    void 수정_타인은_403_POST_002() throws Exception {
        User author = persistUser("post_u2", "수정작성자2");
        User attacker = persistUser("post_atk2", "타인2");
        Post saved = persistPost(boardId("community"), author, "원본", false);
        flushClear();

        mockMvc.perform(put("/api/v1/boards/community/posts/{id}", saved.getPublicId())
            .with(user(String.valueOf(attacker.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("탈취 수정", "본문")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("POST_002"));
    }

    @Test
    void 수정_관리자는_타인_글도_204() throws Exception {
        User author = persistUser("post_u3", "수정작성자3");
        User admin = persistUser("post_adm3", "관리자3");
        Post saved = persistPost(boardId("community"), author, "원본3", false);
        flushClear();

        mockMvc.perform(put("/api/v1/boards/community/posts/{id}", saved.getPublicId())
            .with(adminUser(admin))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("관리자 수정", "본문")))
            .andExpect(status().isNoContent());
    }

    @Test
    void 삭제_작성자는_204_soft삭제된다() throws Exception {
        User author = persistUser("post_d1", "삭제작성자1");
        Post saved = persistPost(boardId("community"), author, "삭제 대상", false);
        flushClear();

        mockMvc.perform(delete("/api/v1/boards/community/posts/{id}", saved.getPublicId())
            .with(user(String.valueOf(author.getId()))))
            .andExpect(status().isNoContent());

        flushClear();
        assertThat(postRepository.findById(saved.getId()).orElseThrow().isDeleted()).isTrue();
        // soft delete 글은 상세에서 POST_001(404)로 배제된다.
        mockMvc.perform(get("/api/v1/boards/community/posts/{id}", saved.getPublicId()))
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

    private String writeBody(String title, String content) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", title);
        body.put("content", content);
        return objectMapper.writeValueAsString(body);
    }

    private Post persistPost(Long boardId, User author, String title, boolean pinned) {
        return postRepository.save(Post.builder()
            .boardId(boardId).authorId(author.getId()).authorNickname(author.getNickname())
            .title(title).content("본문").isPinned(pinned).build());
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor adminUser(User admin) {
        return user(String.valueOf(admin.getId())).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
