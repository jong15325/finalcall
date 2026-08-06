package com.finalcall.domain.board.controller;

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
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.board.dto.PostCreateRequest;
import com.finalcall.domain.board.dto.PostCreateResponse;
import com.finalcall.domain.board.dto.PostDetailResponse;
import com.finalcall.domain.board.dto.PostSummary;
import com.finalcall.domain.board.dto.PostUpdateRequest;
import com.finalcall.domain.board.service.PostService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 게시글 컨트롤러(EPIC-BOARD, FC-198, api §6.2) — {@code /api/v1/boards/{slug}/posts}. 목록·상세 조회는 <b>공개</b>
 * (SecurityConfig permitAll), 작성·수정·삭제는 <b>인증 필요</b>(주체=SecurityContext, IDOR 설계 차단). 쓰기정책·소유검증은
 * 서비스 계층이 판정한다(게시판별 정책이 DB 값이라 URL 패턴으로 표현 불가, §6.5).
 *
 * <p>반환은 항상 {@link ApiResponse}(상태 변경 무본문은 204+void 예외), 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 커서 목록은 공용 {@link CursorResponse} 봉투(opaque String 커서)로 반환한다.
 */
@RestController
@RequestMapping("/api/v1/boards/{slug}/posts")
@RequiredArgsConstructor
public class PostController {

    /** 페이지 크기 상한(커서 컨트롤러 공통 관례). */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 cursor 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final PostService postService;

    /** 글 목록(커서) — 공개. 정렬 is_pinned DESC·id DESC. 비활성·미존재 게시판은 {@code BOARD_001}(404). */
    @GetMapping
    public ApiResponse<CursorResponse<PostSummary, String>> getPosts(
        @PathVariable String slug,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(postService.getPosts(slug, cursor, normalizeSize(size)));
    }

    /** 글 작성 — 인증 + write_policy. 성공 201 {@code { postPublicId }}. 정책 위반 {@code BOARD_002}(403). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PostCreateResponse> create(
        @PathVariable String slug, @Valid @RequestBody PostCreateRequest request) {
        return ApiResponse.success(postService.create(slug, request));
    }

    /** 글 상세 — 공개(조회수 원자 증가). 없음/삭제 {@code POST_001}(404). */
    @GetMapping("/{postPublicId}")
    public ApiResponse<PostDetailResponse> get(@PathVariable String slug, @PathVariable String postPublicId) {
        return ApiResponse.success(postService.getPost(slug, postPublicId));
    }

    /** 글 수정 — 인증 + (작성자 OR ROLE_ADMIN). 성공 204(무본문). 없음 {@code POST_001}·작성자 아님 {@code POST_002}. */
    @PutMapping("/{postPublicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(
        @PathVariable String slug, @PathVariable String postPublicId,
        @Valid @RequestBody PostUpdateRequest request) {
        postService.update(slug, postPublicId, request);
    }

    /** 글 삭제(soft) — 인증 + (작성자 OR ROLE_ADMIN). 성공 204(무본문). */
    @DeleteMapping("/{postPublicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String slug, @PathVariable String postPublicId) {
        postService.delete(slug, postPublicId);
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다(커서 컨트롤러 공통 보정). */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
