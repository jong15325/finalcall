package com.finalcall.domain.board.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.board.dto.CommentCreateRequest;
import com.finalcall.domain.board.dto.CommentCreateResponse;
import com.finalcall.domain.board.dto.CommentPageResponse;
import com.finalcall.domain.board.dto.CommentReactionRequest;
import com.finalcall.domain.board.dto.CommentUpdateRequest;
import com.finalcall.domain.board.dto.ReactionResponse;
import com.finalcall.domain.board.dto.ReplyPageResponse;
import com.finalcall.domain.board.entity.CommentSort;
import com.finalcall.domain.board.service.CommentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 댓글 컨트롤러(EPIC-BOARD, FC-199 · EPIC-COMMENT-V2, FC-207, api §6.3) — {@code /api/v1/posts/{postPublicId}/comments}.
 * 목록·답글 목록 조회는 <b>공개</b>(SecurityConfig permitAll, GET 만), 작성·답글 작성·수정·삭제는 <b>인증 필요</b>
 * (주체=SecurityContext, IDOR 설계 차단). 댓글 경로는 게시글 {@code publicId}(전역 유일)에 직접 건다(§1.1 1단 중첩). 게시판
 * {@code allow_comments} 게이팅·소유검증·대댓글 루트 정규화는 서비스가 판정한다.
 *
 * <p>반환은 {@link ApiResponse}(상태 변경 무본문은 204+void 예외), 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 목록은 글당 소규모라 offset 페이지({@link CommentPageResponse}·{@link ReplyPageResponse}, api §6.3 예외 — 커서 아님)로 반환한다.
 * 루트 목록은 정렬 화이트리스트({@link CommentSort} — LATEST 기본·OLDEST·LIKES, 화이트리스트 외 400)를 받고, 답글 목록은
 * id asc 고정(param 없음)이다.
 */
@RestController
@RequestMapping("/api/v1/posts/{postPublicId}/comments")
@RequiredArgsConstructor
public class CommentController {

    /** 페이지 크기 상한(공개 엔드포인트라 무제한 size 는 증폭 표면). */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(api §6.3 offset 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final CommentService commentService;

    /**
     * 루트 댓글 목록(offset) — 공개. {@code sort}(LATEST 기본·OLDEST·LIKES, 화이트리스트 외 400)로 정렬. tombstone 포함
     * (마스킹). 글 없음/삭제 {@code POST_001}(404).
     */
    @GetMapping
    public ApiResponse<CommentPageResponse> list(
        @PathVariable String postPublicId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String sort) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), normalizeSize(size), CommentSort.from(sort).toSort());
        return ApiResponse.success(commentService.getComments(postPublicId, pageable));
    }

    /** 답글 목록(offset) — 공개. id asc(시간순 고정, param 없음). 대상 없음/완전삭제 {@code COMMENT_001}·글 없음 {@code POST_001}. */
    @GetMapping("/{commentPublicId}/replies")
    public ApiResponse<ReplyPageResponse> listReplies(
        @PathVariable String postPublicId, @PathVariable String commentPublicId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), normalizeSize(size));
        return ApiResponse.success(commentService.getReplies(postPublicId, commentPublicId, pageable));
    }

    /** 댓글 작성 — 인증 + 게시판 allow_comments. 성공 201 {@code { commentPublicId, createdAt }}. 비허용 {@code BOARD_003}(422). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CommentCreateResponse> create(
        @PathVariable String postPublicId, @Valid @RequestBody CommentCreateRequest request) {
        return ApiResponse.success(commentService.create(postPublicId, request));
    }

    /**
     * 답글 작성 — 인증 + 게시판 allow_comments + 대상 댓글 존재(미삭제). 서버가 루트로 정규화하고 @멘션 닉을 파생한다(§13.1).
     * 성공 201 {@code { commentPublicId, createdAt }}. 대상 없음/삭제 {@code COMMENT_001}·비허용 {@code BOARD_003}(422).
     */
    @PostMapping("/{commentPublicId}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CommentCreateResponse> createReply(
        @PathVariable String postPublicId, @PathVariable String commentPublicId,
        @Valid @RequestBody CommentCreateRequest request) {
        return ApiResponse.success(commentService.createReply(postPublicId, commentPublicId, request));
    }

    /** 댓글 수정 — 인증 + (작성자 OR ROLE_ADMIN). 성공 204(무본문). 없음 {@code COMMENT_001}·작성자 아님 {@code COMMENT_002}. */
    @PutMapping("/{commentPublicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(
        @PathVariable String postPublicId, @PathVariable String commentPublicId,
        @Valid @RequestBody CommentUpdateRequest request) {
        commentService.update(postPublicId, commentPublicId, request);
    }

    /** 댓글 삭제(soft) — 인증 + (작성자 OR ROLE_ADMIN). 성공 204(무본문). */
    @DeleteMapping("/{commentPublicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String postPublicId, @PathVariable String commentPublicId) {
        commentService.delete(postPublicId, commentPublicId);
    }

    /**
     * 공감/비공감 토글(FC-208, api §6.3) — 인증 필요. 단일 토글이 등록·전환·취소를 흡수하고, 반영 후 최종 상태
     * {@code { likeCount, dislikeCount, myReaction }} 를 권위 응답으로 돌려준다. 대상 없음/삭제 {@code COMMENT_001}(404)·
     * 자기 댓글 반응 {@code COMMENT_003}(422). 타입 화이트리스트(LIKE|DISLIKE) 외 400.
     */
    @PutMapping("/{commentPublicId}/reaction")
    public ApiResponse<ReactionResponse> react(
        @PathVariable String postPublicId, @PathVariable String commentPublicId,
        @Valid @RequestBody CommentReactionRequest request) {
        return ApiResponse.success(commentService.toggleReaction(postPublicId, commentPublicId, request));
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다(offset 컨트롤러 공통 보정). */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
