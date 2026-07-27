package com.finalcall.infra.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * 회원 이메일 인증 6자리 코드 저장소(EPIC-EMAIL-VERIFY, spec §2.3) — Redis({@link StringRedisTemplate}) 기반.
 * {@link RefreshTokenStore} 스킴을 준용한다(SHA-256 해시 저장·Lua 원자 처리).
 *
 * <p>키 스킴:
 * <ul>
 *   <li>{@code auth:email:verify:{userId}} (Hash) — 필드 {@code codeHash}=SHA-256(코드),
 *       {@code emailHash}=SHA-256(정규화 이메일), {@code attempts}=시도 횟수. TTL=코드 만료(600s).</li>
 *   <li>{@code auth:email:verify:cd:{userId}} (String, 존재만으로 쿨다운 판정) TTL=재전송 쿨다운(60s).</li>
 * </ul>
 *
 * <p><b>레이어 규율(infra→domain 금지)</b>: 여기서는 도메인 예외(EmailErrorCode)를 던지지 않고 중립 타입
 * ({@link Optional}·{@link VerifyOutcome} 열거)으로 결과를 반환한다. EMAIL_001/002/003/004 매핑은 호출 측
 * 도메인 서비스(FC-132)가 담당한다.
 *
 * <p><b>정책값 주입</b>: 만료·쿨다운·시도제한·자릿수는 상수 하드코딩이 아니라 생성자 primitive 로 주입받는다
 * (spec §2.4 — 컴파일 상수 금지). {@code @Component} 를 붙이지 않는 무-애노테이션 순수 클래스로, FC-130 이
 * {@code EmailVerifyProperties} → 이 생성자 배선을 명시({@code @Bean})로 담당한다.
 */
public class EmailVerificationCodeStore {

    private static final String VERIFY_KEY_PREFIX = "auth:email:verify:";
    private static final String COOLDOWN_KEY_PREFIX = "auth:email:verify:cd:";

    /**
     * 발송을 원자적으로 처리하는 Lua(쿨다운 선점 → 해시 세팅).
     * 쿨다운 키를 {@code SET NX EX} 로 선점 시도해 실패(nil)면 쿨다운 내이므로 {@code 0}, 성공하면 이전
     * pending 해시를 지우고 신규 해시({@code codeHash}/{@code emailHash}/{@code attempts=0})를 세팅한 뒤
     * 만료 TTL 을 걸고 {@code 1}. 쿨다운 SET NX 가 단일 승자를 보장하므로 동시 발송 경쟁에서 정확히 하나만 세팅된다.
     */
    private static final RedisScript<Long> ISSUE_SCRIPT = new DefaultRedisScript<>("""
        local ok = redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[4])
        if not ok then return 0 end
        redis.call('DEL', KEYS[1])
        redis.call('HSET', KEYS[1], 'codeHash', ARGV[1], 'emailHash', ARGV[2], 'attempts', '0')
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return 1
        """, Long.class);

    /**
     * 검증을 원자적으로 처리하는 Lua(시도 카운트 누수 방지). RefreshTokenStore {@code ROTATE_SCRIPT} 선례.
     * 순서: (1)해시 없음→EXPIRED (2)emailHash 불일치→키삭제·EXPIRED(존재 비노출) (3)attempts+1>상한→키삭제·
     * ATTEMPTS_EXCEEDED (4)codeHash 불일치→attempts 증가 커밋·MISMATCH (5)일치→키삭제·SUCCESS.
     *
     * <p>SHA-256 해시는 Java 에서 미리 계산해 ARGV 로 넘긴다(Lua 는 문자열 {@code ==} 비교만). codeHash 비교를
     * Lua {@code ==} 로 하는 것은 — 비교 대상이 원문 코드가 아니라 고정길이 base64 <b>해시</b>라 타이밍 노출이
     * 미미하고, 여기서는 attempts 증가·삭제와의 <b>원자성(카운트 누수 방지)</b>이 상수시간 비교보다 우선이기
     * 때문이다(spec §2.3·concurrency-review). 원문 대조가 아니므로 무차별 방어의 본질(시도제한)은 유지된다.
     */
    private static final RedisScript<String> VERIFY_SCRIPT = new DefaultRedisScript<>("""
        local emailHash = redis.call('HGET', KEYS[1], 'emailHash')
        if not emailHash then return 'EXPIRED' end
        if emailHash ~= ARGV[1] then
          redis.call('DEL', KEYS[1])
          return 'EXPIRED'
        end
        local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts')) or 0
        if attempts + 1 > tonumber(ARGV[3]) then
          redis.call('DEL', KEYS[1])
          return 'ATTEMPTS_EXCEEDED'
        end
        local codeHash = redis.call('HGET', KEYS[1], 'codeHash')
        if codeHash == ARGV[2] then
          redis.call('DEL', KEYS[1])
          return 'SUCCESS'
        end
        redis.call('HINCRBY', KEYS[1], 'attempts', 1)
        return 'MISMATCH'
        """, String.class);

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom random = new SecureRandom();
    private final long ttlSeconds;
    private final long cooldownSeconds;
    private final int maxAttempts;
    private final int codeLength;
    private final int codeBound;

