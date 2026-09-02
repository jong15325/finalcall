package com.finalcall.support.seed;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/** Flyway나 서버 부팅에서 호출되지 않는 수동 시드 진입점. */
public final class OperationsSeedCli {
    private OperationsSeedCli() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            throw new IllegalArgumentException("명령 하나가 필요합니다.");
        }
        SeedGuard.SeedEnvironment environment = SeedGuard.validate(System.getenv(), args[0]);
        try (Connection connection = DriverManager.getConnection(environment.jdbcUrl(), environment.username(),
            environment.password())) {
            connection.setAutoCommit(false);
            if (OperationsListingSeedFixture.SCENARIO.equals(environment.scenario())) {
                runListingScenario(connection, environment);
                return;
            }
            OperationsSeedFixture fixture = new OperationsSeedFixture(connection, environment.scenario());
            OperationsSeedFixture.State state = fixture.state();
            System.out.printf("대상 DB=%s, 시나리오=%s, 상태=%s%n", environment.database(), environment.scenario(), state);
            switch (environment.command()) {
                case "status" -> connection.rollback();
                case "dry-run" -> {
                    fixture.dryRun();
                    connection.rollback();
                }
                case "apply" -> {
                    if (state == OperationsSeedFixture.State.COMPLETE) {
                        fixture.verify();
                        connection.rollback();
                        System.out.println("검증된 기존 시드가 있어 no-op 처리했습니다.");
                    } else {
                        fixture.requireEmpty(state);
                        fixture.apply(environment.passwordHash());
                        fixture.verify();
                        connection.commit();
                        System.out.println(environment.scenario() + " 시드 적용을 완료했습니다.");
                    }
                }
                case "cleanup" -> {
                    if (state == OperationsSeedFixture.State.EMPTY) {
                        connection.rollback();
                        System.out.println("정리할 시드가 없습니다.");
                    } else {
                        fixture.requireComplete(state);
                        fixture.cleanup();
                        connection.commit();
                        System.out.println(environment.scenario() + " 시드 정리를 완료했습니다.");
                    }
                }
                default -> throw new IllegalArgumentException("지원하지 않는 명령입니다.");
            }
        }
    }

    private static void runListingScenario(Connection connection, SeedGuard.SeedEnvironment environment)
        throws Exception {
        if ("redistribute-skills".equals(environment.command())) {
            connection.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
        }
        String lockName = "finalcall:" + OperationsListingSeedFixture.SCENARIO;
        if (!acquireLock(connection, lockName)) {
            throw new IllegalStateException("동일 시나리오가 이미 실행 중입니다.");
        }
        try {
            OperationsListingSeedFixture fixture = new OperationsListingSeedFixture(connection);
            OperationsListingSeedFixture.State state = fixture.state();
            System.out.printf("대상 DB=%s, 시나리오=%s, 상태=%s%n", environment.database(), environment.scenario(),
                state);
            switch (environment.command()) {
                case "status" -> connection.rollback();
                case "dry-run" -> {
                    fixture.dryRun();
                    connection.rollback();
                }
                case "apply" -> {
                    if (state == OperationsListingSeedFixture.State.COMPLETE) {
                        fixture.verify();
                        connection.rollback();
                        System.out.println("검증된 기존 시드가 있어 no-op 처리했습니다.");
                    } else if (state == OperationsListingSeedFixture.State.PARTIAL) {
                        throw new IllegalStateException("부분 적재 상태에서는 apply할 수 없습니다.");
                    } else {
                        fixture.apply();
                        fixture.verify();
                        connection.commit();
                        System.out.println(environment.scenario() + " 시드 적용을 완료했습니다.");
                    }
                }
                case "cleanup" -> {
                    if (state == OperationsListingSeedFixture.State.EMPTY) {
                        connection.rollback();
                        System.out.println("정리할 시드가 없습니다.");
                    } else if (state == OperationsListingSeedFixture.State.PARTIAL) {
                        throw new IllegalStateException("부분 적재 상태에서는 cleanup을 자동 실행하지 않습니다.");
                    } else {
                        fixture.cleanup();
                        connection.commit();
                        System.out.println(environment.scenario() + " 시드 정리를 완료했습니다.");
                    }
                }
                case "redistribute-skills" -> {
                    fixture.redistributeSkills();
                    fixture.verifyRedistribution();
                    connection.commit();
                    System.out.println(environment.scenario() + " 스킬 재분배를 완료했습니다.");
                }
                default -> throw new IllegalArgumentException("지원하지 않는 명령입니다.");
            }
        } catch (Exception exception) {
            connection.rollback();
            throw exception;
        } finally {
            releaseLock(connection, lockName);
        }
    }

    private static boolean acquireLock(Connection connection, String name) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("SELECT GET_LOCK(?, 0)")) {
            statement.setString(1, name);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1) == 1;
            }
        }
    }

    private static void releaseLock(Connection connection, String name) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("SELECT RELEASE_LOCK(?)")) {
            statement.setString(1, name);
            statement.executeQuery();
        }
    }
}
