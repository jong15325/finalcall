package com.finalcall.api.currency;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.currency.ExchangeService;
import com.finalcall.domain.currency.MoneyExchange;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 화폐 교환(currency) 컨트롤러 — 계약 §4.4 POST /api/v1/exchanges. 인증 필요(주체=SecurityContext userId).
 *
 * <p>반환 타입은 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러). 엔티티→응답 DTO 변환은 api 계층에서 수행한다.
 * {@code Idempotency-Key} 헤더는 필수다(SEC-004) — {@code required=true} 라 누락 시 400(전역 핸들러가 매핑).
 */
@RestController
@RequestMapping("/api/v1/exchanges")
@RequiredArgsConstructor
public class ExchangeController {

    private final ExchangeService exchangeService;

    /** 캐시→게임머니 교환 — 인증 필요. 성공 시 201, {@code gameMoneyAmount·appliedRate}(계약 §4.4). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ExchangeResponse> exchange(
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @Valid @RequestBody ExchangeRequest request) {
        MoneyExchange result = exchangeService.exchange(request.direction(), request.cashAmount(), idempotencyKey);
        return ApiResponse.success(ExchangeResponse.from(result));
    }
}
