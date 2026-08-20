package com.finalcall.gateway.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import com.finalcall.gateway.config.GatewayClientIpProperties;

class TrustedProxyClientIpKeyResolverTest {

    @Test
    void 신뢰_proxy가_없으면_위조_Forwarded와_XFF를_무시한다() {
        TrustedProxyClientIpKeyResolver resolver = resolver(0);
        MockServerWebExchange exchange = exchange("203.0.113.10",
            "for=198.51.100.20", "198.51.100.20");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("203.0.113.10");
    }

    @Test
    void 신뢰_proxy_수만큼_우측에서_고정해_왼쪽_위조값을_배제한다() {
        TrustedProxyClientIpKeyResolver resolver = resolver(2);
        MockServerWebExchange exchange = exchange("10.0.0.2",
            "for=192.0.2.250, for=198.51.100.20, for=10.0.0.1",
            "192.0.2.250, 198.51.100.20, 10.0.0.1");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("198.51.100.20");
    }

    @Test
    void Forwarded와_XFF의_선택_IP가_다르면_실제_peer로_fallback한다() {
        TrustedProxyClientIpKeyResolver resolver = resolver(1);
        MockServerWebExchange exchange = exchange("10.0.0.1",
            "for=198.51.100.20", "198.51.100.21");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("10.0.0.1");
    }

    @Test
    void 신뢰_hop보다_헤더_chain이_짧으면_실제_peer로_fallback한다() {
        TrustedProxyClientIpKeyResolver resolver = resolver(2);
        MockServerWebExchange exchange = exchange("10.0.0.2",
            "for=198.51.100.20", "198.51.100.20");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("10.0.0.2");
    }

    private TrustedProxyClientIpKeyResolver resolver(int trustedProxyCount) {
        return new TrustedProxyClientIpKeyResolver(new GatewayClientIpProperties(trustedProxyCount));
    }

    private MockServerWebExchange exchange(String remoteAddress, String forwarded, String xForwardedFor) {
        MockServerHttpRequest request = MockServerHttpRequest.get("/")
            .remoteAddress(new InetSocketAddress(remoteAddress, 443))
            .header("Forwarded", forwarded)
            .header("X-Forwarded-For", xForwardedFor)
            .build();
        return MockServerWebExchange.from(request);
    }
}
