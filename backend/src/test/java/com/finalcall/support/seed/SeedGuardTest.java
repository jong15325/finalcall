package com.finalcall.support.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class SeedGuardTest {
    @Test
    void 대상확인이일치하지않으면거부한다() {
        Map<String, String> env = valid();
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "other:3306/finalcall_test:ops-20-v1");
        assertThatThrownBy(() -> SeedGuard.validate(env, "dry-run")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 쓰기명령은프로파일과무관하게명시적허용이필요하다() {
        Map<String, String> env = valid();
        assertThatThrownBy(() -> SeedGuard.validate(env, "cleanup")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 적용은bcrypt해시가필요하다() {
        Map<String, String> env = valid();
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:ops-20-v1");
        assertThatThrownBy(() -> SeedGuard.validate(env, "apply")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 비용12미만bcrypt는거부한다() {
        Map<String, String> env = valid();
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:ops-20-v1");
        env.put("SEED_PASSWORD_HASH", "$2a$10$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi");

        assertThatThrownBy(() -> SeedGuard.validate(env, "apply")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 비용12bcrypt는허용한다() {
        Map<String, String> env = valid();
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:ops-20-v1");
        env.put("SEED_PASSWORD_HASH", "$2a$12$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi");

        assertThat(SeedGuard.validate(env, "apply").passwordHash()).startsWith("$2a$12$");
    }

    @Test
    void 비용12가아닌강한bcrypt도거부한다() {
        for (String cost : new String[] {"13", "19", "31"}) {
            Map<String, String> env = valid();
            env.put("SEED_ALLOW_PROD", "true");
            env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:ops-20-v1");
            env.put("SEED_PASSWORD_HASH", "$2a$" + cost
                + "$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi");

            assertThatThrownBy(() -> SeedGuard.validate(env, "apply"))
                .as("BCrypt cost %s", cost)
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void v2시나리오와fingerprint를허용한다() {
        Map<String, String> env = valid();
        env.put("SEED_SCENARIO", "ops-20-v2");
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "localhost:3306/finalcall_test:ops-20-v2");

        assertThat(SeedGuard.validate(env, "dry-run").scenario()).isEqualTo("ops-20-v2");
    }

    @Test
    void 게시판시나리오는비밀번호해시없이적용할수있다() {
        Map<String, String> env = valid();
        env.put("SEED_SCENARIO", "board-surf-20-v1");
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "localhost:3306/finalcall_test:board-surf-20-v1");
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:board-surf-20-v1");

        assertThat(SeedGuard.validate(env, "apply").scenario()).isEqualTo("board-surf-20-v1");
    }

    private Map<String, String> valid() {
        Map<String, String> env = new HashMap<>();
        env.put("SEED_JDBC_URL", "jdbc:mysql://localhost:3306/finalcall_test");
        env.put("SEED_DB_USERNAME", "tester");
        env.put("SEED_DB_PASSWORD", "secret");
        env.put("SEED_SCENARIO", "ops-20-v1");
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "localhost:3306/finalcall_test:ops-20-v1");
        return env;
    }

    @Test
    void 운영목록100_apply는_계정을_생성하지_않아_비밀번호_해시가_필요없다() {
        Map<String, String> env = valid();
        env.put("SEED_SCENARIO", "ops-listings-100-v1");
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "localhost:3306/finalcall_test:ops-listings-100-v1");
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "APPLY:localhost:3306/finalcall_test:ops-listings-100-v1");

        assertThat(SeedGuard.validate(env, "apply").passwordHash()).isNull();
    }

    @Test
    void 스킬재분배는_쓰기확인과_실제_복원검증백업이_필요하다() throws Exception {
        Map<String, String> env = valid();
        env.put("SEED_SCENARIO", "ops-listings-100-v1");
        env.put("SEED_CONFIRM_TARGET_FINGERPRINT", "localhost:3306/finalcall_test:ops-listings-100-v1");
        env.put("SEED_ALLOW_PROD", "true");
        env.put("SEED_CONFIRM_WRITE", "REDISTRIBUTE-SKILLS:localhost:3306/finalcall_test:ops-listings-100-v1");

        assertThatThrownBy(() -> SeedGuard.validate(env, "redistribute-skills"))
            .isInstanceOf(IllegalArgumentException.class);
        Path directory = Files.createTempDirectory("seed-backup-test");
        Path dump = directory.resolve("before.sql");
        Files.writeString(dump, "SELECT 1;\n".repeat(200_000));
        String hash = java.util.HexFormat.of().withUpperCase()
            .formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(dump)));
        StringBuilder manifest = new StringBuilder("fingerprint=localhost:3306/finalcall_test:ops-listings-100-v1\n")
            .append("sha256=").append(hash).append("\nrestoreVerified=true\n")
            .append("tables=item_instance,item_ownership_history,auction,shop,bid,money_hold,user_balance\n");
        for (String table : new String[] {"item_instance", "item_ownership_history", "auction", "shop", "bid",
            "money_hold", "user_balance"}) {
            manifest.append("rows.").append(table).append("=1\nchecksum.").append(table).append("=x\n");
        }
        Path manifestPath = directory.resolve("manifest.txt");
        Files.writeString(manifestPath, manifest);
        env.put("SEED_BACKUP_MANIFEST_PATH", manifestPath.toString());
        env.put("SEED_BACKUP_SHA256", hash);
        assertThat(SeedGuard.validate(env, "redistribute-skills").command()).isEqualTo("redistribute-skills");

        env.put("SEED_BACKUP_SHA256", "a".repeat(64));
        assertThatThrownBy(() -> SeedGuard.validate(env, "redistribute-skills"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
