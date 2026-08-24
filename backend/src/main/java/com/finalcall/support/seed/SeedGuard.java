package com.finalcall.support.seed;

import java.net.URI;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/** 일반 애플리케이션과 분리된 운영형 시드 CLI의 실행 안전장치. */
public final class SeedGuard {
    public static final String DEFAULT_SCENARIO = "ops-20-v2";
    private static final Pattern BCRYPT = Pattern.compile("^\\$2[aby]\\$12\\$[./A-Za-z0-9]{53}$");

    private SeedGuard() {
    }

    public static SeedEnvironment validate(Map<String, String> env, String command) {
        String url = required(env, "SEED_JDBC_URL");
        URI uri = URI.create(url.substring(5));
        String database = uri.getPath();
        database = database.substring(database.lastIndexOf('/') + 1).split("\\?")[0];
        int port = uri.getPort() < 0 ? 3306 : uri.getPort();
        String scenario = required(env, "SEED_SCENARIO");
        if (!java.util.Set.of("ops-20-v1", DEFAULT_SCENARIO).contains(scenario)) {
            throw new IllegalArgumentException("지원하지 않는 시나리오입니다.");
        }
        String fingerprint = uri.getHost().toLowerCase(Locale.ROOT) + ":" + port + "/" + database + ":" + scenario;
        if (!fingerprint.equals(required(env, "SEED_CONFIRM_TARGET_FINGERPRINT"))) {
            throw new IllegalArgumentException("SEED_CONFIRM_TARGET이 대상 DB와 일치하지 않습니다.");
        }
        String normalized = command.toLowerCase(Locale.ROOT);
        if (!java.util.Set.of("dry-run", "apply", "status", "cleanup").contains(normalized)) {
            throw new IllegalArgumentException("지원하지 않는 명령입니다.");
        }
        String hash = env.get("SEED_PASSWORD_HASH");
        boolean write = "apply".equals(normalized) || "cleanup".equals(normalized);
        if (write && (!Boolean.parseBoolean(env.getOrDefault("SEED_ALLOW_PROD", "false"))
            || !(normalized.toUpperCase(Locale.ROOT) + ":" + fingerprint)
                .equals(env.get("SEED_CONFIRM_WRITE")))) {
            throw new IllegalStateException("쓰기 명령은 SEED_ALLOW_PROD=true와 명령별 SEED_CONFIRM_WRITE가 필요합니다.");
        }
        if ("apply".equals(normalized) && (hash == null || !BCRYPT.matcher(hash).matches())) {
            throw new IllegalArgumentException("apply에는 BCrypt SEED_PASSWORD_HASH가 필요합니다.");
        }
        return new SeedEnvironment(url, required(env, "SEED_DB_USERNAME"), required(env, "SEED_DB_PASSWORD"), database,
            normalized, hash, scenario);
    }

    private static String required(Map<String, String> env, String name) {
        String value = env.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " 환경변수가 필요합니다.");
        }
        return value;
    }

    public record SeedEnvironment(String jdbcUrl, String username, String password, String database, String command,
        String passwordHash, String scenario) {
    }
}
