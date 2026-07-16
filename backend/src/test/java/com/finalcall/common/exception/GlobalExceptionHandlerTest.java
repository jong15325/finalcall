package com.finalcall.common.exception;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * GlobalExceptionHandler(Stage 3) 검증.
 *
 * <p>전용 테스트 컨트롤러 + advice 를 standaloneSetup 으로 직접 결선해 각 예외 경로를
 * 컨텍스트 로딩 없이 결정적으로 확인한다(표준 에러 포맷, 내부정보 비노출).
 */
class GlobalExceptionHandlerTest {

    private final MockMvc mvc = MockMvcBuilders
        .standaloneSetup(new TestController())
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();

    @Test
    void 비즈니스예외는_ErrorCode_기반_표준포맷으로_응답한다() throws Exception {
        mvc.perform(get("/test/business"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_003"))
            .andExpect(jsonPath("$.message").value("요청한 리소스를 찾을 수 없습니다."))
            .andExpect(jsonPath("$.timestamp").exists())
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void 검증실패는_INVALID_INPUT과_errors배열을_담는다() throws Exception {
        mvc.perform(post("/test/valid")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_001"))
            .andExpect(jsonPath("$.errors[0].field").value("name"))
            .andExpect(jsonPath("$.errors[0].reason").value("name 은 필수입니다."));
    }

    @Test
    void 미처리예외는_500표준에러이며_내부정보를_노출하지_않는다() throws Exception {
        mvc.perform(get("/test/boom"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_999"))
            .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."))
            .andExpect(jsonPath("$.message", not(containsString("민감한 내부 원인"))));
    }

    // --- 테스트 전용 컨트롤러/요청(standalone 으로 수동 등록, 컴포넌트 스캔 대상 아님) ---

    @RestController
    static class TestController {

        @GetMapping("/test/business")
        void business() {
            throw new BusinessException(CommonErrorCode.NOT_FOUND);
        }

        @GetMapping("/test/boom")
        void boom() {
            throw new IllegalStateException("민감한 내부 원인 - 응답에 노출되면 안 됨");
        }

        @PostMapping("/test/valid")
        String valid(@Valid @RequestBody TestRequest request) {
            return request.name();
        }
    }

    record TestRequest(@NotBlank(message = "name 은 필수입니다.") String name) {
    }
}
