import { apiClient } from './client'

/** 계약 §2.7의 cursor 응답. 채팅 메시지만 numeric sequence cursor를 쓴다. */
export interface ChatCursorPage<T, Cursor extends string | number> {
    content: T[]
    nextCursor: Cursor | null
    hasNext: boolean
}

export interface ChatMemberResponse {
    memberPublicId: string
    nickname: string
}

export interface ChatLastMessageResponse {
    messagePublicId: string
    roomSequence: number
    senderNickname: string
    bodyPreview: string
    createdAt: string
}

export interface ChatRoomResponse {
    roomPublicId: string
    counterpart: ChatMemberResponse
    lastMessage: ChatLastMessageResponse | null
    lastSequence: number
    lastReadSequence: number
    counterpartLastReadSequence: number
    unreadCount: number
    blockedByMe: boolean
    canSend: boolean
    createdAt: string
    lastActivityAt: string
}

export interface ChatMessageResponse {
    messagePublicId: string
    clientMessageId: string
    roomSequence: number
    sender: ChatMemberResponse
    body: string
    sentByMe: boolean
    createdAt: string
}

export interface ChatMessageSendRequest {
    clientMessageId: string
    body: string
}

export interface ChatMessageSendResponse {
    message: ChatMessageResponse
    deduplicated: boolean
}

export interface ChatReadUpdateRequest {
    throughSequence: number
}

export interface ChatReadResponse {
    lastReadSequence: number
    readAt: string
}

export type ChatReportReason = 'SPAM' | 'ABUSE' | 'FRAUD' | 'OTHER'

export interface ChatReportCreateRequest {
    messagePublicId: string
    reason: ChatReportReason
    detail?: string
}

export interface ChatReportResponse {
    reportPublicId: string
    createdAt: string
}

export interface ChatUnreadCountResponse {
    count: number
}

export interface ChatDirectRoomCreateRequest {
    counterpartNickname: string
}

export interface ChatRoomListQuery {
    cursor?: string
    size?: number
}

export interface ChatMessageListQuery {
    beforeSequence?: number
    afterSequence?: number
    size?: number
}

interface MessageCreatedPayload {
    message: ChatMessageResponse
}

interface ReadUpdatedPayload {
    readerMemberPublicId: string
    throughSequence: number
    readAt: string
}

interface BlockChangedPayload {
    changedAt: string
}

interface ChatEventBase {
    eventId: string
    eventVersion: 1
    occurredAt: string
    roomPublicId: string
}

export type ChatEventResponse =
    | (ChatEventBase & {
          eventType: 'MESSAGE_CREATED'
          payload: MessageCreatedPayload
      })
    | (ChatEventBase & {
          eventType: 'READ_UPDATED'
          payload: ReadUpdatedPayload
      })
    | (ChatEventBase & {
          eventType: 'BLOCK_CHANGED'
          payload: BlockChangedPayload
      })

export function createDirectChatRoom(
    body: ChatDirectRoomCreateRequest,
): Promise<ChatRoomResponse> {
    return apiClient.post<ChatRoomResponse>('/me/chat-rooms/direct', body)
}

export function getChatRooms(
    query: ChatRoomListQuery = {},
    signal?: AbortSignal,
): Promise<ChatCursorPage<ChatRoomResponse, string>> {
    return apiClient.get<ChatCursorPage<ChatRoomResponse, string>>(
        '/me/chat-rooms',
        { query: { ...query }, signal },
    )
}

export function getChatRoom(
    roomPublicId: string,
    signal?: AbortSignal,
): Promise<ChatRoomResponse> {
    return apiClient.get<ChatRoomResponse>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}`,
        { signal },
    )
}

export function getChatMessages(
    roomPublicId: string,
    query: ChatMessageListQuery = {},
    signal?: AbortSignal,
): Promise<ChatCursorPage<ChatMessageResponse, number>> {
    return apiClient.get<ChatCursorPage<ChatMessageResponse, number>>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/messages`,
        { query: { ...query }, signal },
    )
}

export function sendChatMessage(
    roomPublicId: string,
    body: ChatMessageSendRequest,
): Promise<ChatMessageSendResponse> {
    return apiClient.post<ChatMessageSendResponse>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/messages`,
        body,
    )
}

export function updateChatRead(
    roomPublicId: string,
    body: ChatReadUpdateRequest,
): Promise<ChatReadResponse> {
    return apiClient.put<ChatReadResponse>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/read`,
        body,
    )
}

export function blockChatCounterpart(roomPublicId: string): Promise<void> {
    return apiClient.put<void>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/block`,
    )
}

export function unblockChatCounterpart(roomPublicId: string): Promise<void> {
    return apiClient.delete<void>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/block`,
    )
}

export function reportChatMessage(
    roomPublicId: string,
    body: ChatReportCreateRequest,
): Promise<ChatReportResponse> {
    return apiClient.post<ChatReportResponse>(
        `/me/chat-rooms/${encodeURIComponent(roomPublicId)}/reports`,
        body,
    )
}

export function getChatUnreadCount(
    signal?: AbortSignal,
): Promise<ChatUnreadCountResponse> {
    return apiClient.get<ChatUnreadCountResponse>(
        '/me/chat-rooms/unread-count',
        { signal },
    )
}
