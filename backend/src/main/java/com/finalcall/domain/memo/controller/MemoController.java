package com.finalcall.domain.memo.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.memo.dto.MemoResponse;
import com.finalcall.domain.memo.dto.MemoSendRequest;
import com.finalcall.domain.memo.dto.MemoSendResponse;
import com.finalcall.domain.memo.dto.MemoSummaryResponse;
import com.finalcall.domain.memo.dto.MemoUnreadCountResponse;
import com.finalcall.domain.memo.service.MemoService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 메모(쪽지) 컨트롤러(memo, EPIC-MEMO) — 계약 §2.6 {@code /api/v1/me/memos}. 전 엔드포인트 인증 필요(주체=SecurityContext,
 * SecurityConfig {@code anyRequest().authenticated()} — IDOR 설계 차단). 발신자·type 은 경로·바디가 아니라 주체·서버 고정.
 *
 * <p>반환은 항상 {@link ApiResponse}(상태 변경 무본문은 204+void 예외), 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 커서 목록은 공용 {@link CursorResponse} 봉투로 반환한다. 리터럴 경로(received·sent·unread-count)가 {@code /{memoPublicId}}
 * 보다 먼저 매칭되므로 경로 충돌은 없다.
 */
@RestController
@RequestMapping("/api/v1/me/memos")
@RequiredArgsConstructor
public class MemoController {

    /** 페이지 크기 상한(order·bid·shop 커서 컨트롤러 공통 관례). */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 cursor 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final MemoService memoService;

    /** 발신 — 인증 필요. 성공 201 {@code { memoPublicId, createdAt }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MemoSendResponse> send(@Valid @RequestBody MemoSendRequest request) {
        return ApiResponse.success(memoService.send(request.receiverNickname(), request.body()));
    }

    /** 받은함(커서) — 인증 필요. */
    @GetMapping("/received")
    public ApiResponse<CursorResponse<MemoSummaryResponse, String>> received(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(memoService.getReceived(cursor, normalizeSize(size)));
    }

    /** 보낸함(커서) — 인증 필요. */
    @GetMapping("/sent")
    public ApiResponse<CursorResponse<MemoSummaryResponse, String>> sent(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(memoService.getSent(cursor, normalizeSize(size)));
    }

    /** 미열람 개수 — 인증 필요. 성공 200 {@code { count }}. */
    @GetMapping("/unread-count")
    public ApiResponse<MemoUnreadCountResponse> unreadCount() {
        return ApiResponse.success(new MemoUnreadCountResponse(memoService.getUnreadCount()));
    }

    /** 상세 열람(+수신자면 읽음 전이) — 인증 필요. 없음 404(MEMO_002), 당사자 아님 403(MEMO_003). */
    @GetMapping("/{memoPublicId}")
    public ApiResponse<MemoResponse> detail(@PathVariable String memoPublicId) {
        return ApiResponse.success(memoService.getDetail(memoPublicId));
    }

    /** 삭제(soft) — 인증 필요. 성공 204(무본문). 없음 404(MEMO_002), 당사자 아님 403(MEMO_003). */
    @DeleteMapping("/{memoPublicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String memoPublicId) {
        memoService.delete(memoPublicId);
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다(order·bid·shop 커서 컨트롤러 공통 보정). */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
