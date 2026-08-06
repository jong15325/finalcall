package com.finalcall.domain.board.service;

import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BoardErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommentErrorCode;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.PostErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.board.dto.CommentCreateRequest;
import com.finalcall.domain.board.dto.CommentCreateResponse;
import com.finalcall.domain.board.dto.CommentPageResponse;
import com.finalcall.domain.board.dto.CommentResponse;
import com.finalcall.domain.board.dto.CommentUpdateRequest;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.Comment;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.repository.BoardRepository;
import com.finalcall.domain.board.repository.CommentRepository;
import com.finalcall.domain.board.repository.PostRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 댓글 서비스(EPIC-BOARD, FC-199) — 목록(offset·공개)·작성(allow_comments 게이팅+인증)·수정/삭제(작성자 OR 관리자
 * 소유검증). 작성/삭제 시 {@code post.comment_count} 를 동일 TX 원자 증감한다. board-spec §4·§6 · api §6.3.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기(create·update·delete)만 오버라이드(CLAUDE.md §5).
 * {@code @ServiceLog} 부착. 주체는 SecurityContext 기준이다(B-009, IDOR 차단 — 경로·바디에 작성자 식별자를 두지 않는다).
 * 관리자 판정 = JWT {@code admin} 클레임 → {@code ROLE_ADMIN} authority(SecurityConfig 배선).
 *
 * <p>댓글 경로 {@code /posts/{postPublicId}/comments} 는 slug 가 없으므로, 작성 시 글의 {@code boardId} 로 게시판을 로드해
 * {@code allow_comments} 를 게이팅한다(비허용 = {@code BOARD_003}, 422). 비정규화 카운터 정합(N-1)은 원자 UPDATE 로
 * 유지한다({@code PostRepository.incrementCommentCount}/{@code decrementCommentCount}) — 로드한 Post 의 카운터를 in-memory 로
 * 만지지 않아 동시 댓글 폭주에서 손실 증분이 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final BoardRepository boardRepository;
    private final UserRepository userRepository;

    /**
     * 글별 댓글 목록(api §6.3, offset·공개) — 미삭제, id asc(작성순). 글 미존재·삭제는 {@code POST_001}(404).
     * {@code editable} 은 요청 주체(nullable — 공개 조회)가 각 댓글 작성자이거나 관리자면 true 다(프론트 버튼 제어).
     */
    @ServiceLog
    public CommentPageResponse getComments(String postPublicId, Pageable pageable) {
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Page<Comment> page = commentRepository.findByPostIdAndIsDeletedFalseOrderByIdAsc(post.getId(), pageable);

        Long viewerId = currentUserIdOrNull();
        boolean admin = viewerId != null && currentUserIsAdmin();
        return CommentPageResponse.from(page,
            comment -> CommentResponse.from(comment, isEditable(comment, viewerId, admin)));
    }

    /**
     * 댓글 작성(api §6.3). 작성자=주체(닉 스냅샷). 글 존재(미삭제)·게시판 {@code allow_comments==true} 게이팅 — 비허용은
     * {@code BOARD_003}(422). 저장과 {@code post.comment_count} +1 을 동일 TX 원자 UPDATE 로 수행한다(board-spec §6.1·N-1).
     */
    @Transactional
    @ServiceLog
    public CommentCreateResponse create(String postPublicId, CommentCreateRequest request) {
        Long authorId = currentUserId();
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Board board = boardRepository.findById(post.getBoardId())
            .orElseThrow(() -> new BusinessException(BoardErrorCode.BOARD_NOT_FOUND));
        Preconditions.validate(board.isAllowComments(), BoardErrorCode.BOARD_COMMENTS_NOT_ALLOWED);

        User author = userRepository.findByIdAndIsDeletedFalse(authorId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        Comment saved = commentRepository.save(Comment.builder()
            .postId(post.getId())
            .authorId(authorId)
            .authorNickname(author.getNickname())
            .content(request.content())
            .build());
        postRepository.incrementCommentCount(post.getId()); // 동일 TX 원자 +1(N-1)
        return CommentCreateResponse.from(saved);
    }

    /**
     * 댓글 수정(api §6.3). 인가 = (작성자 본인) OR {@code ROLE_ADMIN}(board-spec I-2 → COMMENT_002). 대상 글·댓글이
     * 없거나 삭제됐으면 {@code COMMENT_001}(404). 카운터 변동 없음(soft delete 만 감소).
     */
    @Transactional
    @ServiceLog
    public void update(String postPublicId, String commentPublicId, CommentUpdateRequest request) {
        Long subject = currentUserId();
        boolean admin = currentUserIsAdmin();
        Comment comment = loadCommentInPost(postPublicId, commentPublicId);
        Preconditions.validate(comment.isOwnedBy(subject) || admin, CommentErrorCode.COMMENT_NOT_OWNER);
        comment.update(request.content()); // dirty checking 으로 flush 시 반영
    }

    /**
     * 댓글 삭제(api §6.3, soft delete). 인가는 수정과 동일(작성자 OR 관리자). soft delete 와 {@code post.comment_count} −1 을
     * 동일 TX 원자 UPDATE 로 수행한다(board-spec §6.1·N-1). 이미 삭제된 댓글은 활성 필터로 {@code COMMENT_001}(404)에 수렴한다.
     */
    @Transactional
    @ServiceLog
    public void delete(String postPublicId, String commentPublicId) {
        Long subject = currentUserId();
        boolean admin = currentUserIsAdmin();
        Comment comment = loadCommentInPost(postPublicId, commentPublicId);
        Preconditions.validate(comment.isOwnedBy(subject) || admin, CommentErrorCode.COMMENT_NOT_OWNER);
        comment.delete(Instant.now());
        postRepository.decrementCommentCount(comment.getPostId()); // 동일 TX 원자 −1(N-1, >0 가드)
    }

    /**
     * 경로 postPublicId 글에 귀속된 활성 댓글을 로드한다. 글·댓글 미존재·삭제, 경로 글 불일치는 전부 {@code COMMENT_001}
     * (404)로 수렴한다 — api §6.3 PUT·DELETE 는 {@code POST_001} 을 열거하지 않고 댓글 도달 불가를 COMMENT_001 로 통일한다.
     */
    private Comment loadCommentInPost(String postPublicId, String commentPublicId) {
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, CommentErrorCode.COMMENT_NOT_FOUND);
        Comment comment = commentRepository.findActiveByPublicIdOrThrow(commentPublicId,
            CommentErrorCode.COMMENT_NOT_FOUND);
        Preconditions.validate(comment.belongsToPost(post.getId()), CommentErrorCode.COMMENT_NOT_FOUND);
        return comment;
    }

    /** {@code editable} 판정 — 요청 주체가 댓글 작성자이거나 관리자면 true(프론트 버튼 제어, 인가 권위는 서버). */
    private boolean isEditable(Comment comment, Long viewerId, boolean admin) {
        return comment.isOwnedBy(viewerId) || admin;
    }

    /** 인증 주체(내부 PK)를 해석한다. 쓰기 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }

    /** 인증 주체(내부 PK)를 nullable 로 해석한다. 비인증·익명 컨텍스트면 null(목록 등 공개 엔드포인트). */
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
