package com.finalcall.gateway.filter;

import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.gateway.config.HomeRecommendationRateLimitProperties;
import com.finalcall.gateway.response.GatewayErrorResponse;

import reactor.core.publisher.Mono;

/**
 * rate limit 초과(429) 응답에 계약 [1.6] envelope 본문·{@code Retry-After} 를 주입하는 전역 필터(D-068).
 *
 * <p><b>배경</b>: SCG {@code RequestRateLimiter} 는 rate limit 초과 시 예외를 던지지 않고 상태 429 를
 * 세팅한 뒤 {@code response.setComplete()} 로 <b>본문 없이</b> 응답을 마감한다. 따라서
 * {@code ErrorWebExceptionHandler} 로는 잡히지 않는다. 응답을 데코레이트해 {@code setComplete()} 시점을
 * 가로채는 것이 정석이다.
 *
 * <p><b>동작</b>: {@link ServerHttpResponseDecorator} 로 응답을 감싸 하류로 넘긴다. rate limiter 가
 * 429 를 세팅하고 {@code setComplete()} 를 호출하면, 데코레이터가 이를 가로채 envelope 본문과
 * {@code Retry-After} 헤더를 주입한 뒤 마감한다. 429 가 아니거나 이미 커밋된 응답은 원래 동작을 그대로 위임한다.
 *
 * <p><b>순서</b>: {@link Ordered#HIGHEST_PRECEDENCE}(최외곽)로 두어 라우트 필터인 rate limiter 보다
 * 먼저 실행되어 데코레이터를 설치한다. rate limiter 가 데코레이트된 응답에 setComplete 를 호출해야 가로채진다.
 *
 * <p><b>범위</b>: 포맷 정합만 담당한다. rate limit 정책(replenishRate·burst·키 전략)·라우팅은 변경하지 않는다.
 */
@Component
public class RateLimitResponseGlobalFilter implements GlobalFilter, Ordered {

    /** 계약 [1.6]·[5]의 엣지 코드. */
    private static final String GATEWAY_429_CODE = "GATEWAY_429";
    private static final String GATEWAY_429_MESSAGE = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";

    /**
     * {@code Retry-After}(초). 라우트 설정 {@code replenishRate=5}(초당 5토큰) 기준, 다음 토큰까지
     * {@code ceil(1/5)=1} 초다(HTTP {@code Retry-After} 는 정수 초 최소 단위). 정책값은 변경하지 않고
     * 헤더만 부착한다 — replenishRate 를 1/s 미만으로 낮추면 이 값 재검토가 필요하다(완료 보고 이슈 참조).
     */
    private static final String RETRY_AFTER_SECONDS = "1";

    private final ObjectMapper objectMapper;
    private final HomeRecommendationRateLimitProperties homeRateLimitProperties;

    public RateLimitResponseGlobalFilter(
        ObjectMapper objectMapper,
        HomeRecommendationRateLimitProperties homeRateLimitProperties) {
        this.objectMapper = objectMapper;
        this.homeRateLimitProperties = homeRateLimitProperties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpResponseDecorator decorated = new ServerHttpResponseDecorator(exchange.getResponse()) {
            @Override
            public Mono<Void> setComplete() {
                if (!HttpStatus.TOO_MANY_REQUESTS.equals(getStatusCode()) || isCommitted()) {
                    return super.setComplete();
                }
                byte[] body;
                try {
                    body = objectMapper.writeValueAsBytes(
                        GatewayErrorResponse.of(GATEWAY_429_CODE, GATEWAY_429_MESSAGE));
                } catch (JsonProcessingException ex) {
                    // 직렬화 실패(사실상 발생 불가)면 본문 없이 상태만 마감(기존 동작 폴백).
                    return super.setComplete();
                }
                getHeaders().setContentType(MediaType.APPLICATION_JSON);
                getHeaders().set(HttpHeaders.RETRY_AFTER, retryAfterSeconds(exchange));
                DataBuffer buffer = bufferFactory().wrap(body);
                return super.writeWith(Mono.just(buffer));
            }
        };
        return chain.filter(exchange.mutate().response(decorated).build());
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    private String retryAfterSeconds(ServerWebExchange exchange) {
        Route route = exchange.getAttribute(GATEWAY_ROUTE_ATTR);
        if (route == null || !"home-shop-recommendations-rate-limited".equals(route.getId())) {
            return RETRY_AFTER_SECONDS;
        }
        return String.valueOf(homeRateLimitProperties.retryAfterSeconds());
    }
}
