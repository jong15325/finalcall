package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.PostImage;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.PostImageRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.storage.StoragePort;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 이미지 업로드·게시글 바인딩 통합 검증(EPIC-BOARD, FC-200) — 실제 MySQL(Testcontainers) + Flyway V22 + Security 필터.
 * 오브젝트 스토리지({@link StoragePort})만 {@code @MockBean} 으로 대체해 검증을 스토리지 무관하게 만든다(실 MinIO PUT·
 * presigned 는 {@code BoardImageStorageIntegrationTest} 가 전담) — 여기서는 업로드 검증(MIME/용량)과 <b>바인딩 인가</b>
 * (업로더==주체·고아만·재귀속 금지)·상세/목록 presigned 렌더 배선을 DB 실체로 고정한다.
 *
 * <p>계약 api §6.4·§6.2 · board-spec §7·I-1. 설정 mutation 후 {@code em.flush()/clear()} 로 요청이 DB 최신을 읽게 한다.
 */
@Transactional
class BoardImageApiIntegrationTest extends IntegrationTest {

    private static final String SIGNED_PREFIX = "https://signed.example/";

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
    private PostImageRepository postImageRepository;

    @MockBean
    private StoragePort storagePort;

    // ---------------- 업로드 검증 ----------------

    @Test
    void 업로드는_인증유저가_201로_imagePublicId와_presigned_url을_받는다() throws Exception {
        given(storagePort.presignedGetUrl(any(), any())).willAnswer(inv -> SIGNED_PREFIX + inv.getArgument(0));
        User uploader = persistUser("img_up1", "업로더1");
        flushClear();

        MockMultipartFile file = new MockMultipartFile("file", "pic.png", "image/png", pngBytes(64));
        mockMvc.perform(multipart("/api/v1/board-images").file(file).with(user(String.valueOf(uploader.getId()))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.imagePublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.startsWith(SIGNED_PREFIX + "board/")));
    }

