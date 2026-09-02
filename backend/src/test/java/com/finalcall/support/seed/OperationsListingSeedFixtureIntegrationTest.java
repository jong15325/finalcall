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
class OperationsListingSeedFixtureIntegrationTest {
    private static final String HASH = "$2a$12$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi";

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");

    @Test
    void 정확한_분포로_적용하고_외부_참조가_없을_때만_정리한다() throws Exception {
        migrate();
        try (Connection connection = connection()) {
            prepareUsers(connection, true);
            OperationsListingSeedFixture fixture = new OperationsListingSeedFixture(connection);
            assertThat(fixture.state()).isEqualTo(OperationsListingSeedFixture.State.EMPTY);
            fixture.dryRun();
            fixture.apply();
            fixture.verify();
            connection.commit();
            assertThat(fixture.state()).isEqualTo(OperationsListingSeedFixture.State.COMPLETE);
            execute(connection, "UPDATE auction a JOIN item_instance i ON i.id=a.item_instance_id "
                + "JOIN (SELECT id FROM (SELECT id FROM auction WHERE public_id LIKE 'OL1AUC%' "
                + "ORDER BY public_id DESC LIMIT 24) selected) x ON x.id=a.id "
                + "SET a.status='SOLD',i.location='INVENTORY'");
            connection.commit();
            String excludedBefore = excludedSignature(connection);
            execute(connection, "UPDATE item_instance i LEFT JOIN auction a ON a.item_instance_id=i.id "
                + "LEFT JOIN shop s ON s.item_instance_id=i.id SET i.skill1_id=NULL,i.skill2_id=(SELECT id FROM "
                + "skill_definition WHERE skill_code=431),i.skill_percent=1 WHERE i.public_id LIKE 'OL1ITM%' "
                + "AND (a.status='ACTIVE' OR s.status='ACTIVE')");
            String corrupted = skillSignature(connection);
            fixture.redistributeSkills();
            fixture.verifyRedistribution();
            String first = skillSignature(connection);
            fixture.redistributeSkills();
            fixture.verifyRedistribution();
            assertThat(skillSignature(connection)).isEqualTo(first);
            assertThat(first).isNotEqualTo(corrupted);
            assertThat(excludedSignature(connection)).isEqualTo(excludedBefore);
            assertThat(count(connection, "SELECT COUNT(*) FROM item_instance i WHERE i.public_id LIKE 'OL1ITM%' "
                + "AND NOT EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id AND a.status='ACTIVE') "
                + "AND NOT EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE')"))
                .isEqualTo(24);
            assertThat(count(connection, "SELECT COUNT(*) FROM item_instance i JOIN skill_definition s "
                + "ON s.id=i.skill1_id WHERE i.public_id LIKE 'OL1ITM%' AND s.skill_code BETWEEN 100 AND 197 "
                + "AND EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id AND a.status='ACTIVE' "
                + "UNION ALL SELECT 1 FROM shop x WHERE x.item_instance_id=i.id AND x.status='ACTIVE')"))
                .isEqualTo(58);
            assertThat(count(connection, "SELECT COUNT(*) FROM item_instance i JOIN skill_definition s "
                + "ON s.id=i.skill2_id WHERE i.public_id LIKE 'OL1ITM%' AND (s.skill_code BETWEEN 200 AND 209 "
                + "OR s.skill_code BETWEEN 300 AND 435) AND EXISTS (SELECT 1 FROM auction a "
                + "WHERE a.item_instance_id=i.id AND a.status='ACTIVE' UNION ALL SELECT 1 FROM shop x "
                + "WHERE x.item_instance_id=i.id AND x.status='ACTIVE')"))
                .isEqualTo(116);
            assertThat(count(connection, "SELECT COUNT(DISTINCT skill_percent) FROM item_instance "
                + "WHERE public_id LIKE 'OL1ITM%' AND skill_percent>0 AND EXISTS (SELECT 1 FROM auction a "
                + "WHERE a.item_instance_id=item_instance.id AND a.status='ACTIVE' UNION ALL SELECT 1 FROM shop x "
                + "WHERE x.item_instance_id=item_instance.id AND x.status='ACTIVE')")).isGreaterThanOrEqualTo(10);

            var activeReferenceSavepoint = connection.setSavepoint();
            execute(connection, "INSERT INTO temp_storage(instance_id,owner_id,stored_at,expire_at,created_at) "
                + "SELECT i.id,i.owner_id,NOW(6),NULL,NOW(6) FROM item_instance i JOIN auction a "
                + "ON a.item_instance_id=i.id WHERE a.public_id LIKE 'OL1AUC%' AND a.status='ACTIVE' LIMIT 1");
            assertThatThrownBy(fixture::redistributeSkills).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ACTIVE 대상에 외부 거래 또는 소유권 참조");
            connection.rollback(activeReferenceSavepoint);

            var invariantSavepoint = connection.setSavepoint();
            execute(connection, "UPDATE item_instance SET skill2_id=skill1_id,skill_percent=999 WHERE id=(SELECT id "
                + "FROM (SELECT i.id FROM item_instance i WHERE i.public_id LIKE 'OL1ITM%' "
                + "AND i.skill1_id IS NOT NULL AND "
                + "EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE') "
                + "LIMIT 1) target)");
            assertThat(count(connection, "SELECT COUNT(*) FROM item_instance i WHERE i.skill1_id=i.skill2_id "
                + "AND EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE')"))
                .isEqualTo(1);
            assertThatThrownBy(fixture::verifyRedistribution).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("activeSkillCap=1/0").hasMessageContaining("activeDuplicateSkill=1/0");
            connection.rollback(invariantSavepoint);

            invariantSavepoint = connection.setSavepoint();
            execute(connection, "UPDATE item_instance SET skill2_id=NULL WHERE id=(SELECT id FROM (SELECT i.id "
                + "FROM item_instance i WHERE i.public_id LIKE 'OL1ITM%' AND i.skill1_id IS NOT NULL AND "
                + activeItemPredicateForTest()
                + " LIMIT 1) target)");
            assertThatThrownBy(fixture::verifyRedistribution).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("activeSingleMustUseSlot2=1/0");
            connection.rollback(invariantSavepoint);

            invariantSavepoint = connection.setSavepoint();
            execute(connection, "UPDATE item_instance SET skill_percent=1 WHERE id=(SELECT id FROM (SELECT i.id "
                + "FROM item_instance i WHERE i.public_id LIKE 'OL1ITM%' AND i.skill1_id IS NULL "
                + "AND i.skill2_id IS NULL AND "
                + "EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE') "
                + "LIMIT 1) target)");
            assertThatThrownBy(fixture::verifyRedistribution).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("activeNonePercent=1/0");
            connection.rollback(invariantSavepoint);

            assertThatThrownBy(() -> insertCompetingBid()).isInstanceOf(java.sql.SQLException.class)
                .hasMessageContaining("Lock wait timeout");

            execute(connection, "UPDATE item_instance SET skill2_id=(SELECT id FROM skill_definition "
                + "WHERE skill_code=377) WHERE id=(SELECT id FROM (SELECT i.id FROM item_instance i "
                + "JOIN item_template t ON t.id=i.template_id WHERE i.public_id LIKE 'OL1ITM%' "
                + "AND t.sub_group=3 AND t.element IN (1,3) AND EXISTS (SELECT 1 FROM auction a "
                + "WHERE a.item_instance_id=i.id AND a.status='ACTIVE' UNION ALL SELECT 1 FROM shop s "
                + "WHERE s.item_instance_id=i.id AND s.status='ACTIVE') LIMIT 1) target)");
            assertThatThrownBy(fixture::verifyRedistribution).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("skillApplicability=1/0");
            connection.rollback();
            assertThat(count(connection, "SELECT COUNT(*) FROM money_hold h JOIN user u ON u.id=h.user_id "
                + "JOIN bid b ON b.id=h.bid_id WHERE b.public_id LIKE 'OL1BID%' AND h.status='HELD' "
                + "AND u.login_id='test01'")).isZero();

            execute(connection, "INSERT INTO bid(public_id,auction_id,bidder_id,amount,status,created_at,updated_at) "
                + "SELECT 'EXTERNALBID000000000000001',a.id,u.id,a.start_price+999999,'OUTBID',NOW(6),NOW(6) "
                + "FROM auction a JOIN user u ON u.login_id='test20' WHERE a.public_id LIKE 'OL1AUC%' LIMIT 1");
            connection.commit();
            assertThatThrownBy(fixture::cleanup).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/입찰/소유권 참조");
            connection.rollback();
            execute(connection, "DELETE FROM bid WHERE public_id='EXTERNALBID000000000000001'");
            connection.commit();

            execute(connection, "INSERT INTO temp_storage(instance_id,owner_id,stored_at,expire_at,created_at) "
                + "SELECT id,owner_id,NOW(6),NULL,NOW(6) FROM item_instance WHERE public_id LIKE 'OL1ITM%' LIMIT 1");
            assertThatThrownBy(fixture::cleanup).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/입찰/소유권 참조");
            connection.rollback();

            execute(connection, "UPDATE item_delivery SET item_instance_id=(SELECT id FROM item_instance "
                + "WHERE public_id LIKE 'OL1ITM%' LIMIT 1) LIMIT 1");
            assertThatThrownBy(fixture::cleanup).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/입찰/소유권 참조");
            connection.rollback();

            execute(connection, "UPDATE auction a JOIN item_instance i ON i.id=a.item_instance_id "
                + "SET a.status='ACTIVE',i.location='LISTED' WHERE a.public_id LIKE 'OL1AUC%' AND a.status='SOLD'");
            connection.commit();

            fixture.cleanup();
            connection.commit();
            assertThat(fixture.state()).isEqualTo(OperationsListingSeedFixture.State.EMPTY);
        }
    }

