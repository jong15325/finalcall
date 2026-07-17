package com.finalcall.infra.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import com.finalcall.infra.config.JwtProperties;

/**
 * refresh 토큰 저장소(auth, B-011) — Redis(Lettuce, {@link StringRedisTemplate}) 기반.
 *
 * <p>정책(SEC-006):
 * <ul>
 *   <li>refresh 토큰은 opaque 난수(≥256bit). 원문은 클라이언트만 보유하고, 서버는 SHA-256 <b>해시</b>만 저장한다.</li>
 *   <li>키 {@code auth:refresh:{userId}:{sessionId}} = 현재 유효 토큰의 해시, TTL = refresh 만료.</li>
 *   <li><b>회전</b>: 재발급 시 같은 세션에 신규 토큰 해시를 덮어써 이전 토큰을 폐기(1회성).</li>
 *   <li><b>재사용 탐지</b>: 제시 토큰 해시가 저장분과 불일치하면(=회전으로 폐기된 옛 토큰) 해당 세션을 무효화(키 삭제).</li>
 *   <li><b>폐기</b>: logout 시 세션 키 삭제.</li>
 * </ul>
 *
 * <p>레이어 규율상 infra 는 domain 을 의존할 수 없어, 여기서는 도메인 예외(AuthErrorCode)를 던지지 않고
 * {@link Optional} 로 유효/무효를 반환한다. 401(AUTH_004) 매핑은 호출 측 도메인 서비스(후속 단위)가 담당한다.
 */
@Component
public class RefreshTokenStore {

    private static final String KEY_PREFIX = "auth:refresh:";
    private static final String DELIMITER = ".";
    private static final int SESSION_ID_BYTES = 16; // 128bit — 세션 식별(라우팅)
    private static final int SECRET_BYTES = 32; // 256bit — 실제 비밀값(B-011)
    private static final int SCAN_COUNT = 100; // SCAN 커서 배치 힌트(블로킹 회피)

    /**
     * 회전을 원자적으로 처리하는 Lua CAS(경쟁 시 단일 승자).
     * 저장분==제시분이면 신규 해시로 교체(회전)하고 'OK', 불일치면 세션 삭제(재사용 탐지)하고 'REUSE', 없으면 'MISSING'.
     * GET·비교·SET/DEL 이 단일 EVAL 로 원자 실행돼 동시 회전 시 두 번째는 REUSE 로 세션이 무효화된다.
     */
    private static final RedisScript<String> ROTATE_SCRIPT = new DefaultRedisScript<>("""
        local cur = redis.call('GET', KEYS[1])
        if not cur then return 'MISSING' end
        if cur == ARGV[1] then
          redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
          return 'OK'
        else
          redis.call('DEL', KEYS[1])
          return 'REUSE'
        end
        """, String.class);

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom random = new SecureRandom();
    private final Base64.Encoder base64Url = Base64.getUrlEncoder().withoutPadding();
    private final Duration refreshTtl;

    public RefreshTokenStore(StringRedisTemplate redisTemplate, JwtProperties jwtProperties) {
        this.redisTemplate = redisTemplate;
        this.refreshTtl = Duration.ofDays(jwtProperties.refreshExpDays());
    }

    /**
     * 새 세션의 refresh 토큰을 발급하고 해시를 저장한다(TTL = refresh 만료).
     *
     * @param userId 내부 사용자 식별자(access 토큰 subject 와 동일)
     * @return 클라이언트에 전달할 원문 refresh 토큰
     */
    public String issue(String userId) {
        String sessionId = randomToken(SESSION_ID_BYTES);
        return store(userId, sessionId);
    }

    /**
     * 제시된 refresh 토큰의 유효성을 검증한다(해시 대조).
     *
     * <p><b>용도: 테스트 지원</b>(프로덕션 재발급 경로는 {@link #rotate}가 원자적 검증+회전으로 대체한다). 통합 테스트가
     * 발급/폐기 후 저장 상태를 확인하는 데 쓴다 — 제거하지 말 것(n1).
     *
     * @return 유효하면 userId, 무효/재사용이면 empty(재사용 탐지 시 해당 세션 무효화)
     */
    public Optional<String> validate(String presentedToken) {
        Parsed parsed = parse(presentedToken);
        if (parsed == null) {
            return Optional.empty();
        }
        String stored = redisTemplate.opsForValue().get(parsed.key());
        if (stored == null) {
            return Optional.empty(); // 없음/만료/폐기 — 무효화할 세션도 없음
        }
        if (!constantTimeEquals(stored, sha256(presentedToken))) {
            // 저장분과 불일치 = 회전으로 폐기된 옛 토큰 재사용 → 세션 무효화(B-011).
            redisTemplate.delete(parsed.key());
            return Optional.empty();
        }
        return Optional.of(parsed.userId());
    }

