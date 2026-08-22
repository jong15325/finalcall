package com.finalcall.domain.chat.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.chat.dto.ChatDirectMessageSendRequest;
import com.finalcall.domain.chat.dto.ChatDirectMessageSendResponse;
import com.finalcall.domain.chat.dto.ChatMessageResponse;
import com.finalcall.domain.chat.dto.ChatMessageSendRequest;
import com.finalcall.domain.chat.dto.ChatMessageSendResponse;
import com.finalcall.domain.chat.dto.ChatReadResponse;
import com.finalcall.domain.chat.dto.ChatReadUpdateRequest;
import com.finalcall.domain.chat.dto.ChatReportCreateRequest;
import com.finalcall.domain.chat.dto.ChatReportResponse;
import com.finalcall.domain.chat.dto.ChatRoomResponse;
import com.finalcall.domain.chat.dto.ChatUnreadCountResponse;
import com.finalcall.domain.chat.entity.ChatReport;
import com.finalcall.domain.chat.service.ChatCommandService;
import com.finalcall.domain.chat.service.ChatDirectMessagePersistence;
import com.finalcall.domain.chat.service.ChatDirectMessageService;
import com.finalcall.domain.chat.service.ChatMessagePersistence;
import com.finalcall.domain.chat.service.ChatQueryService;
import com.finalcall.domain.chat.service.ChatRateLimitService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** REST가 영속 명령과 replay의 정본인 1:1 채팅 API. 전 경로의 주체는 SecurityContext다. */
@RestController
@RequestMapping("/api/v1/me/chat-rooms")
@RequiredArgsConstructor
public class ChatController {

    private static final int DEFAULT_ROOM_PAGE_SIZE = 20;
    private static final int DEFAULT_MESSAGE_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final ChatCommandService commandService;
    private final ChatDirectMessageService directMessageService;
    private final ChatQueryService queryService;
    private final ChatRateLimitService rateLimitService;

    /** direct room을 생성 또는 재사용하고 첫 메시지를 원자적으로 전송한다. */
    @PostMapping("/direct/messages")
    public ResponseEntity<ApiResponse<ChatDirectMessageSendResponse>> sendDirectMessage(
        @Valid @RequestBody ChatDirectMessageSendRequest request) {
        rateLimitService.checkMessageSend();
        ChatDirectMessagePersistence result = directMessageService.send(request.counterpartNickname(),
            request.clientMessageId(), request.body());
        ChatRoomResponse room = queryService.getRoom(result.room().getPublicId());
        ChatMessageResponse message = ChatMessageResponse.from(result.message(), result.senderPublicId(),
            result.senderPrimaryCharacterId());
        HttpStatus status = result.deduplicated() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(ApiResponse.success(ChatDirectMessageSendResponse.from(
            room, message, result.roomCreated(), result.deduplicated())));
    }

    /** 내 방 목록을 최근 활동 역순의 opaque cursor로 조회한다. */
    @GetMapping
    public ApiResponse<CursorResponse<ChatRoomResponse, String>> getRooms(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(queryService.getRooms(cursor, normalizeSize(size, DEFAULT_ROOM_PAGE_SIZE)));
    }

    /** 모든 참여 방의 unread 합계를 반환한다. */
    @GetMapping("/unread-count")
    public ApiResponse<ChatUnreadCountResponse> getUnreadCount() {
        return ApiResponse.success(ChatUnreadCountResponse.from(queryService.getUnreadCount()));
    }

    /** 미존재·비참여를 구별하지 않는 방 상세 조회. */
    @GetMapping("/{roomPublicId}")
    public ApiResponse<ChatRoomResponse> getRoom(@PathVariable String roomPublicId) {
        return ApiResponse.success(queryService.getRoom(roomPublicId));
    }

    /** 최신/과거/gap 메시지를 항상 roomSequence 오름차순으로 반환한다. */
    @GetMapping("/{roomPublicId}/messages")
    public ApiResponse<CursorResponse<ChatMessageResponse, Long>> getMessages(
        @PathVariable String roomPublicId,
        @RequestParam(required = false) Long beforeSequence,
        @RequestParam(required = false) Long afterSequence,
        @RequestParam(defaultValue = "50") int size) {
        return ApiResponse.success(queryService.getMessages(roomPublicId, beforeSequence, afterSequence,
            normalizeSize(size, DEFAULT_MESSAGE_PAGE_SIZE)));
    }

    /** 메시지를 영속하고 최초 201, 같은 본문 멱등 재확인은 200으로 반환한다. */
    @PostMapping("/{roomPublicId}/messages")
    public ResponseEntity<ApiResponse<ChatMessageSendResponse>> sendMessage(
        @PathVariable String roomPublicId,
        @Valid @RequestBody ChatMessageSendRequest request) {
        rateLimitService.checkMessageSend();
        ChatMessagePersistence result = commandService.sendMessage(
            roomPublicId, request.clientMessageId(), request.body());
        ChatMessageResponse message = ChatMessageResponse.from(result.message(), result.senderPublicId(),
            result.senderPrimaryCharacterId());
        HttpStatus status = result.deduplicated() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status)
            .body(ApiResponse.success(ChatMessageSendResponse.from(message, result.deduplicated())));
    }

    /** 읽음 위치를 뒤로 보내지 않고 room의 현재 마지막 sequence 안에서만 전진시킨다. */
    @PutMapping("/{roomPublicId}/read")
    public ApiResponse<ChatReadResponse> updateRead(
        @PathVariable String roomPublicId,
        @Valid @RequestBody ChatReadUpdateRequest request) {
        return ApiResponse.success(ChatReadResponse.from(
            commandService.updateRead(roomPublicId, request.throughSequence())));
    }

    /** 현재 사용자가 만든 방향성 차단을 멱등 생성한다. */
    @PutMapping("/{roomPublicId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void block(@PathVariable String roomPublicId) {
        commandService.block(roomPublicId);
    }

    /** 현재 사용자가 만든 방향성 차단만 멱등 해제한다. */
    @DeleteMapping("/{roomPublicId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable String roomPublicId) {
        commandService.unblock(roomPublicId);
    }

    /** 같은 방 상대가 보낸 메시지의 증거 snapshot을 신고로 보존한다. */
    @PostMapping("/{roomPublicId}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ChatReportResponse> report(
        @PathVariable String roomPublicId,
        @Valid @RequestBody ChatReportCreateRequest request) {
        rateLimitService.checkReport();
        ChatReport report = commandService.report(
            roomPublicId, request.messagePublicId(), request.reason(), request.detail());
        return ApiResponse.success(ChatReportResponse.from(report));
    }

    private int normalizeSize(int size, int defaultSize) {
        if (size <= 0) {
            return defaultSize;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
