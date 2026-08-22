package com.finalcall.domain.board.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

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
import com.finalcall.domain.board.dto.CommentReactionRequest;
import com.finalcall.domain.board.dto.CommentResponse;
import com.finalcall.domain.board.dto.CommentUpdateRequest;
import com.finalcall.domain.board.dto.ReactionResponse;
import com.finalcall.domain.board.dto.ReplyPageResponse;
import com.finalcall.domain.board.dto.ReplyResponse;
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

import lombok.RequiredArgsConstructor;

/**
 * 댓글 서비스(EPIC-BOARD, FC-199 · EPIC-COMMENT-V2, FC-207) — 루트 목록(offset·공개·정렬)·답글 목록·작성(루트·답글,
 * allow_comments 게이팅+인증)·수정/삭제(작성자 OR 관리자 소유검증). 작성/삭제 시 {@code post.comment_count} 를(답글도 총계
 * 포함) 동일 TX 원자 증감하고, 답글 작성/삭제는 루트 {@code comment.reply_count} 도 동일 TX 원자 증감한다. board-spec §4·§6·§13 ·
 * api §6.3.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기(create·createReply·update·delete)만 오버라이드
 * (CLAUDE.md §5). {@code @ServiceLog} 부착. 주체는 SecurityContext 기준이다(B-009, IDOR 차단 — 경로·바디에 작성자 식별자를
 * 두지 않는다). 관리자 판정 = JWT {@code admin} 클레임 → {@code ROLE_ADMIN} authority(SecurityConfig 배선).
 *
 * <p>댓글 경로 {@code /posts/{postPublicId}/comments} 는 slug 가 없으므로, 작성 시 글의 {@code boardId} 로 게시판을 로드해
 * {@code allow_comments} 를 게이팅한다(비허용 = {@code BOARD_003}, 422). 비정규화 카운터 정합(N-1·R-2)은 원자 UPDATE 로
 * 유지한다(PostRepository 의 comment_count 증감·CommentRepository 의 reply_count 증감) — 로드한 엔티티의 카운터를 in-memory
 * 로 만지지 않아 동시 댓글 폭주에서 손실 증분이 없다.
 *
 * <p><b>대댓글 1단계(FC-207, board-spec §13.1)</b>: 답글은 항상 루트에 귀속한다 — 대상이 답글이면 그 루트로 평탄화하고
 * 대상 작성자 닉을 {@code mentionedNickname} 스냅샷에 담는다(@멘션). tombstone 루트(삭제됐으나 활성 답글 보유)에는 신규 답글이
 * 불가하다({@code COMMENT_001}, §13.4).
 *
 * <p><b>공감/비공감(FC-208, board-spec §13.2)</b>: 반응 토글({@link #toggleReaction})은 유저당 댓글당 1행(UK)을 등록/전환/취소로
 * 관리하고, {@code comment.like_count}/{@code dislike_count} 를 동일 TX 원자 UPDATE 로 동기화한다(R-2·이중 카운트 차단). 본인
 * 댓글 반응은 {@code COMMENT_003}(422, R-3). 목록·답글 조회는 뷰어의 반응을 배치 조회({@link #viewerReactions})해 {@code myReaction}
 * 을 채운다(N+1 회피·optional-auth — 비인증은 null).
 *
 * <p><b>정렬(FC-209, board-spec §13.3)</b>: 루트 목록 정렬은 {@code CommentSort}(LATEST/OLDEST/LIKES) 화이트리스트를
 * {@code pageable} 의 Sort 로 주입받는다({@link #getComments}). LIKES 는 순공감({@code like_count}) DESC·id DESC 로
 * 정렬한다(삭제·tombstone 은 목록 매핑에서 마스킹, myReaction·editable 뷰어 종속).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final PostRepository postRepository;
    private final BoardRepository boardRepository;
    private final UserRepository userRepository;

    /**
     * 글별 루트 댓글 목록(api §6.3, FC-207, offset·공개) — {@code parent_comment_id IS NULL AND (is_deleted=false OR
     * reply_count>0)}(tombstone 포함, board-spec §13.4). 정렬은 {@code pageable} 의 Sort(LATEST/OLDEST/LIKES). 글 미존재·삭제는
     * {@code POST_001}(404). {@code editable} 은 요청 주체(nullable — 공개 조회)가 각 댓글 작성자이거나 관리자면 true 다. tombstone
     * 항목은 {@code CommentResponse.fromRoot} 가 마스킹하고 {@code replyCount} 만 남긴다. {@code myReaction} 은 FC-207 에서 null.
     */
    @ServiceLog
    public CommentPageResponse getComments(String postPublicId, Pageable pageable) {
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Page<Comment> page = commentRepository.findRootComments(post.getId(), pageable);

        Long viewerId = currentUserIdOrNull();
        boolean admin = viewerId != null && currentUserIsAdmin();
        Map<Long, ReactionType> myReactions = viewerReactions(page.getContent(), viewerId);
        Map<Long, User> authors = authorsById(page.getContent());
        return CommentPageResponse.from(page,
            comment -> CommentResponse.fromRoot(comment, isEditable(comment, viewerId, admin),
                comment.isOwnedBy(viewerId), myReactionOf(myReactions, comment),
                primaryCharacterId(authors.get(comment.getAuthorId()))));
    }

    /**
     * 루트의 답글 목록(api §6.3, FC-207, offset·공개) — {@code parent_comment_id=루트 AND is_deleted=false}, id asc(시간순 고정).
     * 경로 {@code commentPublicId} 는 루트(프론트 "답글 N개")를 가리키나, 답글 public_id 가 와도 그 루트로 해석한다. tombstone
     * 루트(삭제됐으나 활성 답글 보유)도 답글 접근을 보존한다(§13.4) — 활성 필터 없이 대상을 로드하되, 완전 제거된 루트(삭제 &&
     * reply_count==0)와 미존재는 {@code COMMENT_001}(404). 글 미존재·삭제는 {@code POST_001}(404).
     */
    @ServiceLog
    public ReplyPageResponse getReplies(String postPublicId, String commentPublicId, Pageable pageable) {
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Comment target = commentRepository.findByPublicId(commentPublicId)
            .orElseThrow(() -> new BusinessException(CommentErrorCode.COMMENT_NOT_FOUND));
        Preconditions.validate(target.belongsToPost(post.getId()), CommentErrorCode.COMMENT_NOT_FOUND);
        Comment root = resolveRoot(target);
        // tombstone(삭제 && 활성 답글 보유)은 허용하되, 완전 제거된 루트(삭제 && reply_count==0)는 404 로 수렴한다.
        Preconditions.validate(!root.isDeleted() || root.getReplyCount() > 0, CommentErrorCode.COMMENT_NOT_FOUND);

        Page<Comment> page = commentRepository.findByParentCommentIdAndIsDeletedFalseOrderByIdAsc(
            root.getId(), pageable);
        Long viewerId = currentUserIdOrNull();
        boolean admin = viewerId != null && currentUserIsAdmin();
        Map<Long, ReactionType> myReactions = viewerReactions(page.getContent(), viewerId);
        Map<Long, User> authors = authorsById(page.getContent());
        return ReplyPageResponse.from(page,
            reply -> ReplyResponse.from(reply, isEditable(reply, viewerId, admin),
                reply.isOwnedBy(viewerId), myReactionOf(myReactions, reply),
                primaryCharacterId(authors.get(reply.getAuthorId()))));
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
     * 답글 작성(api §6.3, FC-207 · board-spec §13.1). 작성자=주체(닉 스냅샷). 글 존재(미삭제)·게시판 {@code allow_comments}
     * 게이팅(비허용 {@code BOARD_003}, 422)·대상 댓글 존재(미삭제, {@code COMMENT_001} 404). 대상 댓글의 루트를 해석해 1단계로
     * 평탄화한다 — 대상이 루트면 {@code parentCommentId=대상.id}·{@code mentionedNickname=null}, 대상이 답글이면
     * {@code parentCommentId=대상.parentCommentId}(같은 루트)·{@code mentionedNickname=대상.authorNickname}(@멘션). tombstone
     * 루트에는 답글 불가({@code COMMENT_001}). 저장 + 루트 {@code reply_count} +1 + {@code post.comment_count} +1 을 동일 TX
     * 원자 UPDATE 로 수행한다(답글도 총계 포함, R-2·N-1).
     */
    @Transactional
    @ServiceLog
    public CommentCreateResponse createReply(
        String postPublicId, String commentPublicId, CommentCreateRequest request) {
        Long authorId = currentUserId();
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, PostErrorCode.POST_NOT_FOUND);
        Board board = boardRepository.findById(post.getBoardId())
            .orElseThrow(() -> new BusinessException(BoardErrorCode.BOARD_NOT_FOUND));
        Preconditions.validate(board.isAllowComments(), BoardErrorCode.BOARD_COMMENTS_NOT_ALLOWED);

        // 대상 댓글(답글의 앵커)은 활성이어야 한다 — 삭제·tombstone·미존재는 COMMENT_001(§13.4 삭제 루트 답글 불가).
        Comment target = commentRepository.findActiveByPublicIdOrThrow(
            commentPublicId, CommentErrorCode.COMMENT_NOT_FOUND);
        Preconditions.validate(target.belongsToPost(post.getId()), CommentErrorCode.COMMENT_NOT_FOUND);

        Long rootId;
        String mentionedNickname;
        if (target.isRoot()) {
            rootId = target.getId();
            mentionedNickname = null; // 루트에 직접 단 답글은 멘션 없음
        } else {
            // 대상이 답글이면 그 루트로 평탄화하고, 루트가 tombstone(삭제)이면 신규 답글 불가.
            Comment root = commentRepository.findById(target.getParentCommentId())
                .orElseThrow(() -> new BusinessException(CommentErrorCode.COMMENT_NOT_FOUND));
            Preconditions.validate(!root.isDeleted(), CommentErrorCode.COMMENT_NOT_FOUND);
            rootId = root.getId();
            mentionedNickname = target.getAuthorNickname(); // 대상 답글 작성자에게 @멘션(닉 스냅샷)
        }

        User author = userRepository.findByIdAndIsDeletedFalse(authorId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        Comment saved = commentRepository.save(Comment.builder()
            .postId(post.getId())
            .authorId(authorId)
            .authorNickname(author.getNickname())
            .content(request.content())
            .parentCommentId(rootId)
            .mentionedNickname(mentionedNickname)
            .build());
        commentRepository.incrementReplyCount(rootId); // 루트 reply_count 동일 TX 원자 +1(R-2)
        postRepository.incrementCommentCount(post.getId()); // 총계 comment_count 동일 TX 원자 +1(답글도 포함, N-1)
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
     * 댓글·답글 삭제(api §6.3, soft delete). 인가는 수정과 동일(작성자 OR 관리자). soft delete 와 {@code post.comment_count} −1 을
     * 동일 TX 원자 UPDATE 로 수행한다(board-spec §6.1·N-1). <b>답글 삭제면 루트 {@code reply_count} −1</b>도 동일 TX(R-2) —
     * 이로써 tombstone 루트는 마지막 답글이 사라지면 목록에서 자연 배제된다(§13.4). 루트 삭제 시 활성 답글이 있으면 tombstone 으로
     * 잔류(목록 매핑에서 마스킹), 없으면 완전 배제(활성 필터). 이미 삭제된 댓글은 활성 필터로 {@code COMMENT_001}(404)에 수렴한다.
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
        if (!comment.isRoot()) {
            commentRepository.decrementReplyCount(comment.getParentCommentId()); // 답글 삭제 → 루트 reply_count −1(R-2)
        }
    }

    /**
     * 공감/비공감 토글(api §6.3, FC-208 · board-spec §13.2·R-1~R-3). 주체=SecurityContext(인증 강제). 대상 댓글은 활성이어야
     * 하며(삭제·tombstone·미존재는 {@code COMMENT_001}, §13.4 삭제 루트 반응 불가), <b>본인 작성 댓글은 반응 불가</b>
     * ({@code COMMENT_003}, 422, self-bid 선례). 유저당 댓글당 1행(UK)을 등록/전환/취소로 토글한다:
     * <ul>
     *   <li>무반응 + {@code type} → INSERT(해당 카운트 +1)
     *   <li>같은 종류 재요청 → DELETE(취소, 해당 카운트 −1)
     *   <li>다른 종류 → 행 UPDATE(전환, 한쪽 −1·다른쪽 +1)
     * </ul>
     * 카운트는 {@code comment.like_count}/{@code dislike_count} 에 <b>동일 TX 원자 UPDATE</b>로만 반영한다(R-2, in-memory
     * 증감 금지 — 동시 반응 폭주에서 손실 없음). 응답 카운트는 <b>X 락으로 읽은 최신 스냅샷</b> + 이번 요청 델타로 조립한다
     * (직렬화 하에 권위값 — DB 저장값은 원자 UPDATE 가 보장하고, 응답은 주체의 반응 결과를 정확히 싣는다).
     *
     * <p><b>직렬화·락 순서(락-트랜잭션 순서 함정, M-1)</b>: 대상 comment 행에 <b>비관적 X 락(FOR UPDATE)을 판정 SELECT 보다
     * 먼저</b> 잡아, 이 댓글의 모든 반응 요청을 comment 행에서 완전 직렬화한다. 이로써:
     * <ul>
     *   <li><b>동일 유저 더블서브밋</b>(모바일 더블탭·BEST+목록 연타)에서 패자가 승자 커밋 <b>후</b> 최신 상태를 재판정한다 —
     *       승자의 반응 행을 보고 전환/취소 경로로 흡수하므로 UK({@code uk_comment_reaction}) 위반(=미처리 500)이 발생하지
     *       않는다(spec §13.2 "경합 시 재조회·전환 경로"로 멱등 수렴). switch/cancel 경합의 0행 UPDATE({@code StaleStateException})
     *       도 직렬화로 원천 차단된다.
     *   <li><b>멀티 유저 동시 반응</b>은 X 락으로 순차 진입해 카운트가 손실 없이 정확히 누적된다(R-2). 반응 INSERT 의 FK
     *       공유(S) 락은 이미 보유한 X 와 동일 TX 라 호환 → S→X 승격 교착도 없다.
     * </ul>
     */
    @Transactional
    @ServiceLog
    public ReactionResponse toggleReaction(
        String postPublicId, String commentPublicId, CommentReactionRequest request) {
        Long userId = currentUserId();
        ReactionType type = request.type();
        // 대상 도달 실패(글·댓글 미존재·삭제·경로 불일치)는 전부 COMMENT_001 로 수렴한다(api §6.3 — reaction 은 POST_001 미열거).
        Post post = postRepository.findActiveByPublicIdOrThrow(postPublicId, CommentErrorCode.COMMENT_NOT_FOUND);
        // ★ M-1: 판정 전에 comment 행 X 락(FOR UPDATE)을 잡아 이 댓글의 반응 요청을 직렬화한다 — 동일 유저 경합이
        //   UK 위반(500)으로 새지 않고 최신 상태를 재판정해 토글로 수렴하도록. 최신 카운트도 이 잠금 read 로 확보한다.
        Comment comment = commentRepository.findActiveByPublicIdForUpdate(commentPublicId)
            .orElseThrow(() -> new BusinessException(CommentErrorCode.COMMENT_NOT_FOUND));
        Preconditions.validate(comment.belongsToPost(post.getId()), CommentErrorCode.COMMENT_NOT_FOUND);
        // R-3: 본인 작성 댓글에는 공감/비공감 불가.
        Preconditions.validate(!comment.isOwnedBy(userId), CommentErrorCode.COMMENT_SELF_REACTION);

        Long commentId = comment.getId();
        // 잠금(FOR UPDATE) read 로 최신 커밋본을 읽는다 — 앞선 post 비잠금 read 로 고정된 스냅샷을 우회해, 패자가 승자의
        //   반응 행을 보고 전환/취소로 수렴하게 한다(M-1, UK 위반 500 차단). comment 행 X 락으로 이미 직렬화됨.
        Optional<CommentReaction> existing = commentReactionRepository.findByCommentIdAndUserIdForUpdate(commentId,
            userId);
        int likeDelta;
        int dislikeDelta;
        ReactionType resulting;
        if (existing.isEmpty()) {
            likeDelta = type == ReactionType.LIKE ? 1 : 0;
            dislikeDelta = type == ReactionType.DISLIKE ? 1 : 0;
            resulting = type;
        } else if (existing.get().getReactionType() == type) {
            likeDelta = type == ReactionType.LIKE ? -1 : 0; // 같은 종류 재요청 → 취소
            dislikeDelta = type == ReactionType.DISLIKE ? -1 : 0;
            resulting = null;
        } else {
            likeDelta = type == ReactionType.LIKE ? 1 : -1; // 다른 종류 → 전환(한쪽 −1·다른쪽 +1)
            dislikeDelta = type == ReactionType.DISLIKE ? 1 : -1;
            resulting = type;
        }

        applyCountDeltas(commentId, likeDelta, dislikeDelta);
        if (existing.isEmpty()) {
            commentReactionRepository.save(CommentReaction.builder()
                .commentId(commentId).userId(userId).reactionType(type).build());
        } else if (resulting == null) {
            commentReactionRepository.delete(existing.get()); // 취소(물리 DELETE)
        } else {
            existing.get().switchTo(type); // 전환(행 UPDATE, dirty checking)
        }
        return ReactionResponse.of(
            comment.getLikeCount() + likeDelta, comment.getDislikeCount() + dislikeDelta, resulting);
    }

    /** 카운트 델타(−1/0/+1)를 원자 UPDATE 로 반영한다(R-2). 전환은 like·dislike 두 컬럼을 각각 증감(별개 컬럼이라 순서 무관). */
    private void applyCountDeltas(Long commentId, int likeDelta, int dislikeDelta) {
        if (likeDelta > 0) {
            commentRepository.incrementLikeCount(commentId);
        } else if (likeDelta < 0) {
            commentRepository.decrementLikeCount(commentId);
        }
        if (dislikeDelta > 0) {
            commentRepository.incrementDislikeCount(commentId);
        } else if (dislikeDelta < 0) {
            commentRepository.decrementDislikeCount(commentId);
        }
    }

    /**
     * 뷰어의 댓글별 반응을 배치 조회한다(myReaction 채움, board-spec §13.2). 비인증({@code viewerId==null})·빈 목록이면 빈 맵
     * (optional-auth — 비인증은 항상 null). 인증이면 {@code comment_id IN (…) AND user_id=?} 한 번으로 N+1 을 피한다.
     */
    private Map<Long, ReactionType> viewerReactions(List<Comment> comments, Long viewerId) {
        if (viewerId == null || comments.isEmpty()) {
            return Map.of();
        }
        List<Long> commentIds = comments.stream().map(Comment::getId).toList();
        return commentReactionRepository.findByCommentIdInAndUserId(commentIds, viewerId).stream()
            .collect(Collectors.toMap(CommentReaction::getCommentId, CommentReaction::getReactionType));
    }

    /** 배치 조회 맵에서 이 댓글의 뷰어 반응을 문자열(LIKE|DISLIKE)로 뽑는다. 반응 없으면 null(tombstone 은 DTO 가 마스킹). */
    private String myReactionOf(Map<Long, ReactionType> myReactions, Comment comment) {
        ReactionType type = myReactions.get(comment.getId());
        return type == null ? null : type.name();
    }

    private Map<Long, User> authorsById(List<Comment> comments) {
        List<Long> authorIds = comments.stream().map(Comment::getAuthorId)
            .filter(java.util.Objects::nonNull).distinct().toList();
        return userRepository.findAllById(authorIds).stream()
            .collect(Collectors.toMap(User::getId, java.util.function.Function.identity()));
    }

    private Integer primaryCharacterId(User user) {
        return user == null || user.isDeleted() ? null : user.getPrimaryCharacterId();
    }

    /** 대상 댓글의 루트를 해석한다 — 루트면 자신, 답글이면 그 루트(1단계라 항상 존재). 답글 목록 앵커 정규화(§13.1). */
    private Comment resolveRoot(Comment target) {
        if (target.isRoot()) {
            return target;
        }
        return commentRepository.findById(target.getParentCommentId())
            .orElseThrow(() -> new BusinessException(CommentErrorCode.COMMENT_NOT_FOUND));
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
