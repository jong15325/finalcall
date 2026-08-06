package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.IntConsumer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.domain.board.dto.CommentReactionRequest;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Comment;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.ReactionType;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.CommentReactionRepository;
import com.finalcall.domain.board.repository.CommentRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.board.service.CommentService;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 댓글 반응 동시성 통합 검증(EPIC-COMMENT-V2, FC-208) — 실제 MySQL(Testcontainers), 실제 커밋. board-spec §13.2·R-1·R-2 를
 * 경합으로 고정한다: 서로 다른 유저가 같은 댓글에 동시에 공감해도 <b>손실 증분 없이</b> {@code like_count} 가 정확히 시도 수만큼
 * 누적되고(원자 UPDATE), 유저당 <b>정확히 1행</b>(UK)만 생긴다(이중 반응·이중 카운트 없음).
 *
 * <p>서비스 {@code toggleReaction} 을 스레드별 {@link SecurityContext}(각 반응러 주체)로 직접 호출한다 — 각 호출은 자체
 * {@code @Transactional} 로 커밋되며, 같은 comment 행의 카운트 UPDATE 가 행 락으로 직렬화되어 정합을 보장한다.
 *
 * <p>★ 실제 커밋이 필요해 {@code @Transactional} 을 걸지 않고, 생성 데이터는 {@code @AfterEach} 로 정리한다.
 */
class CommentReactionConcurrencyIntegrationTest extends IntegrationTest {

    private static final int REACTORS = 40; // 동시에 공감하는 서로 다른 유저 수

    @Autowired
    private CommentService commentService;

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

    private final List<Long> createdUserIds = new ArrayList<>();
    private Long postId;
    private Long commentId;

    @AfterEach
    void cleanup() {
        // FK 순서: 반응 → 댓글 → 글 → user. 이 테스트가 만든 것만 지운다(반응은 이 비-tx 테스트만 커밋).
        commentReactionRepository.deleteAllInBatch();
        if (commentId != null) {
            commentRepository.deleteById(commentId);
        }
        if (postId != null) {
            postRepository.deleteById(postId);
        }
        userRepository.deleteAllById(createdUserIds);
        createdUserIds.clear();
        postId = null;
        commentId = null;
    }

    @Test
    void 서로다른_유저의_동시_공감은_손실없이_정확히_누적되고_유저당_1행이다() throws Exception {
        User author = persistUser("rxcc_a", "글쓴이");
        Post post = postRepository.save(Post.builder()
            .boardId(boardId("community")).authorId(author.getId()).authorNickname(author.getNickname())
            .title("경합 글").content("본문").isPinned(false).build());
        Comment comment = commentRepository.save(Comment.builder()
            .postId(post.getId()).authorId(author.getId()).authorNickname(author.getNickname())
            .content("경합 대상 댓글").build());
        postId = post.getId();
        commentId = comment.getId();

        User[] reactors = new User[REACTORS];
        for (int i = 0; i < REACTORS; i++) {
            reactors[i] = persistUser("rxcc_r" + i, "반응러" + i);
        }
        String postPublicId = post.getPublicId();
        String commentPublicId = comment.getPublicId();

        List<Throwable> errors = runConcurrently(REACTORS,
            index -> reactAs(reactors[index].getId(), postPublicId, commentPublicId));

        assertThat(errors).isEmpty(); // 교착·예외로 새는 요청 없음
        // R-2: 원자 UPDATE 로 손실 증분 없이 정확히 REACTORS 만큼 누적.
        assertThat(commentRepository.findById(commentId).orElseThrow().getLikeCount()).isEqualTo(REACTORS);
        // R-1: 유저당 1행 — 반응 행 총계 = REACTORS(이중 반응 없음).
        assertThat(commentReactionRepository.count()).isEqualTo(REACTORS);
    }

    @Test
    void 같은_유저_동시_반응은_500없이_토글로_수렴한다() throws Exception {
        // M-1 회귀: 같은 유저가 같은 댓글에 짝수 번 동시 공감 → 직렬화로 UK 위반(500)·StaleState 없이 토글 수렴.
        User author = persistUser("rxdup_a", "글쓴이");
        User reactor = persistUser("rxdup_r", "더블탭러");
        Post post = postRepository.save(Post.builder()
            .boardId(boardId("community")).authorId(author.getId()).authorNickname(author.getNickname())
            .title("더블탭 글").content("본문").isPinned(false).build());
        Comment comment = commentRepository.save(Comment.builder()
            .postId(post.getId()).authorId(author.getId()).authorNickname(author.getNickname())
            .content("더블탭 대상 댓글").build());
        postId = post.getId();
        commentId = comment.getId();
        String postPublicId = post.getPublicId();
        String commentPublicId = comment.getPublicId();

        int submits = 8; // 짝수 — 동일 LIKE 토글이 직렬로 on/off 반복 → 순 결과 off(0)
        List<Throwable> errors = runConcurrently(submits,
            index -> reactAs(reactor.getId(), postPublicId, commentPublicId));

        // 핵심: 어느 요청도 500(UK 위반·StaleState)으로 새지 않는다(패자는 재판정으로 수렴).
        assertThat(errors).isEmpty();
        // 직렬화 하에 짝수 번 동일 토글 → 순 off: 카운트 0·반응 행 0(카운트-행 정합 유지).
        assertThat(commentRepository.findById(commentId).orElseThrow().getLikeCount()).isZero();
        assertThat(commentReactionRepository.count()).isZero();
    }

    /** 주어진 주체로 SecurityContext 를 세팅하고 공감 토글을 호출한다(스레드별 ThreadLocal 컨텍스트, 종료 시 정리). */
    private void reactAs(Long userId, String postPublicId, String commentPublicId) {
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of()));
        SecurityContextHolder.setContext(ctx);
        try {
            commentService.toggleReaction(postPublicId, commentPublicId, new CommentReactionRequest(ReactionType.LIKE));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * {@code count} 개 스레드로 {@code op}(index)를 일제히 실행하고, 각 스레드가 던진 예외를 수집해 반환한다
     * (UserBalanceConcurrency hammer 선례 + 예외 수집). 반환 리스트가 비어야 500 노출이 없다.
     */
    private List<Throwable> runConcurrently(int count, IntConsumer op) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(count);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(count);
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());
        try {
            for (int i = 0; i < count; i++) {
                int index = i;
                pool.submit(() -> {
                    try {
                        ready.await();
                        op.accept(index);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } catch (Throwable t) {
                        errors.add(t); // toggleReaction 이 던진 예외(UK 위반·StaleState 등)를 포착
                    } finally {
                        done.countDown();
                    }
                });
            }
            ready.countDown(); // 일제 시작
            assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
        return errors;
    }

    private Long boardId(String slug) {
        Board board = boardRepository.findBySlugAndIsActiveTrue(slug).orElseThrow();
        return board.getId();
    }

    private User persistUser(String loginId, String nickname) {
        User saved = userRepository.save(
            User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
        createdUserIds.add(saved.getId());
        return saved;
    }
}
