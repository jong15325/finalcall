package com.finalcall.domain.auth.config;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * 소셜 로그인(OAuth) provider 호출용 공유 {@link RestClient} 배선(auth, EPIC-OAUTH FC-154).
 *
 * <p><b>커넥션 재사용·타임아웃 필수(FC-151 커넥션 누수 교훈):</b> provider 토큰·userinfo 호출은 매 요청마다 클라이언트를
 * 새로 만들지 않고(소켓 누수·핸드셰이크 비용 폭증), 이 <b>단일 빈</b>을 공유한다. 백엔드는 JDK {@link HttpClient} 를
 * 하나만 만들어 request factory 에 주입한다 — JDK HttpClient 는 내부적으로 keep-alive 커넥션 풀을 유지해 provider
 * 별 커넥션을 재사용한다({@code new} 금지).
 *
 * <p>타임아웃: connect 는 {@link HttpClient.Builder#connectTimeout}(핸드셰이크 상한), read 는 request factory 의
 * read timeout(응답 대기 상한). provider 지연·행이 우리 스레드를 무한정 붙들지 못하게 짧게 잡는다(장애 격리). 초과·IO
 * 오류는 {@code AUTH_008}(502)로 매핑된다(OAuthProviderStrategy).
 */
@Configuration
public class OAuthClientConfig {

    /** provider TLS 핸드셰이크(커넥션 수립) 상한. */
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    /** provider 응답 대기 상한(요청 전송 후 응답까지). */
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

    /**
     * OAuth provider 호출 전용 공유 {@link RestClient}. 커넥션 풀(JDK HttpClient 내부)·connect/read 타임아웃을
     * 갖춘 단일 인스턴스다. provider 전략({@code Naver/KakaoOAuthStrategy})이 이 빈을 주입받아 재사용한다.
     */
    @Bean
    public RestClient oauthRestClient() {
        HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        return RestClient.builder()
            .requestFactory(requestFactory)
            .build();
    }
}