    @Test
    void 업로드_미인증은_401() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "pic.png", "image/png", pngBytes(64));
        mockMvc.perform(multipart("/api/v1/board-images").file(file))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 업로드_미허용형식은_422_IMAGE_001() throws Exception {
        User uploader = persistUser("img_up2", "업로더2");
        flushClear();

        // 콘텐츠는 평문(매직바이트 불일치) — 선언 content-type(image/png)을 신뢰하지 않고 실제 콘텐츠로 판정한다.
        MockMultipartFile file = new MockMultipartFile("file", "evil.png", "image/png", "not an image".getBytes());
        mockMvc.perform(multipart("/api/v1/board-images").file(file).with(user(String.valueOf(uploader.getId()))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("IMAGE_001"));
    }

    @Test
    void 업로드_5MB초과는_422_IMAGE_002() throws Exception {
        User uploader = persistUser("img_up3", "업로더3");
        flushClear();

        byte[] tooLarge = pngBytes(5 * 1024 * 1024 + 1); // 5MB + 1
        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", tooLarge);
        mockMvc.perform(multipart("/api/v1/board-images").file(file).with(user(String.valueOf(uploader.getId()))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("IMAGE_002"));
    }

    // ---------------- 바인딩 인가(고아·업로더) + 상세 렌더 ----------------

    @Test
    void 작성시_내_고아이미지를_바인딩하고_상세에_presigned로_렌더한다() throws Exception {
        given(storagePort.presignedGetUrl(any(), any())).willAnswer(inv -> SIGNED_PREFIX + inv.getArgument(0));
        User author = persistUser("img_bind1", "바인딩작성자1");
        PostImage first = persistOrphanImage(author, "keyA");
        PostImage second = persistOrphanImage(author, "keyB");
        flushClear();

        mockMvc.perform(post("/api/v1/boards/community/posts").with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("첨부글", "본문", List.of(first.getPublicId(), second.getPublicId()))))
            .andExpect(status().isCreated());
        flushClear();

        Post post = postRepository.findAll().stream().filter(p -> "첨부글".equals(p.getTitle())).findFirst().orElseThrow();
        mockMvc.perform(get("/api/v1/boards/community/posts/{id}", post.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.images.length()").value(2))
            .andExpect(jsonPath("$.data.images[0].imagePublicId").value(first.getPublicId()))
            .andExpect(jsonPath("$.data.images[0].sortOrder").value(0))
            .andExpect(jsonPath("$.data.images[0].url").value(SIGNED_PREFIX + "keyA"))
            .andExpect(jsonPath("$.data.images[1].imagePublicId").value(second.getPublicId()))
            .andExpect(jsonPath("$.data.images[1].sortOrder").value(1));
    }

    @Test
    void 작성시_타인_고아이미지_바인딩은_400() throws Exception {
        User author = persistUser("img_bind2", "바인딩작성자2");
        User other = persistUser("img_other2", "타인2");
        PostImage othersImage = persistOrphanImage(other, "keyOther");
        flushClear();

        // 업로더가 아닌 주체가 타인의 고아 이미지를 귀속하려 하면 검증 400 으로 거부(board-spec I-1).
        mockMvc.perform(post("/api/v1/boards/community/posts").with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("탈취시도", "본문", List.of(othersImage.getPublicId()))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));
        flushClear();
        // 바인딩은 mutate 전에 인가 검증에서 거부하므로 타인 이미지는 손대지 않고 그대로 고아다(글 저장까지의 롤백은
        //   프로덕션 tx 속성 — @Transactional 테스트는 물리 tx 를 공유해 롤백을 관측할 수 없어 여기선 단언하지 않는다).
        assertThat(postImageRepository.findByPublicId(othersImage.getPublicId()).orElseThrow().isOrphan()).isTrue();
    }

    @Test
    void 작성시_이미_다른글에_바인딩된_이미지_재귀속은_400() throws Exception {
        User author = persistUser("img_bind3", "바인딩작성자3");
        Post existing = persistPost(boardId("community"), author, "기존글");
        PostImage bound = persistBoundImage(author, existing, "keyBound");
        flushClear();

        mockMvc.perform(post("/api/v1/boards/community/posts").with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("재귀속시도", "본문", List.of(bound.getPublicId()))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));
    }

    // ---------------- 수정 재바인딩(누락분 언바인딩·신규분 바인딩) ----------------

    @Test
    void 수정시_최종집합으로_재바인딩한다_누락은_언바인딩_신규는_바인딩() throws Exception {
        User author = persistUser("img_rebind", "재바인딩작성자");
        Post post = persistPost(boardId("community"), author, "재바인딩글");
        PostImage old = persistBoundImage(author, post, "keyOld");
        PostImage fresh = persistOrphanImage(author, "keyFresh");
        flushClear();

        mockMvc.perform(put("/api/v1/boards/community/posts/{id}", post.getPublicId())
            .with(user(String.valueOf(author.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(writeBody("재바인딩글", "수정본문", List.of(fresh.getPublicId()))))
            .andExpect(status().isNoContent());
        flushClear();

        // old 는 최종 집합에서 빠져 고아로 환원, fresh 는 이 글에 바인딩(sort 0).
        assertThat(postImageRepository.findByPublicId(old.getPublicId()).orElseThrow().isOrphan()).isTrue();
        PostImage boundFresh = postImageRepository.findByPublicId(fresh.getPublicId()).orElseThrow();
        assertThat(boundFresh.isBoundTo(post.getId())).isTrue();
        assertThat(boundFresh.getSortOrder()).isZero();
    }

    // ---------------- 목록 썸네일 ----------------

    @Test
    void 목록_썸네일은_첫_첨부이미지_presigned로_채워진다() throws Exception {
        given(storagePort.presignedGetUrl(any(), any())).willAnswer(inv -> SIGNED_PREFIX + inv.getArgument(0));
        User author = persistUser("img_thumb", "썸네일작성자");
        Post post = persistPost(boardId("community"), author, "썸네일글");
        persistBoundImageAt(author, post, "keyThumb0", 0);
        persistBoundImageAt(author, post, "keyThumb1", 1);
        flushClear();

        mockMvc.perform(get("/api/v1/boards/community/posts").param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[?(@.title=='썸네일글')].thumbnailUrl")
                .value(org.hamcrest.Matchers.hasItem(SIGNED_PREFIX + "keyThumb0")));
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

    private String writeBody(String title, String content, List<String> imagePublicIds) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", title);
        body.put("content", content);
        body.put("imagePublicIds", imagePublicIds);
        return objectMapper.writeValueAsString(body);
    }

    private Post persistPost(Long boardId, User author, String title) {
        return postRepository.save(Post.builder()
            .boardId(boardId).authorId(author.getId()).authorNickname(author.getNickname())
            .title(title).content("본문").isPinned(false).build());
    }

    private PostImage persistOrphanImage(User uploader, String storageKey) {
        return postImageRepository.save(PostImage.builder()
            .postId(null).uploaderId(uploader.getId()).storageKey(storageKey)
            .contentType("image/png").fileSize(64).sortOrder(0).build());
    }

    private PostImage persistBoundImage(User uploader, Post post, String storageKey) {
        return persistBoundImageAt(uploader, post, storageKey, 0);
    }

    private PostImage persistBoundImageAt(User uploader, Post post, String storageKey, int sortOrder) {
        return postImageRepository.save(PostImage.builder()
            .postId(post.getId()).uploaderId(uploader.getId()).storageKey(storageKey)
            .contentType("image/png").fileSize(64).sortOrder(sortOrder).build());
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }

    /** 선두를 PNG 매직바이트로 채운 length 바이트 콘텐츠(sniff 통과용). */
    private byte[] pngBytes(int length) {
        byte[] png = new byte[length];
        byte[] magic = {(byte)0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        System.arraycopy(magic, 0, png, 0, Math.min(magic.length, length));
        return png;
    }
}
