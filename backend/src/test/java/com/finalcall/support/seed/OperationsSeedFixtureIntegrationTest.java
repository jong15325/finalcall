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
class OperationsSeedFixtureIntegrationTest {
    private static final String HASH = "$2a$12$4xkT5Dg5cUvAh6bJWjryhO2E0AKu/jJ0nxMsmHH6.fvF5To8K5pKi";

    @Container
    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");

    @Test
    void 적용_재실행_외부참조차단_정리를검증한다() throws Exception {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate();
        try (Connection connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(),
            MYSQL.getPassword())) {
            connection.setAutoCommit(false);
            OperationsSeedFixture fixture = new OperationsSeedFixture(connection);
            assertThat(fixture.state()).isEqualTo(OperationsSeedFixture.State.EMPTY);
            fixture.dryRun();
            fixture.apply(HASH);
            fixture.verify();
            connection.commit();

            OperationsSeedFixture existing = new OperationsSeedFixture(connection);
            assertThat(existing.state()).isEqualTo(OperationsSeedFixture.State.COMPLETE);
            existing.verify();
            OperationsSeedFixture blockedVersion2 = new OperationsSeedFixture(connection, "ops-20-v2");
            assertThatThrownBy(blockedVersion2::state).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            assertThatThrownBy(() -> blockedVersion2.apply(HASH)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            execute(connection, "DELETE FROM user_memo WHERE public_id LIKE 'OPSMEM%' LIMIT 1");
            assertThat(new OperationsSeedFixture(connection).state()).isEqualTo(OperationsSeedFixture.State.PARTIAL);
            assertThatThrownBy(blockedVersion2::dryRun).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            connection.rollback();
            assertInvariantViolation(connection, existing,
                "UPDATE auction SET highest_bid_amount=highest_bid_amount+1 "
                    + "WHERE public_id LIKE 'OPSAUC%' AND status='ACTIVE' LIMIT 1");
            assertInvariantViolation(connection, existing,
                "UPDATE platform_revenue_ledger SET amount=amount+1 WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'OPSORD%') LIMIT 1");
            assertInvariantViolation(connection, existing,
                "UPDATE item_instance SET slot_no=NULL WHERE public_id LIKE 'OPSITM%' "
                    + "AND location='INVENTORY' LIMIT 1");
            assertInvariantViolation(connection, existing,
                "UPDATE item_delivery SET claim_token='invalid' WHERE public_id LIKE 'OPSDLV%' "
                    + "AND status='PENDING' LIMIT 1");

            insertExternalReferences(connection);
            connection.commit();
            assertThatThrownBy(existing::dryRun).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/대화 참조");
            assertThatThrownBy(existing::cleanup).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/대화 참조");
            connection.rollback();
            deleteExternalReferences(connection);
            connection.commit();

            insertClosingDerivedOrder(connection, true);
            OperationsSeedFixture unsafeClosingCleanup = new OperationsSeedFixture(connection);
            assertThatThrownBy(unsafeClosingCleanup::cleanup).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("외부 거래/대화 참조");
            connection.rollback();

            assertDerivedChildRejected(connection,
                "UPDATE item_delivery SET recipient_user_id=(SELECT id FROM user WHERE public_id LIKE 'EXTCHK%') "
                    + "WHERE public_id LIKE 'SYSDEL%'");
            assertDerivedChildRejected(connection,
                "UPDATE item_delivery SET item_instance_id="
                    + "(SELECT id FROM item_instance WHERE public_id LIKE 'EXTITM%') "
                    + "WHERE public_id LIKE 'SYSDEL%'");
            assertDerivedChildRejected(connection,
                "UPDATE item_ownership_history SET from_owner_id=(SELECT id FROM user WHERE public_id LIKE 'EXTCHK%') "
                    + "WHERE sale_order_id IN (SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "UPDATE item_ownership_history SET to_owner_id=(SELECT id FROM user WHERE public_id LIKE 'EXTCHK%') "
                    + "WHERE sale_order_id IN (SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "UPDATE item_ownership_history SET instance_id=(SELECT id FROM item_instance WHERE public_id "
                    + "LIKE 'EXTITM%') WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "UPDATE platform_revenue_ledger SET amount=amount+1 WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "UPDATE platform_revenue_ledger SET fee_policy_version='v9.9' WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "DELETE FROM item_delivery WHERE public_id LIKE 'SYSDEL%'");
            assertDerivedChildRejected(connection,
                "DELETE FROM platform_revenue_ledger WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "DELETE FROM item_ownership_history WHERE sale_order_id IN "
                    + "(SELECT id FROM sale_order WHERE public_id LIKE 'SYSORD%')");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET status='PENDING' WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET fee_policy_version='v9.9' WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET buyer_id=seller_id WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET settle_amount=settle_amount-1 WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET fee_amount=fee_amount+1,settle_amount=settle_amount-1 "
                    + "WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE sale_order SET final_price=final_price+1,settle_amount=settle_amount+1 "
                    + "WHERE public_id LIKE 'SYSORD%'");
            assertDerivedChildRejected(connection,
                "UPDATE bid SET amount=amount+1 WHERE status='WON' AND auction_id IN "
                    + "(SELECT source_id FROM sale_order WHERE public_id LIKE 'SYSORD%')");

            insertClosingDerivedOrder(connection, false);
            assertThat(count(connection, "SELECT COUNT(*) FROM sale_order WHERE public_id LIKE 'SYSORD%'"))
                .isEqualTo(1);
            OperationsSeedFixture cleanup = new OperationsSeedFixture(connection);
            cleanup.cleanup();
            connection.commit();
            assertThat(new OperationsSeedFixture(connection).state()).isEqualTo(OperationsSeedFixture.State.EMPTY);

            insertExternalTestPrefixUsers(connection);
            connection.commit();
            OperationsSeedFixture version2 = new OperationsSeedFixture(connection, "ops-20-v2");
            version2.dryRun();
            version2.apply(HASH);
            version2.verify();
            connection.commit();
            assertVersion2Counts(connection);
            OperationsSeedFixture version2Noop = new OperationsSeedFixture(connection, "ops-20-v2");
            assertThat(version2Noop.state()).isEqualTo(OperationsSeedFixture.State.COMPLETE);
            version2Noop.verify();
            version2Noop.cleanup();
            connection.commit();
            assertThat(new OperationsSeedFixture(connection, "ops-20-v2").state())
                .isEqualTo(OperationsSeedFixture.State.EMPTY);
            assertThat(
                count(connection, "SELECT COUNT(*) FROM user WHERE login_id IN ('tester','test-admin','test21')"))
                .isEqualTo(3);
            execute(connection, "DELETE FROM user WHERE login_id IN ('tester','test-admin','test21')");
            connection.commit();

            insertLegacyOutboxOnly(connection);
            connection.commit();
            OperationsSeedFixture outboxBlockedVersion2 = new OperationsSeedFixture(connection, "ops-20-v2");
            assertThatThrownBy(outboxBlockedVersion2::state).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            assertThatThrownBy(outboxBlockedVersion2::dryRun).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            assertThatThrownBy(() -> outboxBlockedVersion2.apply(HASH)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("v1 cleanup 선행 필요");
            OperationsSeedFixture legacyOutboxCleanup = new OperationsSeedFixture(connection);
            assertThat(legacyOutboxCleanup.state()).isEqualTo(OperationsSeedFixture.State.PARTIAL);
            legacyOutboxCleanup.requireComplete(OperationsSeedFixture.State.PARTIAL);
            legacyOutboxCleanup.cleanup();
            connection.commit();
            OperationsSeedFixture allowedVersion2 = new OperationsSeedFixture(connection, "ops-20-v2");
            assertThat(allowedVersion2.state()).isEqualTo(OperationsSeedFixture.State.EMPTY);
            allowedVersion2.dryRun();
        }
    }

    private void assertDerivedChildRejected(Connection connection, String corruptionSql) throws Exception {
        insertClosingDerivedOrder(connection, false);
        insertExternalClosingArtifacts(connection);
        execute(connection, corruptionSql);
        OperationsSeedFixture cleanup = new OperationsSeedFixture(connection);
        assertThatThrownBy(cleanup::cleanup).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("파생 주문 자식 정합성 위반");
        connection.rollback();
    }

    private void insertExternalClosingArtifacts(Connection connection) throws Exception {
        execute(connection, "INSERT INTO user(public_id,login_id,password_hash,nickname,primary_character_id,email,"
            + "email_verified,is_admin,is_deleted,deleted_at,created_at,updated_at) VALUES("
            + "'EXTCHK00000000000000000001','external-check',NULL,'외부검증',1,"
            + "'external-check@example.invalid',1,0,0,NULL,NOW(6),NOW(6))");
        execute(connection, "INSERT INTO item_instance(public_id,template_id,owner_id,level,skill1_id,skill2_id,"
            + "skill_percent,gf_expire_at,location,slot_no,created_at,updated_at) SELECT "
            + "'EXTITM00000000000000000001',t.id,u.id,1,NULL,NULL,0,NULL,'INVENTORY',0,NOW(6),NOW(6) "
            + "FROM item_template t JOIN user u ON u.public_id='EXTCHK00000000000000000001' LIMIT 1");
    }

    private void insertClosingDerivedOrder(Connection connection, boolean externalBuyer) throws Exception {
        if (externalBuyer) {
            execute(connection, "INSERT INTO user(public_id,login_id,password_hash,nickname,primary_character_id,email,"
                + "email_verified,is_admin,is_deleted,deleted_at,created_at,updated_at) VALUES("
                + "'EXTBUY00000000000000000001','outside-buyer',NULL,'외부구매자',1,"
                + "'outside-buyer@example.invalid',1,0,0,NULL,NOW(6),NOW(6))");
        }
        execute(connection, "UPDATE auction a JOIN bid b ON b.auction_id=a.id AND b.status='ACTIVE' "
            + "SET a.status='SOLD',a.result_type='BID',b.status='WON',a.highest_bid_amount=b.amount,"
            + "a.highest_bidder_id=b.bidder_id WHERE a.public_id='OPSAUC00000000000000000005'");
        execute(connection, "UPDATE item_instance i JOIN auction a ON a.item_instance_id=i.id "
            + "SET i.owner_id=a.highest_bidder_id WHERE a.public_id='OPSAUC00000000000000000005'");
        String buyerColumn = externalBuyer ? "b.id" : "w.bidder_id";
        String buyerJoin = externalBuyer
            ? "JOIN user b ON b.public_id='EXTBUY00000000000000000001' "
            : "";
        execute(connection, "INSERT INTO sale_order(public_id,source_type,source_id,buyer_id,seller_id,"
            + "item_instance_id,final_price,fee_amount,settle_amount,fee_policy_version,status,settled_at,created_at) "
            + "SELECT 'SYSORD00000000000000000001','AUCTION',a.id," + buyerColumn
            + ",a.seller_id,a.item_instance_id,w.amount,"
            + "LEAST(w.amount,GREATEST(100,LEAST(300000,(LEAST(w.amount,100000)*6+"
            + "GREATEST(0,LEAST(w.amount-100000,900000))*5+"
            + "GREATEST(0,LEAST(w.amount-1000000,2000000))*4+"
            + "GREATEST(0,w.amount-3000000)*3+50) DIV 100))),0,'v1.0','SETTLED',NOW(6),NOW(6) "
            + "FROM auction a JOIN bid w ON w.auction_id=a.id AND w.status='WON' " + buyerJoin
            + "WHERE a.public_id='OPSAUC00000000000000000005'");
        execute(connection, "UPDATE sale_order SET settle_amount=final_price-fee_amount "
            + "WHERE public_id LIKE 'SYSORD%'");
        execute(connection, "INSERT INTO platform_revenue_ledger(sale_order_id,amount,fee_policy_version,created_at) "
            + "SELECT id,fee_amount,fee_policy_version,NOW(6) FROM sale_order WHERE public_id LIKE 'SYSORD%'");
        execute(connection, "INSERT INTO item_ownership_history(instance_id,from_owner_id,to_owner_id,transfer_type,"
            + "sale_order_id,transferred_at,created_at) SELECT item_instance_id,seller_id,buyer_id,'TRADE',id,"
            + "NOW(6),NOW(6) FROM sale_order WHERE public_id LIKE 'SYSORD%'");
        execute(connection, "INSERT INTO item_delivery(public_id,sale_order_id,item_instance_id,recipient_user_id,"
            + "recipient_nickname,item_uuid,type_code,level,skill1_code,skill2_code,skill_percent,gf_expire_at,status,"
            + "claim_token,claimed_at,applied_at,created_at) SELECT 'SYSDEL00000000000000000001',o.id,i.id,o.buyer_id,"
            + "b.nickname,'11111111-1111-4111-8111-111111111111',t.type_code,i.level,s1.skill_code,s2.skill_code,"
            + "i.skill_percent,i.gf_expire_at,'PENDING',NULL,NULL,NULL,NOW(6) FROM sale_order o "
            + "JOIN item_instance i ON i.id=o.item_instance_id JOIN item_template t ON t.id=i.template_id "
            + "JOIN user b ON b.id=o.buyer_id LEFT JOIN skill_definition s1 ON s1.id=i.skill1_id "
            + "LEFT JOIN skill_definition s2 ON s2.id=i.skill2_id WHERE o.public_id LIKE 'SYSORD%'");
    }

    private void insertLegacyOutboxOnly(Connection connection) throws Exception {
        execute(connection, "INSERT INTO chat_event_outbox(event_id,aggregate_type,aggregate_id,event_type,"
            + "event_version,payload,occurred_at,created_at) VALUES('OPSEVT00000000000000000001','CHAT_ROOM',"
            + "'orphan-v1','MESSAGE_CREATED',1,JSON_OBJECT('orphan',true),NOW(6),NOW(6))");
    }

    private void insertExternalTestPrefixUsers(Connection connection) throws Exception {
        int number = 0;
        for (String loginId : new String[] {"tester", "test-admin", "test21"}) {
            number++;
            execute(connection, "INSERT INTO user(public_id,login_id,password_hash,nickname,primary_character_id,email,"
                + "email_verified,is_admin,is_deleted,deleted_at,created_at,updated_at) VALUES('EXTUSR"
                + String.format("%020d", number) + "','" + loginId + "',NULL,'외부계정" + number + "',1,'" + loginId
                + "@example.invalid',1,0,0,NULL,NOW(6),NOW(6))");
        }
    }

    private void assertVersion2Counts(Connection connection) throws Exception {
        assertThat(count(connection, "SELECT COUNT(*) FROM user WHERE public_id LIKE 'OP2USR%'")).isEqualTo(20);
        assertThat(count(connection, "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OP2ITM%'"))
            .isEqualTo(240);
        assertThat(count(connection, "SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OP2AUC%'"))
            .isEqualTo(56);
        assertThat(count(connection, "SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OP2BID%'"))
            .isEqualTo(200);
        assertThat(count(connection, "SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OP2SHP%'"))
            .isEqualTo(56);
        assertThat(count(connection, "SELECT COUNT(DISTINCT t.type_code) FROM shop s JOIN item_instance i "
            + "ON i.id=s.item_instance_id JOIN item_template t ON t.id=i.template_id "
            + "WHERE s.public_id LIKE 'OP2SHP%' AND s.status='ACTIVE'"))
            .isEqualTo(40);
    }

    private long count(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql); var rows = statement.executeQuery()) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private void insertExternalReferences(Connection connection) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO user_memo(public_id,sender_id,"
            + "sender_nickname,sender_level,sender_gender,receiver_id,receiver_nickname,memo_type,body,is_read,read_at,"
            + "is_deleted,deleted_at,created_at) SELECT 'EXTERNALMEMO00000000000001',id,nickname,1,0,id,nickname,5,"
            + "'외부 참조',0,NULL,0,NULL,NOW(6) FROM user WHERE login_id='fc_ops_01'")) {
            statement.executeUpdate();
        }
        execute(connection, "INSERT INTO user_social_account(user_id,provider,provider_user_id,created_at) "
            + "SELECT id,'NAVER','external-seed-reference',NOW(6) FROM user WHERE login_id='fc_ops_02'");
        execute(connection, "INSERT INTO bid(public_id,auction_id,bidder_id,amount,status,created_at,updated_at) "
            + "SELECT 'EXTERNALBID000000000000001',a.id,u.id,999999,'OUTBID',NOW(6),NOW(6) FROM auction a "
            + "JOIN user u ON u.login_id='fc_ops_03' WHERE a.public_id LIKE 'OPSAUC%' LIMIT 1");
        execute(connection, "INSERT INTO chat_message(public_id,room_id,room_sequence,sender_id,"
            + "sender_nickname_snapshot,client_message_id,body,created_at) SELECT 'EXTERNALMSG000000000000001',"
            + "r.id,r.last_sequence+1,u.id,u.nickname,'11111111-1111-4111-8111-111111111111','external',NOW(6) "
            + "FROM chat_room r JOIN user u ON u.id=r.member_low_id WHERE r.public_id LIKE 'OPSROM%' LIMIT 1");
        execute(connection, "INSERT INTO chat_user_block(blocker_id,blocked_id,created_at) SELECT b.id,a.id,NOW(6) "
            + "FROM user a JOIN user b ON a.login_id='fc_ops_04' AND b.login_id='fc_ops_14'");
    }

    private void deleteExternalReferences(Connection connection) throws Exception {
        execute(connection, "DELETE FROM user_memo WHERE public_id='EXTERNALMEMO00000000000001'");
        execute(connection, "DELETE FROM user_social_account WHERE provider_user_id='external-seed-reference'");
        execute(connection, "DELETE FROM bid WHERE public_id='EXTERNALBID000000000000001'");
        execute(connection, "DELETE FROM chat_message WHERE public_id='EXTERNALMSG000000000000001'");
        execute(connection, "DELETE b FROM chat_user_block b JOIN user a ON a.id=b.blocker_id JOIN user d "
            + "ON d.id=b.blocked_id WHERE a.login_id='fc_ops_14' AND d.login_id='fc_ops_04'");
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    private void assertInvariantViolation(Connection connection, OperationsSeedFixture fixture, String sql)
        throws Exception {
        execute(connection, sql);
        assertThatThrownBy(fixture::verify).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("시드 불변식 위반");
        connection.rollback();
    }
}
