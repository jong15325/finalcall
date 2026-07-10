package com.finalcall.api.sample;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.sample.SampleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 샘플 컨트롤러 — Stage 3 공통 응답/예외 포맷 시연.
 *
 * <p>반환 타입은 항상 {@link ApiResponse}(성공). 에러는 GlobalExceptionHandler 가 ErrorResponse 로 처리한다.
 * 컨트롤러에서 try-catch 하지 않는다.
 */
@RestController
@RequestMapping("/sample")
@RequiredArgsConstructor
public class SampleController {

    private final SampleService sampleService;

    /** 성공 응답 데모: {success, data, timestamp}. */
    @GetMapping
    public ApiResponse<SampleResponse> getSample() {
        return ApiResponse.success(new SampleResponse(sampleService.getMessage()));
    }

    /** BusinessException(Preconditions) 데모: 표준 에러 포맷 {success=false, code, message, timestamp}. */
    @GetMapping("/error")
    public ApiResponse<Void> getError() {
        sampleService.ensureExists(false); // NOT_FOUND 로 BusinessException 발생
        return ApiResponse.success();      // 도달하지 않음
    }

    /** @Valid 검증 데모: message 가 비면 INVALID_INPUT + errors 배열. */
    @PostMapping("/echo")
    public ApiResponse<SampleResponse> echo(@Valid @RequestBody SampleEchoRequest request) {
        return ApiResponse.success(new SampleResponse(request.message()));
    }
}