    @Test
    void 부분_적재와_가용_잔액_부족을_거부한다() throws Exception {
        migrate();
        try (Connection connection = connection()) {
            prepareUsers(connection, false);
            execute(connection, "UPDATE user_balance ub JOIN user u ON u.id=ub.user_id "
                + "SET ub.game_money_balance=0,ub.game_money_held=0 "
                + "WHERE u.login_id REGEXP '^test(0[1-9]|1[0-9]|20)$'");
            connection.commit();
            OperationsListingSeedFixture insufficient = new OperationsListingSeedFixture(connection);
            assertThatThrownBy(insufficient::dryRun).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("안전하게 배정");

            execute(connection, "INSERT INTO item_instance(public_id,template_id,owner_id,level,skill1_id,skill2_id,"
                + "skill_percent,gf_expire_at,location,slot_no,created_at,updated_at) SELECT "
                + "'OL1ITM0000000000000000001',t.id,u.id,1,NULL,NULL,0,NULL,'LISTED',NULL,NOW(6),NOW(6) "
                + "FROM item_template t JOIN user u ON u.login_id='test01' LIMIT 1");
            connection.commit();
            assertThat(new OperationsListingSeedFixture(connection).state())
                .isEqualTo(OperationsListingSeedFixture.State.PARTIAL);
            assertThatThrownBy(() -> new OperationsListingSeedFixture(connection).dryRun())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("부분 적재");
        }
    }

