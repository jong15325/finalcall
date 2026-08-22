package com.finalcall.domain.board.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BoardErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.PostErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.board.dto.PostCreateRequest;
import com.finalcall.domain.board.dto.PostCreateResponse;
import com.finalcall.domain.board.dto.PostDetailResponse;
import com.finalcall.domain.board.dto.PostSummary;
import com.finalcall.domain.board.dto.PostUpdateRequest;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.PostCursor;
import com.finalcall.domain.board.entity.WritePolicy;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 게시글 서비스(EPIC-BOARD, FC-198) — 작성(write_policy 인가)·목록(커서)·상세(조회수 원자 증가)·수정/삭제(작성자 OR
 * 관리자 소유검증). board-spec §4·§6 · api §6.2.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기(create·getPost 조회수 증가·update·delete)만
 * 오버라이드(CLAUDE.md §5). {@code @ServiceLog} 부착. 주체는 SecurityContext 기준이다(B-009, IDOR 차단 — 경로·바디에
 * 작성자 식별자를 두지 않는다). 관리자 판정 = JWT {@code admin} 클레임 → {@code ROLE_ADMIN} authority(SecurityConfig 배선).
 *
 * <p><b>인가 불변식(board-spec §4):</b> I-1 작성자=토큰 주체(바디 불신) · I-2 수정·삭제는 {@code authorId==주체} OR
 * {@code ROLE_ADMIN} · I-3 {@code ADMIN_ONLY} 게시판은 작성자라도 비관리자 수정·삭제 불가(BOARD_002).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostService {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final PostRepository postRepository;
    private final BoardRepository boardRepository;
    private final UserRepository userRepository;
    private final PostImageService postImageService;

    /** 게시판별 글 목록(api §6.2, 커서) — 미삭제, is_pinned DESC·id DESC. 비활성·미존재 게시판은 {@code BOARD_001}(404). */
    @ServiceLog
    public CursorResponse<PostSummary, String> getPosts(String slug, String cursor, int size) {
        Board board = boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
        List<Post> fetched = postRepository.findByBoardCursor(board.getId(), PostCursor.decode(cursor), size);
        // 글당 첫 첨부 이미지 presigned 썸네일을 배치로 조립(N+1 회피). 첨부 없는 글은 맵에 없어 null 로 렌더된다.
        Map<Long, String> thumbnails = postImageService.thumbnailsOf(fetched.stream().map(Post::getId).toList());
        Map<Long, User> authors = userRepository.findAllById(
            fetched.stream().map(Post::getAuthorId).filter(java.util.Objects::nonNull).distinct().toList()).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
        return CursorResponse.from(fetched, size,
            post -> PostSummary.from(post, thumbnails.get(post.getId()),
                primaryCharacterId(authors.get(post.getAuthorId()))),
            post -> PostCursor.encode(post.isPinned(), post.getId()));
    }

    /**
     * 게시글 작성(api §6.2). 작성자=주체(닉 스냅샷), write_policy 게이팅 — {@code ADMIN_ONLY} 게시판은 {@code ROLE_ADMIN}
     * 필요(BOARD_002), {@code AUTHENTICATED} 는 임의 인증(SecurityConfig 가 인증을 강제). 카운터는 서버가 0 으로 세팅한다.
     * {@code imagePublicIds}(≤10) 는 업로드된 고아 이미지를 이 글에 바인딩한다({@link PostImageService#bind} — 업로더==주체
     * 검증·고아만·배열 순서 sort, FC-200). 바인딩은 같은 TX 라 실패 시 글 저장까지 롤백된다.
     */
    @Transactional
    @ServiceLog
    public PostCreateResponse create(String slug, PostCreateRequest request) {
        Long authorId = currentUserId();
        boolean admin = currentUserIsAdmin();
        Board board = boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
        Preconditions.validate(canWrite(board, admin), BoardErrorCode.BOARD_WRITE_FORBIDDEN);

        User author = userRepository.findByIdAndIsDeletedFalse(authorId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        Post saved = postRepository.save(Post.builder()
            .boardId(board.getId())
            .authorId(authorId)
            .authorNickname(author.getNickname())
            .title(request.title())
            .content(request.content())
            .isPinned(false)
            .build());
        // 업로드된 고아 이미지들을 이 글에 바인딩(업로더==주체 검증·고아만·배열 순서 sort). 같은 TX 라 실패 시 글도 롤백.
        postImageService.bind(saved.getId(), request.imagePublicIds(), authorId);
        return PostCreateResponse.from(saved);
    }

    /**
     * 게시글 상세(api §6.2, 공개) — 조회수를 원자 증가(board-spec §6.2, 디둡 없음)하고 응답에 그 증가를 반영한다.
     * 삭제·미존재 글은 {@code POST_001}(404), 경로 slug 게시판과 글의 board 불일치도 {@code POST_001}. {@code editable} 은
     * 요청 주체(nullable — 공개 조회)가 작성자이거나 관리자면 true 다(프론트 버튼 제어, 인가 권위는 서버).
     */
    @Transactional
    @ServiceLog
    public PostDetailResponse getPost(String slug, String postPublicId) {
        Board board = boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Preconditions.validate(post.belongsToBoard(board.getId()), PostErrorCode.POST_NOT_FOUND);

        postRepository.incrementViewCount(post.getId()); // 원자 증가 + 컨텍스트 clear(post detach)
        post.increaseViewCount(); // detach 인스턴스 in-memory +1 — 응답에 이번 조회 반영(재-flush 없음)

        Long viewerId = currentUserIdOrNull();
        boolean editable = post.isOwnedBy(viewerId) || (viewerId != null && currentUserIsAdmin());
        User author = post.getAuthorId() == null ? null : userRepository.findById(post.getAuthorId()).orElse(null);
        return PostDetailResponse.from(post, board.getSlug(), editable, postImageService.imagesOf(post.getId()),
            primaryCharacterId(author));
    }

    /**
     * 게시글 수정(api §6.2). 인가 = (작성자 본인) OR {@code ROLE_ADMIN}, 단 {@code ADMIN_ONLY} 게시판은 관리자만
     * (작성자라도 비관리자 불가, board-spec I-3 → BOARD_002). {@code imagePublicIds} 는 최종 이미지 집합으로 재바인딩한다
     * ({@link PostImageService#bind} — 누락분 언바인딩·신규분 바인딩, FC-200).
     */
    @Transactional
    @ServiceLog
    public void update(String slug, String postPublicId, PostUpdateRequest request) {
        Long subject = currentUserId();
        boolean admin = currentUserIsAdmin();
        Board board = boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
        Post post = loadPostInBoard(board, postPublicId);
        authorizeMutate(board, post, subject, admin);
        post.update(request.title(), request.content()); // dirty checking 으로 flush 시 반영
        // imagePublicIds 는 최종 이미지 집합 — 누락분 언바인딩·신규분 바인딩(업로더==주체 검증). 같은 TX.
        postImageService.bind(post.getId(), request.imagePublicIds(), subject);
    }

    /**
     * 게시글 삭제(api §6.2, soft delete). 인가는 수정과 동일(작성자 OR 관리자, ADMIN_ONLY 는 관리자만). 댓글은 글 필터로
     * 자연 배제된다(개별 정리 없음, board-spec C-1).
     */
    @Transactional
    @ServiceLog
    public void delete(String slug, String postPublicId) {
        Long subject = currentUserId();
        boolean admin = currentUserIsAdmin();
        Board board = boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
        Post post = loadPostInBoard(board, postPublicId);
        authorizeMutate(board, post, subject, admin);
        post.delete(Instant.now());
    }

    /** 경로 slug 게시판에 귀속된 활성 글을 로드한다(미존재·삭제·board 불일치는 {@code POST_001}). */
    private Post loadPostInBoard(Board board, String postPublicId) {
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Preconditions.validate(post.belongsToBoard(board.getId()), PostErrorCode.POST_NOT_FOUND);
        return post;
    }

    /**
     * 수정·삭제 인가(board-spec §4·I-2·I-3). {@code ADMIN_ONLY} 게시판은 관리자만(BOARD_002 — 작성자라도 비관리자 불가),
     * 그 외 게시판은 작성자 본인 OR 관리자(POST_002 — IDOR 차단).
     */
    private void authorizeMutate(Board board, Post post, Long subject, boolean admin) {
        if (board.getWritePolicy() == WritePolicy.ADMIN_ONLY) {
            Preconditions.validate(admin, BoardErrorCode.BOARD_WRITE_FORBIDDEN);
            return;
        }
        Preconditions.validate(post.isOwnedBy(subject) || admin, PostErrorCode.POST_NOT_OWNER);
    }

    /** 작성 쓰기정책 게이팅 — {@code ADMIN_ONLY} 는 관리자만, {@code AUTHENTICATED} 는 임의 인증(항상 허용). */
    private boolean canWrite(Board board, boolean admin) {
        return board.getWritePolicy() != WritePolicy.ADMIN_ONLY || admin;
    }

    private Integer primaryCharacterId(User user) {
        return user == null || user.isDeleted() ? null : user.getPrimaryCharacterId();
    }

    /** 인증 주체(내부 PK)를 해석한다. 쓰기 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }

    /** 인증 주체(내부 PK)를 nullable 로 해석한다. 비인증·익명 컨텍스트면 null(상세 조회 등 공개 엔드포인트). */
    private Long currentUserIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** 요청 주체가 관리자({@code ROLE_ADMIN})인지 — JWT admin 클레임이 authority 로 배선된다(JwtAuthenticationFilter). */
    private boolean currentUserIsAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (ROLE_ADMIN.equals(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
