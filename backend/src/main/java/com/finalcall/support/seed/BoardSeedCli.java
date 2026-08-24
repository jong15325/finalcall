package com.finalcall.support.seed;

import java.sql.Connection;
import java.sql.DriverManager;

/** Flyway나 서버 부팅에서 호출되지 않는 게시판 운영형 시드 진입점. */
public final class BoardSeedCli {
    private static final String SCENARIO = "board-surf-20-v1";

    private BoardSeedCli() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            throw new IllegalArgumentException("명령 하나가 필요합니다.");
        }
        SeedGuard.SeedEnvironment environment = SeedGuard.validate(System.getenv(), args[0]);
        if (!SCENARIO.equals(environment.scenario())) {
            throw new IllegalArgumentException("게시판 CLI는 board-surf-20-v1 시나리오만 지원합니다.");
        }
        try (Connection connection = DriverManager.getConnection(environment.jdbcUrl(), environment.username(),
            environment.password())) {
            connection.setAutoCommit(false);
            BoardOperationsSeedFixture fixture = new BoardOperationsSeedFixture(connection);
            BoardOperationsSeedFixture.State state = fixture.state();
            System.out.printf("대상 DB=%s, 시나리오=%s, 상태=%s%n", environment.database(), SCENARIO, state);
            switch (environment.command()) {
                case "status" -> connection.rollback();
                case "dry-run" -> {
                    fixture.dryRun();
                    connection.rollback();
                }
                case "apply" -> {
                    if (state == BoardOperationsSeedFixture.State.COMPLETE) {
                        fixture.verify();
                        connection.rollback();
                        System.out.println("검증된 기존 시드가 있어 no-op 처리했습니다.");
                    } else {
                        fixture.requireEmpty(state);
                        fixture.apply();
                        fixture.verify();
                        connection.commit();
                        System.out.println(SCENARIO + " 시드 적용을 완료했습니다.");
                    }
                }
                case "cleanup" -> {
                    if (state == BoardOperationsSeedFixture.State.EMPTY) {
                        connection.rollback();
                        System.out.println("정리할 시드가 없습니다.");
                    } else {
                        fixture.requireComplete(state);
                        fixture.cleanup();
                        connection.commit();
                        System.out.println(SCENARIO + " 시드 정리를 완료했습니다.");
                    }
                }
                default -> throw new IllegalArgumentException("지원하지 않는 명령입니다.");
            }
        }
    }
}
