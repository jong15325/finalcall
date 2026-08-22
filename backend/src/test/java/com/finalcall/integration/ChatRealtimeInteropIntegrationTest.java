package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Type;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.finalcall.FinalcallApplication;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.listener.ChatKafkaOutboxListener;
import com.finalcall.domain.chat.realtime.ChatRedisFanoutPublisher;
import com.finalcall.domain.chat.realtime.ChatWebSocketSessionRegistry;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatReportRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.chat.repository.ChatUserBlockRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.config.JwtProperties;
import com.finalcall.support.TestcontainersConfiguration;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** 실제 HTTP/WebSocket과 공유 MySQL/Redis를 이용한 채팅 노드 간 상호운용·장애 복구 검증. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
    "gateway.internal.enforced=false", "closing.worker.enabled=false", "shop.expiry.worker.enabled=false",
    "delivery.worker.enabled=false", "demo.seed.enabled=false", "search.reconciliation.enabled=false",
    "search.reindex-on-startup=false", "management.health.elasticsearch.enabled=false",
    "board.image.storage.ensure-bucket-on-startup=false", "chat.kafka.consumer.enabled=false",
    "spring.data.redis.timeout=500ms", "spring.data.redis.connect-timeout=500ms"})
class ChatRealtimeInteropIntegrationTest {

    private static final String ORIGIN = "http://localhost:5173";
    private static final Duration EVENT_TIMEOUT = Duration.ofSeconds(10L);

    @LocalServerPort
    private int firstNodePort;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

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
    private ChatEventOutboxRepository outboxRepository;

    @Autowired
    private ChatKafkaOutboxListener kafkaOutboxListener;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private MySQLContainer<?> mysqlContainer;

    @Autowired
    @Qualifier("redisContainer")
    private GenericContainer<?> redisContainer;

    private final List<StompConnection> stompConnections = new ArrayList<>();
    private ConfigurableApplicationContext secondNode;

    @BeforeEach
    @AfterEach
    void clean() {
        closeClients();
        if (secondNode != null) {
            secondNode.close();
            secondNode = null;
        }
        ensureRedisRunning();
        outboxRepository.deleteAllInBatch();
        reportRepository.deleteAllInBatch();
        messageRepository.deleteAllInBatch();
        memberStateRepository.deleteAllInBatch();
        blockRepository.deleteAllInBatch();
        roomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch(userRepository.findAll().stream()
            .filter(user -> user.getLoginId() != null && user.getLoginId().startsWith("chat323_"))
            .toList());
        redisConnectionFactory.getConnection().serverCommands().flushDb();
    }

