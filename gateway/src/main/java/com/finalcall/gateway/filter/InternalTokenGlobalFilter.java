package com.finalcall.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import com.finalcall.gateway.config.GatewayInternalProperties;

import reactor.core.publisher.Mono;

/**
 * 직접접근 차단용 공유비밀 부착 필터(D-068).
 *
 * <p>모든 하류(서비스) 요청에 {@code X-Gateway-Token} 을 공유비밀 값으로 <b>set(덮어쓰기)</b> 한다.
 * add 가 아니라 set 이라야 클라이언트가 위조해 보낸 동일 헤더가 뒤단으로 새지 않는다(위조 헤더 선제거).
 * 서비스 측 {@code GatewayAccessFilter} 가 이 헤더로 게이트웨이 경유 여부를 판정한다.
 *
 * <p>순서는 최우선(HIGHEST_PRECEDENCE)으로 두어 라우팅 필터보다 먼저 헤더를 확정한다.
 */
@Component
public class InternalTokenGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayInternalProperties properties;

    public InternalTokenGlobalFilter(GatewayInternalProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerWebExchange mutated = exchange.mutate()
            .request(builder -> builder.headers(
                headers -> headers.set(properties.header(), properties.secret())))
            .build();
        return chain.filter(mutated);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
