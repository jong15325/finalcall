package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import com.finalcall.common.util.Ulid;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatOutboxRetentionCheckpoint;
import com.finalcall.domain.chat.entity.ChatReport;
import com.finalcall.domain.chat.entity.ChatReportReason;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.entity.ChatRoomMemberState;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatOutboxRetentionCheckpointRepository;
import com.finalcall.domain.chat.repository.ChatReportDailyQuotaRepository;
import com.finalcall.domain.chat.repository.ChatReportRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.chat.repository.ChatUserBlockRepository;
import com.finalcall.domain.chat.service.ChatRetentionService;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/** 실제 MySQL에서 보존 소배치·read floor·신고 snapshot·CDC/binlog 안전 가드를 검증한다. */
@TestPropertySource(properties = "chat.retention.batch-size=2")
class ChatRetentionServiceIntegrationTest extends IntegrationTest {

    private static final Instant NOW = Instant.parse("2026-08-18T12:00:00Z");

    @Autowired
    private ChatRetentionService retentionService;

    @Autowired
    private ChatMessageRepository messageRepository;

    @Autowired
    private ChatRoomMemberStateRepository memberStateRepository;

    @Autowired
    private ChatReportRepository reportRepository;

    @Autowired
    private ChatReportDailyQuotaRepository reportDailyQuotaRepository;

    @Autowired
    private ChatEventOutboxRepository outboxRepository;

    @Autowired
    private ChatOutboxRetentionCheckpointRepository checkpointRepository;

    @Autowired
    private ChatUserBlockRepository blockRepository;

    @Autowired
    private ChatRoomRepository roomRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    @AfterEach
    void clean() {
        checkpointRepository.deleteAllInBatch();
        outboxRepository.deleteAllInBatch();
        reportRepository.deleteAllInBatch();
        reportDailyQuotaRepository.deleteAllInBatch();
        messageRepository.deleteAllInBatch();
        memberStateRepository.deleteAllInBatch();
        blockRepository.deleteAllInBatch();
        roomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch(userRepository.findAll().stream()
            .filter(user -> user.getLoginId() != null && user.getLoginId().startsWith("chat326_"))
            .toList());
    }

    @Test
    void 메시지는_백팔십일_초과분만_두건씩_지우며_삭제최대순번까지_read_floor를_전진한다() {
        User alice = persistUser("message_a", "보존앨리스");
        User bob = persistUser("message_b", "보존밥");
        ChatRoom room = persistRoom(alice, bob);
        ChatRoomMemberState aliceState = memberStateRepository.save(
            ChatRoomMemberState.builder().roomId(room.getId()).userId(alice.getId()).build());
        ChatRoomMemberState bobState = memberStateRepository.save(
            ChatRoomMemberState.builder().roomId(room.getId()).userId(bob.getId()).build());

        List<ChatMessage> messages = messageRepository.saveAll(List.of(
            message(room, bob, 1L, "오래된 메시지 1"),
            message(room, bob, 2L, "오래된 메시지 2"),
            message(room, bob, 3L, "오래된 메시지 3"),
            message(room, bob, 4L, "최근 메시지")));
        Instant oldCreatedAt = NOW.minus(Duration.ofDays(181L));
        for (int index = 0; index < 3; index++) {
            updateCreatedAt("chat_message", messages.get(index).getId(), oldCreatedAt);
        }
        updateCreatedAt("chat_message", messages.get(3).getId(), NOW.minus(Duration.ofDays(179L)));
        jdbcTemplate.update(
            "UPDATE chat_room_member_state SET last_read_sequence = 4 WHERE id = ?", bobState.getId());

        ChatReport snapshot = reportRepository.save(ChatReport.builder()
            .roomId(room.getId())
            .messageId(messages.getFirst().getId())
            .messagePublicId(messages.getFirst().getPublicId())
            .reporterId(alice.getId())
            .reportedUserId(bob.getId())
            .reason(ChatReportReason.FRAUD)
            .messageBodySnapshot(messages.getFirst().getBody())
            .senderNicknameSnapshot(bob.getNickname())
            .build());

        assertThat(retentionService.purgeMessageBatch(NOW)).isEqualTo(2);
        assertThat(messageRepository.findAll())
            .extracting(ChatMessage::getRoomSequence)
            .containsExactlyInAnyOrder(3L, 4L);
        assertThat(memberStateRepository.findById(aliceState.getId()).orElseThrow().getLastReadSequence())
            .isEqualTo(2L);
        assertThat(memberStateRepository.findById(bobState.getId()).orElseThrow().getLastReadSequence())
            .isEqualTo(4L);
        ChatReport afterFirstPurge = reportRepository.findById(snapshot.getId()).orElseThrow();
        assertThat(afterFirstPurge.getMessageId()).isNull();
        assertThat(afterFirstPurge.getMessageBodySnapshot()).isEqualTo("오래된 메시지 1");

        assertThat(retentionService.purgeMessageBatch(NOW)).isEqualTo(1);
        assertThat(messageRepository.findAll())
            .extracting(ChatMessage::getRoomSequence)
            .containsExactly(4L);
        assertThat(memberStateRepository.findById(aliceState.getId()).orElseThrow().getLastReadSequence())
            .isEqualTo(3L);
    }

