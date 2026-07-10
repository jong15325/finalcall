package com.finalcall.api.sample;

import com.finalcall.domain.sample.SampleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 샘플 컨트롤러 — Stage 1 수직 슬라이스 검증용(controller → service 흐름 확인).
 *
 * <p>공통 응답 wrapper(ApiResponse)는 Stage 3 에서 도입하므로 여기서는 DTO 를 직접 반환한다.
 */
@RestController
@RequestMapping("/sample")
@RequiredArgsConstructor
public class SampleController {

    private final SampleService sampleService;

    @GetMapping
    public SampleResponse getSample() {
        return new SampleResponse(sampleService.getMessage());
    }
}
