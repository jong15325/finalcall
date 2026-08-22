package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.IntConsumer;
import java.util.function.Supplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatReport;
import com.finalcall.domain.chat.entity.ChatReportDailyQuota;
import com.finalcall.domain.chat.entity.ChatReportReason;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatOutboxRetentionCheckpointRepository;
import com.finalcall.domain.chat.repository.ChatReportDailyQuotaRepository;
import com.finalcall.domain.chat.repository.ChatReportRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.chat.repository.ChatUserBlockRepository;
import com.finalcall.domain.chat.service.ChatCommandService;
import com.finalcall.domain.chat.service.ChatDirectMessagePersistence;
import com.finalcall.domain.chat.service.ChatDirectMessageService;
import com.finalcall.domain.chat.service.ChatMessagePersistence;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 채팅 DB 코어 동시성 검증(FC-318). 실제 MySQL(Testcontainers)에서 room row lock, UK, FK 동작을 검증한다.
 * 각 서비스 호출은 자체 트랜잭션으로 커밋되며 테스트 메서드에는 롤백 트랜잭션을 두지 않는다.
 */
class ChatCommandServiceIntegrationTest extends IntegrationTest {

    private static final int CONCURRENT_SENDS = 20;

    @Autowired
    private ChatCommandService commandService;

    @Autowired
    private ChatDirectMessageService directMessageService;

    @Autowired
    private ChatRoomRepository roomRepository;

    @Autowired
    private ChatRoomMemberStateRepository memberStateRepository;

    @Autowired
    private ChatMessageRepository messageRepository;

    @Autowired
    private ChatUserBlockRepository blockRepository;

    @Autowired
    private ChatReportRepository reportRepository;

    @Autowired
    private ChatReportDailyQuotaRepository reportDailyQuotaRepository;

    @Autowired
    private ChatOutboxRetentionCheckpointRepository checkpointRepository;

