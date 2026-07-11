package com.finalcall.api.notice;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.notice.NoticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공지 컨트롤러(Stage D) — 컨트롤러 컨벤션 참조 구현.
 *
 * <p>반환 타입은 항상 {@link ApiResponse}, 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 엔티티→응답 DTO 변환은 api 계층에서 수행한다(domain 은 api 를 모른다).
 */
@RestController
@RequestMapping("/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;

    /** 생성 → 생성된 id 반환. */
    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody NoticeCreateRequest request) {
        return ApiResponse.success(noticeService.create(request.title(), request.content(), request.type()));
    }

    /** 단건(삭제 글은 NOT_FOUND). */
    @GetMapping("/{id}")
    public ApiResponse<NoticeDetailResponse> get(@PathVariable Long id) {
        return ApiResponse.success(NoticeDetailResponse.from(noticeService.getActive(id)));
    }

    /** 수정(도메인 메서드 update). */
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @Valid @RequestBody NoticeUpdateRequest request) {
        noticeService.update(id, request.title(), request.content(), request.type());
        return ApiResponse.success();
    }

    /** 삭제(soft delete). */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        noticeService.delete(id);
        return ApiResponse.success();
    }

    /** 오프셋 목록(Spring Pageable → Page). 보편적 방식. */
    @GetMapping
    public ApiResponse<Page<NoticeListResponse>> getPage(Pageable pageable) {
        return ApiResponse.success(noticeService.getPage(pageable).map(NoticeListResponse::from));
    }

    /** 커서 목록(무한 스크롤/대규모 트래픽용). */
    @GetMapping("/cursor")
    public ApiResponse<NoticeCursorResponse> getByCursor(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.success(NoticeCursorResponse.from(noticeService.getByCursor(cursor, size)));
    }
}