    /**
     * @param redisTemplate   Redis 접근({@link StringRedisTemplate})
     * @param ttlSeconds      코드 만료(초, 정책 600)
     * @param cooldownSeconds 재전송 쿨다운(초, 정책 60)
     * @param maxAttempts     시도 제한(회, 정책 5)
     * @param codeLength      코드 자릿수(정책 6)
     */
    public EmailVerificationCodeStore(StringRedisTemplate redisTemplate, long ttlSeconds, long cooldownSeconds,
        int maxAttempts, int codeLength) {
        this.redisTemplate = redisTemplate;
        this.ttlSeconds = ttlSeconds;
        this.cooldownSeconds = cooldownSeconds;
        this.maxAttempts = maxAttempts;
        this.codeLength = codeLength;
        this.codeBound = (int)Math.pow(10, codeLength); // 예: 6자리 → 1_000_000(0 ~ 999999 균등)
    }

    /**
     * 인증 코드를 발급한다: 쿨다운 검사 통과 시 6자리 코드를 생성해 해시(codeHash·emailHash·attempts=0, TTL 만료)를
     * 세팅하고 쿨다운 키(TTL 쿨다운)를 건 뒤 <b>생성한 평문 코드</b>를 반환한다. 평문은 저장하지 않으며, 호출 측
     * (FC-132)이 이 반환값을 EmailSender 로 발송한다.
     *
     * @param userId          내부 사용자 식별자(access 토큰 subject 와 동일)
     * @param normalizedEmail 정규화(lowercase+trim)된 대상 이메일 — 정규화는 <b>호출 측 책임</b>
     * @return 발급 성공 시 평문 코드, 쿨다운 내면 {@link Optional#empty()}(코드 미생성)
     */
    public Optional<String> issue(String userId, String normalizedEmail) {
        String code = generateCode();
        Long issued = redisTemplate.execute(ISSUE_SCRIPT, List.of(verifyKey(userId), cooldownKey(userId)),
            sha256(code), sha256(normalizedEmail), String.valueOf(ttlSeconds), String.valueOf(cooldownSeconds));
        if (issued != null && issued == 1L) {
            return Optional.of(code);
        }
        return Optional.empty(); // 쿨다운 내(SET NX 선점 실패) — 생성한 코드는 폐기
    }

    /**
     * 제시된 코드를 <b>원자적으로</b> 검증한다(시도 카운트 누수 방지). 결과는 중립 열거 {@link VerifyOutcome} 로 반환하며,
     * EMAIL_* 매핑은 호출 측 도메인 서비스가 담당한다.
     *
     * @param userId          내부 사용자 식별자
     * @param presentedCode   사용자가 제시한 코드(원문)
     * @param normalizedEmail 현재 회원 이메일(정규화) — 발송 시점 이메일과 바인딩 검사(TOCTOU 심층 방어)
     * @return {@link VerifyOutcome} 5-상태(EXPIRED·ATTEMPTS_EXCEEDED·MISMATCH·SUCCESS)
     */
    public VerifyOutcome verify(String userId, String presentedCode, String normalizedEmail) {
        String result = redisTemplate.execute(VERIFY_SCRIPT, List.of(verifyKey(userId)),
            sha256(normalizedEmail), sha256(presentedCode), String.valueOf(maxAttempts));
        return VerifyOutcome.valueOf(result);
    }

    /**
     * pending 코드·쿨다운 키를 삭제한다(이메일 설정/변경 시 TOCTOU 주 방어 — spec §2.3). {@code verify:{userId}}·
     * {@code cd:{userId}} 둘 다 DEL. 키가 없어도 no-op(멱등).
     *
     * @param userId 내부 사용자 식별자
     */
    public void clear(String userId) {
        redisTemplate.delete(List.of(verifyKey(userId), cooldownKey(userId)));
    }

    /** codeLength 자리 숫자 코드를 SecureRandom 으로 균등 생성한다(앞자리 0 보존 위해 0-패딩). */
    private String generateCode() {
        return String.format("%0" + codeLength + "d", random.nextInt(codeBound));
    }

    private static String verifyKey(String userId) {
        return VERIFY_KEY_PREFIX + userId;
    }

    private static String cooldownKey(String userId) {
        return COOLDOWN_KEY_PREFIX + userId;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 미지원 환경", e); // 표준 JDK 에선 발생하지 않음
        }
    }

    /** 검증 결과(중립 열거). EMAIL_001(MISMATCH)·EMAIL_002(EXPIRED)·EMAIL_003(ATTEMPTS_EXCEEDED) 매핑은 호출 측 담당. */
    public enum VerifyOutcome {
        /** 코드 만료·미발송·emailHash 불일치 통일(존재 여부 비노출). → EMAIL_002 */
        EXPIRED,
        /** 시도 횟수 초과(코드 폐기). → EMAIL_003 */
        ATTEMPTS_EXCEEDED,
        /** 코드 불일치(attempts 증가 커밋). → EMAIL_001 */
        MISMATCH,
        /** 일치(코드 키 삭제). 호출 측이 email_verified=true 커밋. */
        SUCCESS
    }
}