    @Autowired
    private ChatEventOutboxRepository outboxRepository;

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
            .filter(user -> user.getLoginId() != null && user.getLoginId().startsWith("chat318_"))
            .toList());
        SecurityContextHolder.clearContext();
    }

    @Test
    void 쌍방_동시_방생성은_한방과_참여상태_두행으로_수렴한다() throws Exception {
        User alice = persistUser("room_a", "채팅방앨리스");
        User bob = persistUser("room_b", "채팅방밥");
        List<ChatDirectMessagePersistence> outcomes = Collections.synchronizedList(new ArrayList<>());

        List<Throwable> errors = runConcurrently(12, index -> {
            if (index % 2 == 0) {
                outcomes.add(callAs(alice, () -> directMessageService.send(
                    bob.getNickname(), UUID.randomUUID().toString(), "동시 첫 메시지 " + index)));
            } else {
                outcomes.add(callAs(bob, () -> directMessageService.send(
                    alice.getNickname(), UUID.randomUUID().toString(), "동시 첫 메시지 " + index)));
            }
        });

        assertThat(errors).isEmpty();
        assertThat(outcomes).hasSize(12);
        assertThat(outcomes.stream().filter(ChatDirectMessagePersistence::roomCreated)).hasSize(1);
        assertThat(roomRepository.count()).isEqualTo(1);
        ChatRoom room = roomRepository.findAll().getFirst();
        assertThat(memberStateRepository.findByRoomIdOrderByUserIdAsc(room.getId()))
            .extracting(state -> state.getUserId())
            .containsExactly(alice.getId(), bob.getId());
    }

    @Test
    void 같은방_동시전송은_순번이_일에서_N까지_중복없이_연속이다() throws Exception {
        User alice = persistUser("seq_a", "순번앨리스");
        User bob = persistUser("seq_b", "순번밥");
        ChatRoom room = createRoom(alice, bob);

        List<Throwable> errors = runConcurrently(CONCURRENT_SENDS, index -> {
            User sender = index % 2 == 0 ? alice : bob;
            runAs(sender, () -> commandService.sendMessage(
                room.getPublicId(), UUID.randomUUID().toString(), "동시 메시지 " + index));
        });

        assertThat(errors).isEmpty();
        List<ChatMessage> messages = messageRepository.findByRoomIdOrderByRoomSequenceAsc(room.getId());
        assertThat(messages).hasSize(CONCURRENT_SENDS);
        assertThat(messages).extracting(ChatMessage::getRoomSequence)
            .containsExactlyElementsOf(sequenceRange(CONCURRENT_SENDS));
        assertThat(messages).extracting(ChatMessage::getBody)
            .containsExactlyInAnyOrderElementsOf(messageBodies(CONCURRENT_SENDS));
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getLastSequence())
            .isEqualTo(CONCURRENT_SENDS);
        assertThat(outboxRepository.findAll()).hasSize(CONCURRENT_SENDS * 2);
    }

    @Test
    void 서로다른방_병렬전송은_전역순번없이_각방에서만_연속이다() throws Exception {
        int roomCount = 8;
        int sendsPerRoom = 5;
        List<User> senders = new ArrayList<>();
        List<ChatRoom> rooms = new ArrayList<>();
        for (int roomIndex = 0; roomIndex < roomCount; roomIndex++) {
            User sender = persistUser("parallel_sender_" + roomIndex, "병렬발신" + roomIndex);
            User recipient = persistUser("parallel_recipient_" + roomIndex, "병렬수신" + roomIndex);
            senders.add(sender);
            rooms.add(createRoom(sender, recipient));
        }

        List<Throwable> errors = runConcurrently(roomCount * sendsPerRoom, index -> {
            int roomIndex = index % roomCount;
            runAs(senders.get(roomIndex), () -> commandService.sendMessage(
                rooms.get(roomIndex).getPublicId(), UUID.randomUUID().toString(), "병렬 메시지 " + index));
        });

        assertThat(errors).isEmpty();
        for (ChatRoom room : rooms) {
            assertThat(messageRepository.findByRoomIdOrderByRoomSequenceAsc(room.getId()))
                .extracting(ChatMessage::getRoomSequence)
                .containsExactlyElementsOf(sequenceRange(sendsPerRoom));
        }
        assertThat(messageRepository.count()).isEqualTo(roomCount * sendsPerRoom);
        assertThat(outboxRepository.count()).isEqualTo(roomCount * sendsPerRoom * 2L);
    }

    @Test
    void 같은_clientMessageId_동시재시도는_한행과_동일응답으로_수렴한다() throws Exception {
        User alice = persistUser("idem_a", "멱등앨리스");
        User bob = persistUser("idem_b", "멱등밥");
        ChatRoom room = createRoom(alice, bob);
        String clientMessageId = UUID.randomUUID().toString();
        List<ChatMessagePersistence> outcomes = new CopyOnWriteArrayList<>();

        List<Throwable> errors = runConcurrently(12, index -> outcomes.add(callAs(alice,
            () -> commandService.sendMessage(room.getPublicId(), clientMessageId, "멱등 본문"))));

        assertThat(errors).isEmpty();
        assertThat(outcomes).hasSize(12);
        assertThat(outcomes.stream().filter(outcome -> !outcome.deduplicated())).hasSize(1);
        assertThat(outcomes.stream().map(outcome -> outcome.message().getPublicId()).distinct()).hasSize(1);
        assertThat(outcomes).allSatisfy(outcome -> assertThat(outcome.senderPublicId()).isEqualTo(alice.getPublicId()));
        assertThat(messageRepository.countByRoomId(room.getId())).isEqualTo(1);
        assertThat(outboxRepository.findAll()).hasSize(2)
            .allSatisfy(event -> {
                assertThat(event.getPayload()).doesNotContain("멱등 본문");
                assertThat(event.getPayload()).doesNotContain(alice.getNickname());
            });

        runAs(bob, () -> commandService.block(room.getPublicId()));
        ChatMessagePersistence retry = callAs(alice,
            () -> commandService.sendMessage(room.getPublicId(), clientMessageId, "멱등 본문"));
        assertThat(retry.deduplicated()).isTrue();
        assertThat(retry.senderPublicId()).isEqualTo(alice.getPublicId());
        assertThatThrownBy(() -> callAs(alice,
            () -> commandService.sendMessage(room.getPublicId(), clientMessageId, "다른 본문")))
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode().getCode()).isEqualTo("CHAT_004"));
    }

    @Test
    void 어느방향의_차단이든_양쪽_신규전송을_막고_send와_block은_선형화된다() throws Exception {
        User alice = persistUser("block_a", "차단앨리스");
        User bob = persistUser("block_b", "차단밥");
        ChatRoom room = createRoom(alice, bob);
        List<String> sendCodes = new CopyOnWriteArrayList<>();

        List<Throwable> errors = runConcurrently(2, index -> {
            if (index == 0) {
                runAs(alice, () -> commandService.block(room.getPublicId()));
                return;
            }
            try {
                runAs(bob, () -> commandService.sendMessage(
                    room.getPublicId(), UUID.randomUUID().toString(), "차단 경합 메시지"));
                sendCodes.add("SUCCESS");
            } catch (BusinessException ex) {
                sendCodes.add(ex.getErrorCode().getCode());
            }
        });

        assertThat(errors).isEmpty();
        assertThat(sendCodes).singleElement().isIn("SUCCESS", "CHAT_005");
        assertThat(blockRepository.count()).isEqualTo(1);
        assertChatUnavailable(alice, room);
        assertChatUnavailable(bob, room);

        runAs(alice, () -> commandService.unblock(room.getPublicId()));
        runAs(bob, () -> commandService.block(room.getPublicId()));
        assertThat(blockRepository.count()).isEqualTo(1);
        assertChatUnavailable(alice, room);
        assertChatUnavailable(bob, room);
    }

    @Test
    void 읽음_위치의_중복_역순_동시갱신은_최댓값으로만_전진한다() throws Exception {
        User alice = persistUser("read_a", "읽음앨리스");
        User bob = persistUser("read_b", "읽음밥");
        ChatRoom room = createRoom(alice, bob);
        for (int sequence = 1; sequence <= 12; sequence++) {
            runAs(bob, () -> commandService.sendMessage(
                room.getPublicId(), UUID.randomUUID().toString(), "읽음 대상"));
        }

        List<Throwable> errors = runConcurrently(24,
            index -> runAs(alice, () -> commandService.updateRead(room.getPublicId(), index % 13)));

        assertThat(errors).isEmpty();
        assertThat(memberStateRepository.findByRoomIdAndUserId(room.getId(), alice.getId()).orElseThrow()
            .getLastReadSequence()).isEqualTo(12);
        assertThatThrownBy(() -> callAs(alice, () -> commandService.updateRead(room.getPublicId(), 13)))
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode().getCode()).isEqualTo("CHAT_006"));
    }

    @Test
    void 신고는_중복을_한행으로_막고_원메시지_purge뒤에도_snapshot을_보존한다() throws Exception {
        User alice = persistUser("report_a", "신고앨리스");
        User bob = persistUser("report_b", "신고밥");
        ChatRoom room = createRoom(alice, bob);
        ChatMessage message = callAs(bob, () -> commandService.sendMessage(
            room.getPublicId(), UUID.randomUUID().toString(), "보존할 신고 증거")).message();
        List<ChatReport> reports = new CopyOnWriteArrayList<>();
        List<String> duplicateCodes = new CopyOnWriteArrayList<>();

        List<Throwable> errors = runConcurrently(8, index -> {
            try {
                reports.add(callAs(alice, () -> commandService.report(
                    room.getPublicId(), message.getPublicId(), ChatReportReason.FRAUD, "신고 상세")));
            } catch (BusinessException ex) {
                duplicateCodes.add(ex.getErrorCode().getCode());
            }
        });

        assertThat(errors).isEmpty();
        assertThat(reports).hasSize(1);
        assertThat(duplicateCodes).hasSize(7).containsOnly("CHAT_008");
        ChatReport saved = reportRepository.findById(reports.getFirst().getId()).orElseThrow();
        assertThat(saved.getMessageBodySnapshot()).isEqualTo("보존할 신고 증거");
        assertThat(saved.getSenderNicknameSnapshot()).isEqualTo(bob.getNickname());
        assertThat(saved.getMessagePublicId()).isEqualTo(message.getPublicId());

        jdbcTemplate.update("DELETE FROM chat_message WHERE id = ?", message.getId());

        ChatReport afterPurge = reportRepository.findById(saved.getId()).orElseThrow();
        assertThat(afterPurge.getMessageId()).isNull();
        assertThat(afterPurge.getMessageBodySnapshot()).isEqualTo("보존할 신고 증거");
        assertThat(afterPurge.getSenderNicknameSnapshot()).isEqualTo(bob.getNickname());
        assertThat(afterPurge.getMessagePublicId()).isEqualTo(message.getPublicId());
    }

    @Test
    void 서로다른방_스물네개_병렬신고도_DB가_UTC일일_열건만_허용한다() throws Exception {
        int concurrentReports = 24;
        User reporter = persistUser("quota_reporter", "한도신고자");
        List<ChatRoom> rooms = new ArrayList<>();
        List<ChatMessage> messages = new ArrayList<>();
        for (int index = 0; index < concurrentReports; index++) {
            User counterpart = persistUser("quota_target_" + index, "한도상대" + index);
            ChatRoom room = createRoom(reporter, counterpart);
            rooms.add(room);
            messages.add(callAs(counterpart, () -> commandService.sendMessage(
                room.getPublicId(), UUID.randomUUID().toString(), "병렬 신고 대상")).message());
        }

        List<ChatReport> successes = new CopyOnWriteArrayList<>();
        List<String> rejectedCodes = new CopyOnWriteArrayList<>();
        List<Throwable> errors = runConcurrently(concurrentReports, index -> {
            try {
                successes.add(callAs(reporter, () -> commandService.report(
                    rooms.get(index).getPublicId(), messages.get(index).getPublicId(),
                    ChatReportReason.FRAUD, null)));
            } catch (BusinessException ex) {
                rejectedCodes.add(ex.getErrorCode().getCode());
            }
        });

        assertThat(errors).isEmpty();
        assertThat(successes).hasSize(10);
        assertThat(rejectedCodes).hasSize(14).containsOnly("CHAT_009");
        assertThat(reportRepository.count()).isEqualTo(10L);
        assertThat(reportDailyQuotaRepository.findAll())
            .singleElement()
            .extracting(ChatReportDailyQuota::getReportCount)
            .isEqualTo(10);
    }

    @Test
    void V25는_계약의_UK와_보조인덱스를_그대로_생성한다() {
        assertIndex("chat_room", "uk_chat_room_members", true, "member_low_id", "member_high_id");
        assertIndex("chat_room", "ix_chat_room_low_activity", false,
            "member_low_id", "last_activity_at", "id");
        assertIndex("chat_room", "ix_chat_room_high_activity", false,
            "member_high_id", "last_activity_at", "id");
        assertIndex("chat_room_member_state", "uk_chat_room_member_state", true, "room_id", "user_id");
        assertIndex("chat_room_member_state", "ix_chat_room_member_state_user", false,
            "user_id", "archived_at", "room_id");
        assertIndex("chat_message", "uk_chat_message_room_sequence", true, "room_id", "room_sequence");
        assertIndex("chat_message", "uk_chat_message_client", true,
            "room_id", "sender_id", "client_message_id");
        assertIndex("chat_user_block", "uk_chat_user_block", true, "blocker_id", "blocked_id");
        assertIndex("chat_report", "uk_chat_report_message", true, "reporter_id", "message_public_id");
        assertIndex("chat_event_outbox", "ix_chat_event_outbox_occurred", false, "occurred_at", "id");
        assertIndex("chat_message", "ix_chat_message_retention", false, "created_at", "id");
        assertIndex("chat_report", "ix_chat_report_retention", false, "created_at", "id");
        assertIndex("chat_report_daily_quota", "uk_chat_report_daily_quota", true,
            "reporter_id", "quota_date");
    }

    private void assertChatUnavailable(User sender, ChatRoom room) {
        assertThatThrownBy(() -> callAs(sender, () -> commandService.sendMessage(
            room.getPublicId(), UUID.randomUUID().toString(), "차단 뒤 메시지")))
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode().getCode()).isEqualTo("CHAT_005"));
    }

    private void assertIndex(String table, String index, boolean unique, String... expectedColumns) {
        List<String> columns = jdbcTemplate.query(
            "SELECT column_name FROM information_schema.statistics "
                + "WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? "
                + "ORDER BY seq_in_index",
            (row, rowNumber) -> row.getString("column_name"), table, index);
        Integer nonUnique = jdbcTemplate.queryForObject(
            "SELECT MIN(non_unique) FROM information_schema.statistics "
                + "WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
            Integer.class, table, index);

        assertThat(columns).containsExactly(expectedColumns);
        assertThat(nonUnique).isEqualTo(unique ? 0 : 1);
    }

    private ChatRoom createRoom(User requester, User counterpart) {
        Long memberLowId = Math.min(requester.getId(), counterpart.getId());
        Long memberHighId = Math.max(requester.getId(), counterpart.getId());
        ChatRoom room = roomRepository.save(ChatRoom.builder()
            .memberLowId(memberLowId)
            .memberHighId(memberHighId)
            .lastActivityAt(java.time.Instant.now())
            .build());
        memberStateRepository.saveAll(List.of(
            com.finalcall.domain.chat.entity.ChatRoomMemberState.builder()
                .roomId(room.getId()).userId(memberLowId).build(),
            com.finalcall.domain.chat.entity.ChatRoomMemberState.builder()
                .roomId(room.getId()).userId(memberHighId).build()));
        return room;
    }

    private User persistUser(String suffix, String nickname) {
        return userRepository.save(User.builder()
            .loginId("chat318_" + suffix)
            .passwordHash("hash")
            .nickname(nickname)
            .build());
    }

    private <T> T callAs(User user, Supplier<T> action) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
            new UsernamePasswordAuthenticationToken(String.valueOf(user.getId()), null, List.of()));
        SecurityContextHolder.setContext(context);
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void runAs(User user, Runnable action) {
        callAs(user, () -> {
            action.run();
            return null;
        });
    }

    private List<Throwable> runConcurrently(int count, IntConsumer operation) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(count);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(count);
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());
        try {
            for (int index = 0; index < count; index++) {
                int taskIndex = index;
                pool.submit(() -> {
                    try {
                        start.await();
                        operation.accept(taskIndex);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } catch (Throwable throwable) {
                        errors.add(throwable);
                    } finally {
                        done.countDown();
                    }
                });
            }
            start.countDown();
            assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
        return errors;
    }

    private List<Long> sequenceRange(int count) {
        List<Long> sequences = new ArrayList<>();
        for (long sequence = 1; sequence <= count; sequence++) {
            sequences.add(sequence);
        }
        return sequences;
    }

    private List<String> messageBodies(int count) {
        List<String> bodies = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            bodies.add("동시 메시지 " + index);
        }
        return bodies;
    }
}
