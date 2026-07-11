package com.finalcall.api.sample;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.sample.SampleCacheValue;
import com.finalcall.domain.sample.ResilienceDemoService;
import com.finalcall.domain.sample.SampleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    private final ResilienceDemoService resilienceDemoService;

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

    /** 커스텀 메트릭 데모(Stage 5): 호출 시 Counter/Timer 를 기록한다(/actuator/prometheus 에서 확인). */
    @GetMapping("/metric-demo")
    public ApiResponse<SampleResponse> metricDemo() {
        return ApiResponse.success(new SampleResponse(sampleService.processWithMetrics()));
    }

    /** 캐시 데모(Stage E1): 두 번째 호출은 캐시에서 반환(generatedAt 고정). */
    @GetMapping("/cache/{id}")
    public ApiResponse<SampleCacheValue> getCached(@PathVariable Long id) {
        return ApiResponse.success(sampleService.getCached(id));
    }

    /** 캐시 무효화 데모(Stage E1). */
    @DeleteMapping("/cache/{id}")
    public ApiResponse<Void> evictCached(@PathVariable Long id) {
        sampleService.evictCached(id);
        return ApiResponse.success();
    }

    /** 분산락 데모(Stage E1): 동시 호출 시 상호배제(임계 구역 300ms). */
    @GetMapping("/lock/{id}")
    public ApiResponse<Long> lockDemo(@PathVariable Long id) {
        return ApiResponse.success(sampleService.lockedProcess(id));
    }

    /** 회복탄력성 데모(Stage E2): fail=true 반복 호출 시 연속 실패로 회로 OPEN → fallback 응답. */
    @GetMapping("/resilience")
    public ApiResponse<String> resilienceDemo(@RequestParam(defaultValue = "true") boolean fail) {
        return ApiResponse.success(resilienceDemoService.callExternal(fail));
    }
}
