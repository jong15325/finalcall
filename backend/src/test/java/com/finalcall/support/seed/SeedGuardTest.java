package com.finalcall.support.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
}
