package com.finalcall.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@TestPropertySource(properties = {
    "demo.seed.active-shops.enabled=true",
    "demo.seed.active-shops.target-per-seller=0"})
class LocalActiveShopSeederLockIntegrationTest extends IntegrationTest {

    private static final String LOCK_NAME = "finalcall:local-active-shop-seed";

    @Autowired
    private LocalActiveShopSeeder seeder;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void named_lock은_트랜잭션_완료까지_유지되고_commit_후_해제된다() {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        transaction.executeWithoutResult(status -> {
            assertThat(seeder.acquireLockUntilTransactionCompletion()).isTrue();
            assertThat(tryAcquireOnIndependentConnection()).isZero();
        });

        assertThat(tryAcquireOnIndependentConnection()).isOne();
        releaseOnIndependentConnection();
    }

    private int tryAcquireOnIndependentConnection() {
        return executeLockQuery("SELECT GET_LOCK('" + LOCK_NAME + "', 0)");
    }

    private void releaseOnIndependentConnection() {
        assertThat(executeLockQuery("SELECT RELEASE_LOCK('" + LOCK_NAME + "')")).isOne();
    }

    private int executeLockQuery(String sql) {
        try (Connection connection = dataSource.getConnection();
            Statement statement = connection.createStatement();
            ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getInt(1);
        } catch (SQLException ex) {
            throw new IllegalStateException("named lock 검증 쿼리 실패", ex);
        }
    }
}