    @Test
    void 다른_node의_JWT_user_destination으로_커밋_event를_전달하고_재접속_replay한다() throws Exception {
        int secondNodePort = startSecondNode();
        User alice = persistUser("multinode_alice", "멀티노드앨리스");
        User bob = persistUser("multinode_bob", "멀티노드밥");
        String aliceToken = token(alice);
        String bobToken = token(bob);
        BlockingQueue<JsonNode> secondNodeEvents = new LinkedBlockingQueue<>();
        StompConnection bobOnSecondNode = connectStomp(secondNodePort, bobToken, secondNodeEvents);
        assertThat(secondNode.getBean(ChatWebSocketSessionRegistry.class).localRecipients(List.of(bob.getId())))
            .containsExactly(bob.getId());
        assertThat(secondNode.getBean(SimpUserRegistry.class).getUser(String.valueOf(bob.getId())))
            .isNotNull();

        String clientMessageId = UUID.randomUUID().toString();
        ResponseEntity<JsonNode> createdMessage = post(firstNodePort, "/api/v1/me/chat-rooms/direct/messages",
            Map.of("counterpartNickname", bob.getNickname(), "clientMessageId", clientMessageId,
                "body", "노드 간 전달"),
            aliceToken);
        assertThat(createdMessage.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createdMessage.getBody().path("data").path("deduplicated").asBoolean()).isFalse();
        String roomPublicId = createdMessage.getBody().path("data").path("room").path("roomPublicId").asText();

        JsonNode delivered = awaitEvent(secondNodeEvents, ChatEventType.MESSAGE_CREATED.name());
        assertFrontendEnvelope(delivered, roomPublicId, clientMessageId, 1L, false);
        assertThat(messageRepository.count()).isEqualTo(1L);
        assertThat(outboxRepository.count()).isEqualTo(2L);

        ResponseEntity<JsonNode> deduplicated = post(firstNodePort,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/messages",
            Map.of("clientMessageId", clientMessageId, "body", "노드 간 전달"), aliceToken);
        assertThat(deduplicated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(deduplicated.getBody().path("data").path("deduplicated").asBoolean()).isTrue();
        assertThat(messageRepository.count()).isEqualTo(1L);
        assertThat(outboxRepository.count()).isEqualTo(2L);

        ChatEventOutbox messageEvent = messageOutbox();
        secondNodeEvents.clear();
        Acknowledgment firstReplayAck = mock(Acknowledgment.class);
        Acknowledgment duplicateReplayAck = mock(Acknowledgment.class);
        ConsumerRecord<String, String> record = kafkaRecord(messageEvent);
        kafkaOutboxListener.consume(record, firstReplayAck);
        kafkaOutboxListener.consume(record, duplicateReplayAck);

        verify(firstReplayAck).acknowledge();
        verify(duplicateReplayAck).acknowledge();
        assertNoEvent(secondNodeEvents, ChatEventType.MESSAGE_CREATED.name(), Duration.ofSeconds(2L));
        assertThat(messageRepository.count()).isEqualTo(1L);

        ResponseEntity<JsonNode> gap = get(secondNodePort,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/messages?afterSequence=0", bobToken);
        assertThat(gap.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(gap.getBody().path("data").path("content")).hasSize(1);
        assertThat(gap.getBody().path("data").path("content").get(0).path("roomSequence").asLong())
            .isEqualTo(1L);

        assertThat(exchange(firstNodePort, HttpMethod.PUT,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/block", null, bobToken).getStatusCode())
            .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(exchange(firstNodePort, HttpMethod.DELETE,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/block", null, bobToken).getStatusCode())
            .isEqualTo(HttpStatus.NO_CONTENT);

        bobOnSecondNode.close();
        secondNodeEvents.clear();
        BlockingQueue<JsonNode> firstNodeEvents = new LinkedBlockingQueue<>();
        connectStomp(firstNodePort, bobToken, firstNodeEvents);
        ResponseEntity<JsonNode> afterReconnect = post(secondNodePort,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/messages",
            Map.of("clientMessageId", UUID.randomUUID().toString(), "body", "재접속 뒤 전달"), aliceToken);
        assertThat(afterReconnect.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode reconnectedDelivery = awaitEvent(firstNodeEvents, ChatEventType.MESSAGE_CREATED.name());
        assertThat(reconnectedDelivery.path("payload").path("message").path("roomSequence").asLong())
            .isEqualTo(2L);
    }

    @Test
    void Redis_중단중_REST_커밋은_유지되고_복구후_Kafka_replay로_STOMP와_gap이_복원된다() throws Exception {
        User alice = persistUser("redis_alice", "Redis앨리스");
        User bob = persistUser("redis_bob", "Redis밥");
        String aliceToken = token(alice);
        String bobToken = token(bob);
        ResponseEntity<JsonNode> room = post(firstNodePort, "/api/v1/me/chat-rooms/direct/messages",
            Map.of("counterpartNickname", bob.getNickname(), "clientMessageId", UUID.randomUUID().toString(),
                "body", "Redis 중단 준비 메시지"),
            aliceToken);
        String roomPublicId = room.getBody().path("data").path("room").path("roomPublicId").asText();
        BlockingQueue<JsonNode> events = new LinkedBlockingQueue<>();
        connectStomp(firstNodePort, bobToken, events);

        redisContainer.getDockerClient().pauseContainerCmd(redisContainer.getContainerId()).exec();
        try {
            ResponseEntity<JsonNode> response = post(firstNodePort,
                "/api/v1/me/chat-rooms/" + roomPublicId + "/messages",
                Map.of("clientMessageId", UUID.randomUUID().toString(), "body", "Redis 중단 중 커밋"),
                aliceToken);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(messageRepository.count()).isEqualTo(2L);
            assertThat(outboxRepository.count()).isEqualTo(4L);
            assertThat(events.poll(700L, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            redisContainer.getDockerClient().unpauseContainerCmd(redisContainer.getContainerId()).exec();
        }

        awaitRedisRecovery();
        ChatEventOutbox messageEvent = messageOutbox();
        Acknowledgment recoveryAck = mock(Acknowledgment.class);
        kafkaOutboxListener.consume(kafkaRecord(messageEvent), recoveryAck);

        JsonNode recovered = awaitEvent(events, ChatEventType.MESSAGE_CREATED.name());
        assertThat(recovered.path("eventId").asText()).isEqualTo(messageEvent.getEventId());
        verify(recoveryAck).acknowledge();
        ResponseEntity<JsonNode> gap = get(firstNodePort,
            "/api/v1/me/chat-rooms/" + roomPublicId + "/messages?afterSequence=0", bobToken);
        assertThat(gap.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(gap.getBody().path("data").path("content")).hasSize(2);
    }

    @Test
    void 위조_JWT_CONNECT는_정책위반_1008로_종료한다() throws Exception {
        AtomicReference<CloseStatus> closeStatus = new AtomicReference<>();
        AtomicReference<String> errorFrame = new AtomicReference<>();
        CompletableFuture<Void> closed = new CompletableFuture<>();
        StandardWebSocketClient client = new StandardWebSocketClient();
        WebSocketHttpHeaders headers = websocketHeaders();
        WebSocketHandler handler = new AbstractWebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                session.sendMessage(new TextMessage("CONNECT\naccept-version:1.2\n"
                    + "heart-beat:10000,10000\nhost:localhost\n"
                    + "Authorization:Bearer forged-token\n\n\0"));
            }

            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                errorFrame.set(message.getPayload());
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                closeStatus.set(status);
                closed.complete(null);
            }
        };

        client.execute(handler, headers, URI.create(wsUrl(firstNodePort))).get(5L, TimeUnit.SECONDS);
        closed.get(5L, TimeUnit.SECONDS);

        assertThat(closeStatus.get().getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        if (errorFrame.get() != null) {
            assertThat(errorFrame.get()).contains("COMMON_005", "content-type:application/json");
        }
    }

    @Test
    void 검증된_JWT_exp가_되면_실제_socket을_1008로_종료하고_Redis_lease를_정리한다() throws Exception {
        String userId = "987654321";
        String accessToken = shortLivedAccessToken(userId, Duration.ofSeconds(2L));
        AtomicReference<CloseStatus> closeStatus = new AtomicReference<>();
        CompletableFuture<Void> connected = new CompletableFuture<>();
        CompletableFuture<Void> closed = new CompletableFuture<>();
        StandardWebSocketClient client = new StandardWebSocketClient();
        WebSocketHandler handler = new AbstractWebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                session.sendMessage(new TextMessage("CONNECT\naccept-version:1.2\n"
                    + "heart-beat:10000,10000\nhost:localhost\n"
                    + "Authorization:Bearer " + accessToken + "\n\n\0"));
            }

            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                if (message.getPayload().startsWith("CONNECTED")) {
                    connected.complete(null);
                }
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                closeStatus.set(status);
                closed.complete(null);
            }
        };

        client.execute(handler, websocketHeaders(), URI.create(wsUrl(firstNodePort)))
            .get(5L, TimeUnit.SECONDS);
        connected.get(5L, TimeUnit.SECONDS);
        assertThat(socketLeaseCount(userId)).isEqualTo(1L);
        closed.get(5L, TimeUnit.SECONDS);

        assertThat(closeStatus.get().getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
        awaitSocketLeaseCleanup(userId);
    }

    private int startSecondNode() {
        secondNode = new SpringApplicationBuilder(FinalcallApplication.class).profiles("local").run(
            "--server.port=0",
            "--spring.datasource.url=" + mysqlContainer.getJdbcUrl(),
            "--spring.datasource.username=" + mysqlContainer.getUsername(),
            "--spring.datasource.password=" + mysqlContainer.getPassword(),
            "--spring.data.redis.host=" + redisContainer.getHost(),
            "--spring.data.redis.port=" + redisContainer.getMappedPort(6379),
            "--spring.data.redis.timeout=500ms",
            "--spring.data.redis.connect-timeout=500ms",
            "--gateway.internal.enforced=false",
            "--closing.worker.enabled=false",
            "--shop.expiry.worker.enabled=false",
            "--delivery.worker.enabled=false",
            "--demo.seed.enabled=false",
            "--search.reconciliation.enabled=false",
            "--search.reindex-on-startup=false",
            "--management.health.elasticsearch.enabled=false",
            "--board.image.storage.ensure-bucket-on-startup=false",
            "--chat.kafka.consumer.enabled=false");
        return ((ServletWebServerApplicationContext)secondNode).getWebServer().getPort();
    }

    private StompConnection connectStomp(int port, String accessToken, BlockingQueue<JsonNode> events)
        throws Exception {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("chat-test-stomp-");
        scheduler.initialize();
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setTaskScheduler(scheduler);
        client.setDefaultHeartbeat(new long[] {10_000L, 10_000L});

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.setAcceptVersion("1.2");
        connectHeaders.setHeartbeat(new long[] {10_000L, 10_000L});
        connectHeaders.add(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
        StompSessionHandlerAdapter handler = new StompSessionHandlerAdapter() {
            @Override
            public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
                session.subscribe("/user/queue/chat.events", new StompFrameHandler() {
                    @Override
                    public Type getPayloadType(StompHeaders headers) {
                        return byte[].class;
                    }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        try {
                            events.add(objectMapper.readTree((byte[])payload));
                        } catch (Exception ex) {
                            throw new IllegalArgumentException("채팅 event JSON 역직렬화 실패", ex);
                        }
                    }
                });
            }
        };
        StompSession session = client.connectAsync(wsUrl(port), websocketHeaders(), connectHeaders, handler)
            .get(10L, TimeUnit.SECONDS);
        TimeUnit.MILLISECONDS.sleep(300L);
        StompConnection connection = new StompConnection(client, scheduler, session);
        stompConnections.add(connection);
        return connection;
    }

    private void assertFrontendEnvelope(JsonNode event, String roomPublicId, String clientMessageId,
        long roomSequence, boolean sentByMe) {
        assertThat(event.path("eventId").asText()).hasSize(26);
        assertThat(event.path("eventType").asText()).isEqualTo(ChatEventType.MESSAGE_CREATED.name());
        assertThat(event.path("eventVersion").asInt()).isEqualTo(1);
        assertThat(event.path("occurredAt").asText()).isNotBlank();
        assertThat(event.path("roomPublicId").asText()).isEqualTo(roomPublicId);
        JsonNode message = event.path("payload").path("message");
        assertThat(message.path("messagePublicId").asText()).hasSize(26);
        assertThat(message.path("clientMessageId").asText()).isEqualTo(clientMessageId);
        assertThat(message.path("roomSequence").asLong()).isEqualTo(roomSequence);
        assertThat(message.path("sender").path("memberPublicId").asText()).hasSize(26);
        assertThat(message.path("sender").path("nickname").asText()).isEqualTo("멀티노드앨리스");
        assertThat(message.path("body").asText()).isEqualTo("노드 간 전달");
        assertThat(message.path("sentByMe").asBoolean()).isEqualTo(sentByMe);
        assertThat(message.path("createdAt").asText()).isNotBlank();
    }

    private JsonNode awaitEvent(BlockingQueue<JsonNode> events, String eventType) throws InterruptedException {
        long deadline = System.nanoTime() + EVENT_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            JsonNode event = events.poll(200L, TimeUnit.MILLISECONDS);
            if (event != null && eventType.equals(event.path("eventType").asText())) {
                return event;
            }
        }
        throw new AssertionError("기한 안에 " + eventType + " event를 받지 못했습니다.");
    }

    private void assertNoEvent(BlockingQueue<JsonNode> events, String eventType, Duration timeout)
        throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            JsonNode event = events.poll(200L, TimeUnit.MILLISECONDS);
            if (event != null && eventType.equals(event.path("eventType").asText())) {
                throw new AssertionError("중복 " + eventType + " event가 전달됐습니다.");
            }
        }
    }

    private ConsumerRecord<String, String> kafkaRecord(ChatEventOutbox event) throws Exception {
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("eventId", event.getEventId());
        envelope.put("eventType", event.getEventType().name());
        envelope.put("eventVersion", event.getEventVersion());
        envelope.put("occurredAt", event.getOccurredAt().toString());
        envelope.put("roomPublicId", event.getAggregateId());
        envelope.set("payload", objectMapper.readTree(event.getPayload()));
        return new ConsumerRecord<>("finalcall.chat.events.v1", 0, 1L,
            event.getAggregateId(), objectMapper.writeValueAsString(envelope));
    }

    private ChatEventOutbox messageOutbox() {
        return outboxRepository.findAll().stream()
            .filter(event -> event.getEventType() == ChatEventType.MESSAGE_CREATED)
            .max(java.util.Comparator.comparing(ChatEventOutbox::getId))
            .orElseThrow();
    }

    private ResponseEntity<JsonNode> post(int port, String path, Object body, String token) {
        return exchange(port, HttpMethod.POST, path, body, token);
    }

    private ResponseEntity<JsonNode> get(int port, String path, String token) {
        return exchange(port, HttpMethod.GET, path, null, token);
    }

    private ResponseEntity<JsonNode> exchange(int port, HttpMethod method, String path, Object body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(httpUrl(port) + path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private User persistUser(String suffix, String nickname) {
        return userRepository.saveAndFlush(User.builder()
            .loginId("chat323_" + suffix)
            .passwordHash("hash")
            .nickname(nickname)
            .build());
    }

    private String token(User user) {
        return tokenProvider.generateAccessToken(
            new TokenClaims(String.valueOf(user.getId()), user.getPublicId(), false));
    }

    private String shortLivedAccessToken(String userId, Duration lifetime) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId)
            .claim("publicId", "01H00000000000000000000000")
            .claim("isAdmin", false)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(lifetime)))
            .signWith(Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8)),
                Jwts.SIG.HS256)
            .compact();
    }

    private Long socketLeaseCount(String userId) {
        return redisTemplate.opsForZSet().zCard("chat:socket:leases:{" + userId + "}");
    }

    private void awaitSocketLeaseCleanup(String userId) throws InterruptedException {
        for (int attempt = 0; attempt < 40; attempt++) {
            if (Long.valueOf(0L).equals(socketLeaseCount(userId))) {
                return;
            }
            TimeUnit.MILLISECONDS.sleep(25L);
        }
        throw new AssertionError("JWT exp 종료 뒤 Redis socket lease가 정리되지 않았습니다.");
    }

    private WebSocketHttpHeaders websocketHeaders() {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setOrigin(ORIGIN);
        return headers;
    }

    private String httpUrl(int port) {
        return "http://localhost:" + port;
    }

    private String wsUrl(int port) {
        return "ws://localhost:" + port + "/ws/chat";
    }

    private void awaitRedisRecovery() throws Exception {
        for (int attempt = 0; attempt < 20; attempt++) {
            try {
                String pong = redisContainer.execInContainer("redis-cli", "ping").getStdout().trim();
                String subscribers = redisContainer.execInContainer("redis-cli", "PUBSUB", "NUMSUB",
                    ChatRedisFanoutPublisher.FANOUT_CHANNEL).getStdout().trim();
                String[] lines = subscribers.split("\\R");
                if ("PONG".equals(pong) && lines.length >= 2
                    && Long.parseLong(lines[lines.length - 1].trim()) > 0L) {
                    return;
                }
            } catch (Exception ignored) {
                // 컨테이너가 unpause 뒤 명령을 받을 때까지 재시도한다.
            }
            TimeUnit.MILLISECONDS.sleep(250L);
        }
        throw new AssertionError("Redis가 기한 안에 복구되지 않았습니다.");
    }

    private void ensureRedisRunning() {
        if (redisContainer != null && redisContainer.isRunning()) {
            try {
                redisContainer.getDockerClient().unpauseContainerCmd(redisContainer.getContainerId()).exec();
            } catch (RuntimeException ignored) {
                // 이미 실행 중이면 Docker가 반환하는 not paused 오류는 정리 과정에서 무시한다.
            }
        }
    }

    private void closeClients() {
        for (StompConnection connection : stompConnections) {
            connection.close();
        }
        stompConnections.clear();
    }

    private record StompConnection(WebSocketStompClient client, ThreadPoolTaskScheduler scheduler,
        StompSession session) {

        private void close() {
            try {
                if (session.isConnected()) {
                    session.disconnect();
                }
            } finally {
                client.stop();
                scheduler.shutdown();
            }
        }
    }
}
