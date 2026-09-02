package com.finalcall.support.seed;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
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
        if (!java.util.Set.of("ops-20-v1", DEFAULT_SCENARIO, "board-surf-20-v1", "ops-listings-100-v1")
            .contains(scenario)) {
            throw new IllegalArgumentException("지원하지 않는 시나리오입니다.");
        }
        String fingerprint = uri.getHost().toLowerCase(Locale.ROOT) + ":" + port + "/" + database + ":" + scenario;
        if (!fingerprint.equals(required(env, "SEED_CONFIRM_TARGET_FINGERPRINT"))) {
            throw new IllegalArgumentException("SEED_CONFIRM_TARGET이 대상 DB와 일치하지 않습니다.");
        }
        String normalized = command.toLowerCase(Locale.ROOT);
        if (!java.util.Set.of("dry-run", "apply", "status", "cleanup", "redistribute-skills").contains(normalized)) {
            throw new IllegalArgumentException("지원하지 않는 명령입니다.");
        }
        String hash = env.get("SEED_PASSWORD_HASH");
        boolean write = "apply".equals(normalized) || "cleanup".equals(normalized)
            || "redistribute-skills".equals(normalized);
        if (write && (!Boolean.parseBoolean(env.getOrDefault("SEED_ALLOW_PROD", "false"))
            || !(normalized.toUpperCase(Locale.ROOT) + ":" + fingerprint)
                .equals(env.get("SEED_CONFIRM_WRITE")))) {
            throw new IllegalStateException("쓰기 명령은 SEED_ALLOW_PROD=true와 명령별 SEED_CONFIRM_WRITE가 필요합니다.");
        }
        if ("apply".equals(normalized) && java.util.Set.of("ops-20-v1", DEFAULT_SCENARIO).contains(scenario)
            && (hash == null || !BCRYPT.matcher(hash).matches())) {
            throw new IllegalArgumentException("apply에는 BCrypt SEED_PASSWORD_HASH가 필요합니다.");
        }
        if ("redistribute-skills".equals(normalized)
            && !"ops-listings-100-v1".equals(scenario)) {
            throw new IllegalArgumentException("스킬 재분배는 운영 목록 100건 시나리오에서만 지원합니다.");
        }
        if ("redistribute-skills".equals(normalized)) {
            verifyBackup(env, fingerprint);
        }
        return new SeedEnvironment(url, required(env, "SEED_DB_USERNAME"), required(env, "SEED_DB_PASSWORD"), database,
            normalized, hash, scenario);
    }

    private static void verifyBackup(Map<String, String> env, String fingerprint) {
        try {
            Path manifestPath = Path.of(required(env, "SEED_BACKUP_MANIFEST_PATH")).toAbsolutePath().normalize();
            Path dumpPath = manifestPath.resolveSibling("before.sql");
            if (!Files.isRegularFile(manifestPath) || !Files.isRegularFile(dumpPath)) {
                throw new IllegalArgumentException("백업 manifest와 dump 파일이 필요합니다.");
            }
            Map<String, String> manifest = Files.readAllLines(manifestPath).stream()
                .filter(line -> line.contains("="))
                .collect(java.util.stream.Collectors.toMap(line -> line.substring(0, line.indexOf('=')),
                    line -> line.substring(line.indexOf('=') + 1)));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = Files.newInputStream(dumpPath)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            String actualHash = java.util.HexFormat.of().withUpperCase().formatHex(digest.digest());
            if (!"true".equals(manifest.get("restoreVerified")) || !fingerprint.equals(manifest.get("fingerprint"))
                || !actualHash.equalsIgnoreCase(manifest.getOrDefault("sha256", ""))
                || !actualHash.equalsIgnoreCase(required(env, "SEED_BACKUP_SHA256"))) {
                throw new IllegalArgumentException("복원 검증 백업의 fingerprint 또는 SHA-256이 일치하지 않습니다.");
            }
            String tables = manifest.getOrDefault("tables", "");
            for (String table : new String[] {"item_instance", "item_ownership_history", "auction", "shop", "bid",
                "money_hold", "user_balance"}) {
                if (!java.util.Arrays.asList(tables.split(",")).contains(table)
                    || !manifest.containsKey("rows." + table) || !manifest.containsKey("checksum." + table)) {
                    throw new IllegalArgumentException("백업 검증 항목이 누락되었습니다: " + table);
                }
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("백업 검증 정보를 읽을 수 없습니다.", exception);
        }
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