    private void migrate() {
        Flyway flyway = Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .cleanDisabled(false).load();
        flyway.clean();
        flyway.migrate();
    }

    private Connection connection() throws Exception {
        Connection connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
            MYSQL.getPassword());
        connection.setAutoCommit(false);
        return connection;
    }

    private void insertCompetingBid() throws Exception {
        try (Connection competing = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
            MYSQL.getPassword())) {
            execute(competing, "SET SESSION innodb_lock_wait_timeout=1");
            execute(competing, "INSERT INTO bid(public_id,auction_id,bidder_id,amount,status,created_at,updated_at) "
                + "SELECT 'RACEBID000000000000000001',a.id,u.id,a.start_price+1,'OUTBID',NOW(6),NOW(6) "
                + "FROM auction a JOIN user u ON u.login_id='test20' WHERE a.public_id LIKE 'OL1AUC%' LIMIT 1");
        }
    }

    private void prepareUsers(Connection connection, boolean rich) throws Exception {
        OperationsSeedFixture base = new OperationsSeedFixture(connection, "ops-20-v2");
        base.apply(HASH);
        base.verify();
        if (rich) {
            execute(connection, "UPDATE user_balance ub JOIN user u ON u.id=ub.user_id "
                + "SET ub.game_money_balance=CASE WHEN u.login_id='test01' THEN ub.game_money_held ELSE 100000000 END "
                + "WHERE u.login_id REGEXP '^test(0[1-9]|1[0-9]|20)$'");
        }
        connection.commit();
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    private long count(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql); var rows = statement.executeQuery()) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private String skillSignature(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("SELECT SHA2(GROUP_CONCAT(CONCAT(public_id,"
            + "':',COALESCE(skill1_id,0),':',COALESCE(skill2_id,0),':',skill_percent) "
            + "ORDER BY public_id SEPARATOR '|'),256) FROM item_instance WHERE public_id LIKE 'OL1ITM%'");
            var rows = statement.executeQuery()) {
            rows.next();
            return rows.getString(1);
        }
    }

    private String excludedSignature(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("SELECT SHA2(GROUP_CONCAT(CONCAT(i.public_id,"
            + "':',COALESCE(i.skill1_id,0),':',COALESCE(i.skill2_id,0),':',i.skill_percent,':',"
            + "COALESCE(a.item_spec_snapshot,'')) ORDER BY i.public_id SEPARATOR '|'),256) FROM item_instance i "
            + "LEFT JOIN auction a ON a.item_instance_id=i.id LEFT JOIN shop s ON s.item_instance_id=i.id "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND NOT EXISTS (SELECT 1 FROM auction active_a "
            + "WHERE active_a.item_instance_id=i.id AND active_a.status='ACTIVE') AND NOT EXISTS "
            + "(SELECT 1 FROM shop active_s WHERE active_s.item_instance_id=i.id AND active_s.status='ACTIVE')");
            var rows = statement.executeQuery()) {
            rows.next();
            return rows.getString(1);
        }
    }

    private String activeItemPredicateForTest() {
        return "(EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id AND a.status='ACTIVE') "
            + "OR EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE'))";
    }
}