    /**
     * refresh 토큰을 <b>원자적으로</b> 회전한다: 검증 통과 시 같은 세션에 신규 토큰을 저장(이전 토큰 폐기)하고 반환한다.
     * 재발급 호출자는 새 access 토큰 발급을 위해 userId 가 필요하므로 {@link Rotation}(신규 토큰 + userId)으로 반환한다.
     *
     * @return 성공 시 {@link Rotation}, 무효/재사용/만료면 empty(재사용 탐지 시 해당 세션 무효화)
     */
    public Optional<Rotation> rotate(String presentedToken) {
        Parsed parsed = parse(presentedToken);
        if (parsed == null) {
            return Optional.empty();
        }
        String newToken = parsed.userId() + DELIMITER + parsed.sessionId() + DELIMITER + randomToken(SECRET_BYTES);
        String result = redisTemplate.execute(ROTATE_SCRIPT, List.of(parsed.key()),
            sha256(presentedToken), sha256(newToken), String.valueOf(refreshTtl.toSeconds()));
        if ("OK".equals(result)) {
            return Optional.of(new Rotation(newToken, parsed.userId()));
        }
        return Optional.empty(); // MISSING(없음/만료) 또는 REUSE(스크립트가 이미 세션 삭제)
    }

    /**
     * 세션을 폐기한다(logout). <b>소유자 검증</b>: 토큰의 userId 가 {@code ownerUserId}(SecurityContext 주체)와
     * 일치할 때만 삭제한다 — 타 사용자 세션 조작 방지. 삭제 키는 항상 토큰의 userId 네임스페이스라, 일치를 강제하면
     * 인증 사용자 자신의 세션만 폐기된다. 형식 위반·불일치는 무해한 no-op(멱등 로그아웃).
     */
    public void revoke(String presentedToken, String ownerUserId) {
        Parsed parsed = parse(presentedToken);
        if (parsed != null && parsed.userId().equals(ownerUserId)) {
            redisTemplate.delete(parsed.key());
        }
    }

    /**
     * 사용자의 <b>모든</b> refresh 세션을 일괄 폐기한다(탈퇴, SEC-006 — 잔여 세션 접근 차단).
     *
     * <p>세션당 키가 {@code auth:refresh:{userId}:{sessionId}} 스킴이므로 {@code userId} 네임스페이스를
     * SCAN(논블로킹 커서)으로 훑어 일괄 삭제한다. {@code :} 구분자가 경계라 {@code 10} 이 {@code 100} 을
     * 오탐하지 않는다. 사용자별 인덱스를 두지 않아 키 스킴을 바꾸지 않는다.
     *
     * <p><b>멱등</b>: 세션이 없어도 no-op(오류 없음). <b>원자성</b>: 수집된 키 삭제는 단일 {@code DEL}(원자)
     * 이며 개별 세션 폐기는 {@link #revoke}/재사용 탐지와 충돌하지 않는다(이미 회전·삭제된 키는 그냥 건너뜀).
     * SCAN 은 스냅숏이 아니므로 폐기 도중 <b>새로 발급</b>된 세션은 놓칠 수 있다 — 호출 측에서 회원을 먼저
     * 탈퇴 처리(신규 발급 차단)한 뒤 부르는 것을 전제한다.
     *
     * <p><b>인가</b>: 제시 토큰이 없어 {@link #revoke} 식 소유자 대조를 할 수 없다. {@code userId} 는 반드시
     * 인증 주체(SecurityContext) 여야 하며, 신뢰된 내부 숫자 식별자여서 glob 메타문자를 포함하지 않는다.
     *
     * @param userId 세션을 폐기할 내부 사용자 식별자(access 토큰 subject 와 동일)
     */
    public void revokeAll(String userId) {
        if (userId == null || userId.isEmpty()) {
            return;
        }
        ScanOptions options = ScanOptions.scanOptions()
            .match(KEY_PREFIX + userId + ":*")
            .count(SCAN_COUNT)
            .build();
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redisTemplate.scan(options)) {
            while (cursor.hasNext()) {
                keys.add(cursor.next());
            }
        }
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys); // 다중 키 단일 DEL(원자 삭제)
        }
    }

    /** 주어진 세션에 신규 토큰을 생성·저장(덮어쓰기)하고 원문을 반환한다. */
    private String store(String userId, String sessionId) {
        String secret = randomToken(SECRET_BYTES);
        String token = userId + DELIMITER + sessionId + DELIMITER + secret;
        redisTemplate.opsForValue().set(key(userId, sessionId), sha256(token), refreshTtl);
        return token;
    }

    private String randomToken(int numBytes) {
        byte[] bytes = new byte[numBytes];
        random.nextBytes(bytes);
        return base64Url.encodeToString(bytes);
    }

    private static String key(String userId, String sessionId) {
        return KEY_PREFIX + userId + ":" + sessionId;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 미지원 환경", e); // 표준 JDK 에선 발생하지 않음
        }
    }

    /** 상수 시간 비교(타이밍 공격 방지) — 해시 원바이트 대조. */
    private static boolean constantTimeEquals(String left, String right) {
        return MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    /** 토큰을 {@code userId.sessionId.secret} 로 분해한다. 형식 위반이면 null. */
    private static Parsed parse(String token) {
        if (token == null) {
            return null;
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isEmpty() || parts[1].isEmpty() || parts[2].isEmpty()) {
            return null;
        }
        return new Parsed(parts[0], parts[1]);
    }

    /** 회전 결과 — 신규 refresh 원문과 소유 userId(재발급 access 클레임 구성용). */
    public record Rotation(String refreshToken, String userId) {
    }

    /** 토큰에서 추출한 라우팅 정보(비밀값 제외). */
    private record Parsed(String userId, String sessionId) {
        String key() {
            return RefreshTokenStore.key(userId, sessionId);
        }
    }
}
