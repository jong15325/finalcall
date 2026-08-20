package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.finalcall.common.util.Ulid;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.support.IntegrationTest;

/** 실제 MySQL에서 V27 인덱스 공존과 retention 실행계획을 검증한다. */
class ChatOutboxRetentionIndexIntegrationTest extends IntegrationTest {

    private static final Instant NOW = Instant.parse("2026-08-19T00:00:00Z");

    @Autowired
    private ChatEventOutboxRepository outboxRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DataSource dataSource;

    @AfterEach
    void clean() {
        outboxRepository.deleteAllInBatch();
    }

    @Test
    void V27은_retention과_pipeline_인덱스를_함께_유지한다() {
        List<Map<String, Object>> indexes = jdbcTemplate.queryForList("""
            SHOW INDEX FROM chat_event_outbox
            WHERE Key_name IN ('ix_chat_event_outbox_occurred', 'ix_chat_event_outbox_retention')
            """);

        assertThat(indexes)
            .extracting(row -> row.get("Key_name"), row -> row.get("Seq_in_index"), row -> row.get("Column_name"))
            .containsExactlyInAnyOrder(
                tuple("ix_chat_event_outbox_occurred", 1L, "occurred_at"),
                tuple("ix_chat_event_outbox_occurred", 2L, "id"),
                tuple("ix_chat_event_outbox_retention", 1L, "created_at"),
                tuple("ix_chat_event_outbox_retention", 2L, "id"));
    }

    @Test
    void retention_쿼리는_created_at_id_인덱스로_cutoff_safeId_batch_경계를_탐색한다() {
        for (int index = 0; index < 20; index++) {
            ChatEventOutbox outbox = outboxRepository.save(outbox());
            jdbcTemplate.update("UPDATE chat_event_outbox SET created_at = ? WHERE id = ?",
                NOW.minus(Duration.ofDays(8L + index)), outbox.getId());
        }
        Long safeId = outboxRepository.findTopByOrderByOccurredAtDescIdDesc().orElseThrow().getId();

        String plan = jdbcTemplate.queryForObject("""
            EXPLAIN FORMAT=JSON
            SELECT id
            FROM chat_event_outbox
            WHERE created_at < ?
              AND id <= ?
            ORDER BY created_at, id
            LIMIT 2
            """, String.class, NOW.minus(Duration.ofDays(7L)), safeId);
        List<Long> selected = jdbcTemplate.queryForList("""
            SELECT id
            FROM chat_event_outbox
            WHERE created_at < ?
              AND id <= ?
            ORDER BY created_at, id
            LIMIT 2
            FOR UPDATE SKIP LOCKED
            """, Long.class, NOW.minus(Duration.ofDays(7L)), safeId);

        assertThat(plan)
            .contains("ix_chat_event_outbox_retention")
            .contains("\"using_filesort\": false")
            .doesNotContain("\"access_type\": \"ALL\"");
        assertThat(selected).hasSize(2).doesNotHaveDuplicates();
    }

    @Test
    void skipLocked는_동시에_실행된_retention_batch를_분리한다() throws SQLException {
        for (int index = 0; index < 4; index++) {
            ChatEventOutbox outbox = outboxRepository.save(outbox());
            jdbcTemplate.update("UPDATE chat_event_outbox SET created_at = ? WHERE id = ?",
                NOW.minus(Duration.ofDays(8L + index)), outbox.getId());
        }
        Long safeId = outboxRepository.findTopByOrderByOccurredAtDescIdDesc().orElseThrow().getId();
        Instant cutoff = NOW.minus(Duration.ofDays(7L));

        try (Connection firstNode = dataSource.getConnection();
            Connection secondNode = dataSource.getConnection()) {
            firstNode.setAutoCommit(false);
            secondNode.setAutoCommit(false);
            try {
                List<Long> firstBatch = selectRetentionBatch(firstNode, cutoff, safeId);
                List<Long> secondBatch = selectRetentionBatch(secondNode, cutoff, safeId);

                assertThat(firstBatch).hasSize(2);
                assertThat(secondBatch).hasSize(2);
                assertThat(firstBatch).doesNotContainAnyElementsOf(secondBatch);
            } finally {
                firstNode.rollback();
                secondNode.rollback();
            }
        }
    }

    private List<Long> selectRetentionBatch(Connection connection, Instant cutoff, Long safeId)
        throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
            SELECT id
            FROM chat_event_outbox
            WHERE created_at < ?
              AND id <= ?
            ORDER BY created_at, id
            LIMIT 2
            FOR UPDATE SKIP LOCKED
            """)) {
            statement.setObject(1, cutoff);
            statement.setLong(2, safeId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<Long> ids = new ArrayList<>();
                while (resultSet.next()) {
                    ids.add(resultSet.getLong("id"));
                }
                return ids;
            }
        }
    }

    private ChatEventOutbox outbox() {
        String eventId = Ulid.generate();
        return ChatEventOutbox.builder()
            .eventId(eventId)
            .aggregateId(Ulid.generate())
            .eventType(ChatEventType.MESSAGE_CREATED)
            .payload("{\"eventId\":\"" + eventId + "\"}")
            .occurredAt(NOW)
            .build();
    }
}
