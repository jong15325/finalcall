package com.finalcall.support.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class BoardOperationsSeedFixtureIntegrationTest {
    private static final String HASH = "$2a$12$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi";

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");

    @Test
    void 적용_멱등검증_부분상태_외부참조차단_정리를검증한다() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        try (Connection connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
            MYSQL.getPassword())) {
            connection.setAutoCommit(false);
            OperationsSeedFixture operations = new OperationsSeedFixture(connection, "ops-20-v2");
            operations.apply(HASH);
            operations.verify();
            connection.commit();

            BoardOperationsSeedFixture fixture = new BoardOperationsSeedFixture(connection);
            assertThat(fixture.state()).isEqualTo(BoardOperationsSeedFixture.State.EMPTY);
            fixture.dryRun();
            fixture.apply();
            fixture.verify();
            connection.commit();

            assertThat(fixture.state()).isEqualTo(BoardOperationsSeedFixture.State.COMPLETE);
            fixture.verify();
            assertThat(count(connection, "SELECT COUNT(*) FROM post WHERE public_id LIKE 'BSP01%' AND is_pinned=1 "
                + "AND created_at>=DATE_SUB(NOW(6),INTERVAL 30 DAY)")).isEqualTo(3);
            assertThat(count(connection, "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id "
                + "WHERE p.public_id LIKE 'BSP01%' AND b.slug='community' "
                + "AND p.created_at>=DATE_SUB(NOW(6),INTERVAL 7 DAY)")).isEqualTo(18);
            assertThat(count(connection, "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id "
                + "WHERE p.public_id LIKE 'BSP01%' AND b.slug='community' "
                + "AND p.created_at>=DATE_SUB(NOW(6),INTERVAL 24 HOUR)")).isEqualTo(8);
            assertThat(count(connection, "SELECT COUNT(*) FROM comment c JOIN post p ON p.id=c.post_id "
                + "WHERE c.public_id LIKE 'BSC01%' AND c.created_at<=p.created_at")).isZero();
            assertThat(count(connection, "SELECT COUNT(*) FROM comment c JOIN comment parent "
                + "ON parent.id=c.parent_comment_id WHERE c.public_id LIKE 'BSC01%' "
                + "AND c.created_at<=parent.created_at")).isZero();
            assertCommunityKinds(connection);

            assertFixtureMutationRejected(connection, fixture,
                "UPDATE comment SET content='변조' WHERE public_id='BSC01000000000000000000001'", "commentFixture");
            assertFixtureMutationRejected(connection, fixture, "UPDATE comment SET author_id=(SELECT id FROM user "
                + "WHERE login_id='test19') WHERE public_id='BSC01000000000000000000001'", "commentFixture");
            assertFixtureMutationRejected(connection, fixture,
                "UPDATE comment SET author_nickname='변조닉네임' WHERE public_id='BSC01000000000000000000001'",
                "commentFixture");
            assertFixtureMutationRejected(connection, fixture, "UPDATE comment SET post_id=(SELECT id FROM post "
                + "WHERE public_id='BSP01000000000000000000014') "
                + "WHERE public_id='BSC01000000000000000000001'", "시드 불변식");
            assertFixtureMutationRejected(connection, fixture, "UPDATE comment c JOIN comment parent "
                + "ON parent.public_id='BSC01000000000000000000001' SET c.parent_comment_id=parent.id "
                + "WHERE c.public_id='BSC01000000000000000000002'", "시드 불변식");
            assertFixtureMutationRejected(connection, fixture,
                "UPDATE comment SET mentioned_nickname='변조멘션' "
                    + "WHERE public_id='BSC01000000000000000000001'",
                "commentFixture");
            assertFixtureMutationRejected(connection, fixture, "UPDATE comment_reaction SET reaction_type="
                + "IF(reaction_type='LIKE','DISLIKE','LIKE') WHERE id=(SELECT id FROM (SELECT r.id "
                + "FROM comment_reaction r JOIN comment c ON c.id=r.comment_id "
                + "WHERE c.public_id LIKE 'BSC01%' LIMIT 1) target)", "시드 불변식");
            assertFixtureMutationRejected(connection, fixture, "UPDATE comment_reaction r JOIN comment c "
                + "ON c.id=r.comment_id JOIN (SELECT id FROM (SELECT x.id FROM comment_reaction x JOIN comment seeded "
                + "ON seeded.id=x.comment_id WHERE seeded.public_id LIKE 'BSC01%' LIMIT 1) chosen) target "
                + "ON target.id=r.id SET r.user_id=c.author_id", "시드 불변식");

            execute(connection, "UPDATE post SET comment_count=comment_count+1 WHERE public_id LIKE 'BSP01%' LIMIT 1");
            assertThatThrownBy(fixture::verify).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("postCounterMismatch");
            connection.rollback();

            execute(connection, "DELETE FROM comment_reaction WHERE comment_id IN "
                + "(SELECT id FROM comment WHERE public_id LIKE 'BSC01%') LIMIT 1");
            assertThat(fixture.state()).isEqualTo(BoardOperationsSeedFixture.State.PARTIAL);
            assertThatThrownBy(() -> fixture.requireComplete(fixture.state())).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("완전한 시드만");
            connection.rollback();

            execute(connection, "INSERT INTO post_image(public_id,post_id,uploader_id,storage_key,original_filename,"
                + "content_type,file_size,sort_order,created_at) SELECT 'EXTIMG00000000000000000001',p.id,u.id,"
                + "'external/test.png','test.png','image/png',10,0,NOW(6) FROM post p JOIN user u "
                + "ON u.login_id='test01' WHERE p.public_id LIKE 'BSP01%' LIMIT 1");
            connection.commit();
            assertThatThrownBy(fixture::dryRun).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 게시판 참조");
            assertThatThrownBy(() -> fixture.requireComplete(fixture.state())).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 게시판 참조");
            connection.rollback();

            execute(connection, "DELETE FROM post_image WHERE public_id='EXTIMG00000000000000000001'");
            connection.commit();
            fixture.requireComplete(fixture.state());
            fixture.cleanup();
            connection.commit();
            assertThat(fixture.state()).isEqualTo(BoardOperationsSeedFixture.State.EMPTY);

            assertThat(count(connection, "SELECT COUNT(*) FROM user WHERE public_id LIKE 'OP2USR%'"))
                .isEqualTo(20);
            assertThat(count(connection, "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OP2ITM%'"))
                .isEqualTo(240);
        }
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    private void assertCommunityKinds(Connection connection) throws Exception {
        assertThat(count(connection, kindSql("질문"))).isEqualTo(12);
        assertThat(count(connection, kindSql("공략"))).isEqualTo(9);
        assertThat(count(connection, kindSql("모집"))).isEqualTo(6);
        assertThat(count(connection, kindSql("후기"))).isEqualTo(6);
        assertThat(count(connection, kindSql("거래·시세"))).isEqualTo(3);
    }

    private String kindSql(String kind) {
        return "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id WHERE p.public_id LIKE 'BSP01%' "
            + "AND b.slug='community' AND p.title LIKE '[" + kind + "]%'";
    }

    private void assertFixtureMutationRejected(Connection connection, BoardOperationsSeedFixture fixture, String sql,
        String message) throws Exception {
        execute(connection, sql);
        assertThat(fixture.state()).isEqualTo(BoardOperationsSeedFixture.State.COMPLETE);
        assertThatThrownBy(() -> fixture.requireComplete(fixture.state())).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining(message);
        connection.rollback();
    }

    private long count(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql); var rows = statement.executeQuery()) {
            rows.next();
            return rows.getLong(1);
        }
    }
}
