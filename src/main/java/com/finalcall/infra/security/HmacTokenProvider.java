package com.finalcall.infra.security;

import com.finalcall.common.security.TokenProvider;
import com.finalcall.infra.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * HS256(대칭키) 기반 {@link TokenProvider} 구현(Stage F1).
 *
 * <p>secret 은 {@link JwtProperties} 로 fail-fast 주입한다(하드코딩 금지).
 * ★ HS256 은 최소 256비트(32바이트) secret 이 필요하다(미만이면 시작 시 WeakKeyException).
 * ★ 확장: RS256(공개키) 전환 시 이 클래스 대신 RsaTokenProvider 를 구현해 갈아끼운다.
 */
@Component
public class HmacTokenProvider implements TokenProvider {

    private final SecretKey key;
    private final long accessExpMinutes;

    public HmacTokenProvider(JwtProperties jwtProperties) {
        // 256비트 미만이면 여기서 예외 → fail-fast(약한 키 방지).
        this.key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        this.accessExpMinutes = jwtProperties.accessExpMinutes();
    }

    @Override
    public String generateToken(String subject) {
        Instant now = Instant.now();
        Instant expiry = now.plus(accessExpMinutes, ChronoUnit.MINUTES);
        return Jwts.builder()
                .subject(subject)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                // ★ HS256 명시(JWT_ALGORITHM=HS256). signWith(key) 만 쓰면 키 길이에 따라 HS384/512 로 자동 상향된다.
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    @Override
    public String validateAndGetSubject(String token) {
        // 서명/만료 검증 실패 시 JwtException 계열 예외를 던진다(필터에서 컨텍스트 비우고 EntryPoint 가 401).
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }
}