    @Test
    void 신고_snapshot은_삼년을_지난_행만_물리삭제한다() {
        User alice = persistUser("report_a", "신고보존앨리스");
        User bob = persistUser("report_b", "신고보존밥");
        ChatRoom room = persistRoom(alice, bob);
        ChatReport expired = reportRepository.save(report(room, alice, bob, Ulid.generate()));
        ChatReport retained = reportRepository.save(report(room, alice, bob, Ulid.generate()));
        updateCreatedAt("chat_report", expired.getId(), NOW.minus(Duration.ofDays(1096L)));
        updateCreatedAt("chat_report", retained.getId(), NOW.minus(Duration.ofDays(1094L)));

        assertThat(retentionService.purgeReportBatch(NOW)).isEqualTo(1);
        assertThat(reportRepository.findById(expired.getId())).isEmpty();
        assertThat(reportRepository.findById(retained.getId())).isPresent();
    }

    @Test
    void outbox는_최신_CDC_checkpoint와_binlog여유를_확인하고_safe_id까지만_삭제한다() {
        ChatEventOutbox safeOld = outboxRepository.save(outbox(Ulid.generate(), NOW));
        ChatEventOutbox unsafeOld = outboxRepository.save(outbox(Ulid.generate(), NOW));
        ChatEventOutbox recent = outboxRepository.save(outbox(Ulid.generate(), NOW));
        Instant oldCreatedAt = NOW.minus(Duration.ofDays(8L));
        updateCreatedAt("chat_event_outbox", safeOld.getId(), oldCreatedAt);
        updateCreatedAt("chat_event_outbox", unsafeOld.getId(), oldCreatedAt);
        updateCreatedAt("chat_event_outbox", recent.getId(), NOW.minus(Duration.ofDays(6L)));

        assertThat(retentionService.purgeOutboxBatch(NOW)).isZero();
        assertThat(outboxRepository.count()).isEqualTo(3L);

        checkpointRepository.save(ChatOutboxRetentionCheckpoint.builder()
            .cdcSafeOutboxId(safeOld.getId())
            .cdcCheckedAt(NOW.minusSeconds(30L))
            .build());

        assertThat(retentionService.purgeOutboxBatch(NOW)).isEqualTo(1);
        assertThat(outboxRepository.findById(safeOld.getId())).isEmpty();
        assertThat(outboxRepository.findById(unsafeOld.getId())).isPresent();
        assertThat(outboxRepository.findById(recent.getId())).isPresent();
    }

    private ChatMessage message(ChatRoom room, User sender, long sequence, String body) {
        return ChatMessage.builder()
            .roomId(room.getId())
            .roomSequence(sequence)
            .senderId(sender.getId())
            .senderNicknameSnapshot(sender.getNickname())
            .clientMessageId(UUID.randomUUID().toString())
            .body(body)
            .build();
    }

    private ChatReport report(ChatRoom room, User reporter, User reported, String messagePublicId) {
        return ChatReport.builder()
            .roomId(room.getId())
            .messagePublicId(messagePublicId)
            .reporterId(reporter.getId())
            .reportedUserId(reported.getId())
            .reason(ChatReportReason.SPAM)
            .messageBodySnapshot("신고 증거")
            .senderNicknameSnapshot(reported.getNickname())
            .build();
    }

    private ChatEventOutbox outbox(String eventId, Instant occurredAt) {
        return ChatEventOutbox.builder()
            .eventId(eventId)
            .aggregateId(Ulid.generate())
            .eventType(ChatEventType.MESSAGE_CREATED)
            .payload("{\"eventId\":\"" + eventId + "\"}")
            .occurredAt(occurredAt)
            .build();
    }

    private ChatRoom persistRoom(User first, User second) {
        Long memberLowId = Math.min(first.getId(), second.getId());
        Long memberHighId = Math.max(first.getId(), second.getId());
        return roomRepository.save(ChatRoom.builder()
            .memberLowId(memberLowId)
            .memberHighId(memberHighId)
            .lastActivityAt(NOW)
            .build());
    }

    private User persistUser(String suffix, String nickname) {
        return userRepository.save(User.builder()
            .loginId("chat326_" + suffix)
            .passwordHash("hash")
            .nickname(nickname)
            .build());
    }

    private void updateCreatedAt(String table, Long id, Instant createdAt) {
        jdbcTemplate.update("UPDATE " + table + " SET created_at = ? WHERE id = ?", createdAt, id);
    }
}
