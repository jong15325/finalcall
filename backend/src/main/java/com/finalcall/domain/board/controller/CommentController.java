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
import com.finalcall.domain.board.dto.CommentUpdateRequest;
import com.finalcall.domain.board.service.CommentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 댓글 컨트롤러(EPIC-BOARD, FC-199, api §6.3) — {@code /api/v1/posts/{postPublicId}/comments}. 목록 조회는 <b>공개</b>
 * (SecurityConfig permitAll), 작성·수정·삭제는 <b>인증 필요</b>(주체=SecurityContext, IDOR 설계 차단). 댓글 경로는
 * 게시글 {@code publicId}(전역 유일)에 직접 건다(§1.1 1단 중첩). 게시판 {@code allow_comments} 게이팅·소유검증은 서비스가 판정한다.
 *
 * <p>반환은 {@link ApiResponse}(상태 변경 무본문은 204+void 예외), 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 목록은 글당 소규모라 offset 페이지({@link CommentPageResponse}, api §6.3 예외 — 커서 아님)로 반환한다.
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

    /** 댓글 목록(offset) — 공개. id asc(작성순). 글 없음/삭제 {@code POST_001}(404). */
    @GetMapping
    public ApiResponse<CommentPageResponse> list(
        @PathVariable String postPublicId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), normalizeSize(size));
        return ApiResponse.success(commentService.getComments(postPublicId, pageable));
    }

    /** 댓글 작성 — 인증 + 게시판 allow_comments. 성공 201 {@code { commentPublicId, createdAt }}. 비허용 {@code BOARD_003}(422). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CommentCreateResponse> create(
        @PathVariable String postPublicId, @Valid @RequestBody CommentCreateRequest request) {
        return ApiResponse.success(commentService.create(postPublicId, request));
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

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다(offset 컨트롤러 공통 보정). */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
