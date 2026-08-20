import { Client, Versions } from '@stomp/stompjs'
import {
    blockChatCounterpart,
    createDirectChatRoom,
    getChatMessages,
    getChatRoom,
    getChatRooms,
    reportChatMessage,
    sendChatMessage,
    unblockChatCounterpart,
    updateChatRead,
} from '@/lib/api/chat'
import type {
    ChatCursorPage,
    ChatDirectRoomCreateRequest,
    ChatEventResponse,
    ChatMessageListQuery,
    ChatMessageResponse,
    ChatMessageSendRequest,
    ChatMessageSendResponse,
    ChatReadResponse,
    ChatReportCreateRequest,
    ChatReportResponse,
    ChatRoomListQuery,
    ChatRoomResponse,
} from '@/lib/api/chat'

export type ChatRealtimeStatus =
    'connecting' | 'connected' | 'reconnecting' | 'offline' | 'disconnected'

export interface ChatRealtimeHandlers {
    onEvent: (event: ChatEventResponse) => void
    onStatus: (status: ChatRealtimeStatus) => void
    onError: (error: Error) => void
}

export interface ChatRealtimeClient {
    connect(accessToken: string, handlers: ChatRealtimeHandlers): void
    disconnect(): Promise<void>
}

export interface ChatRestAdapter {
    createRoom: (body: ChatDirectRoomCreateRequest) => Promise<ChatRoomResponse>
    listRooms: (
        query?: ChatRoomListQuery,
        signal?: AbortSignal,
    ) => Promise<ChatCursorPage<ChatRoomResponse, string>>
    getRoom: (
        roomPublicId: string,
        signal?: AbortSignal,
    ) => Promise<ChatRoomResponse>
    getMessages: (
        roomPublicId: string,
        query?: ChatMessageListQuery,
        signal?: AbortSignal,
    ) => Promise<ChatCursorPage<ChatMessageResponse, number>>
    sendMessage: (
        roomPublicId: string,
        body: ChatMessageSendRequest,
    ) => Promise<ChatMessageSendResponse>
    updateRead: (
        roomPublicId: string,
        throughSequence: number,
    ) => Promise<ChatReadResponse>
    block: (roomPublicId: string) => Promise<void>
    unblock: (roomPublicId: string) => Promise<void>
    report: (
        roomPublicId: string,
        body: ChatReportCreateRequest,
    ) => Promise<ChatReportResponse>
}

export interface ChatRuntime {
    rest: ChatRestAdapter
    createRealtimeClient: () => ChatRealtimeClient
    createClientMessageId: () => string
    isOnline: () => boolean
    now: () => string
    listenNetworkStatus: (listener: (online: boolean) => void) => () => void
}

const rest: ChatRestAdapter = {
    createRoom: createDirectChatRoom,
    listRooms: getChatRooms,
    getRoom: getChatRoom,
    getMessages: getChatMessages,
    sendMessage: sendChatMessage,
    updateRead: (roomPublicId, throughSequence) =>
        updateChatRead(roomPublicId, { throughSequence }),
    block: blockChatCounterpart,
    unblock: unblockChatCounterpart,
    report: reportChatMessage,
}

export const browserChatRuntime: ChatRuntime = {
    rest,
    createRealtimeClient: () => new StompChatRealtimeClient(),
    createClientMessageId: () => crypto.randomUUID(),
    isOnline: () => navigator.onLine,
    now: () => new Date().toISOString(),
    listenNetworkStatus: (listener) => {
        const onOnline = () => listener(true)
        const onOffline = () => listener(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    },
}

/** 계약 §2.7.2의 1·2·4·8·16초, 최대 30초 full-jitter backoff. */
export function fullJitterDelay(attempt: number, random = Math.random): number {
    const cap = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt))
    return Math.floor(random() * cap)
}

class StompChatRealtimeClient implements ChatRealtimeClient {
    private client: Client | null = null
    private handlers: ChatRealtimeHandlers | null = null
    private accessToken = ''
    private active = false
    private connectedOnce = false
    private reconnectAttempt = 0
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null

    connect(accessToken: string, handlers: ChatRealtimeHandlers): void {
        if (this.active) return
        this.active = true
        this.accessToken = accessToken
        this.handlers = handlers
        this.connectedOnce = false
        this.reconnectAttempt = 0
        this.open()
    }

    async disconnect(): Promise<void> {
        this.active = false
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        const client = this.client
        this.client = null
        if (client?.active) await client.deactivate()
        this.handlers?.onStatus('disconnected')
    }

    private open(): void {
        if (!this.active || this.accessToken.length === 0) return
        if (!navigator.onLine) {
            this.handlers?.onStatus('offline')
            this.scheduleReconnect()
            return
        }

        this.handlers?.onStatus(
            this.connectedOnce ? 'reconnecting' : 'connecting',
        )

        const client = new Client({
            brokerURL: chatWebSocketUrl(),
            connectHeaders: {
                Authorization: `Bearer ${this.accessToken}`,
            },
            stompVersions: new Versions([Versions.V1_2]),
            connectionTimeout: 5_000,
            heartbeatIncoming: 10_000,
            heartbeatOutgoing: 10_000,
            reconnectDelay: 0,
        })

        client.onConnect = () => {
            if (!this.active) return
            this.connectedOnce = true
            this.reconnectAttempt = 0
            client.subscribe(
                '/user/queue/chat.events',
                (frame) => {
                    try {
                        this.handlers?.onEvent(parseChatEvent(frame.body))
                    } catch (error) {
                        this.handlers?.onError(asError(error))
                    }
                },
                { ack: 'auto' },
            )
            this.handlers?.onStatus('connected')
        }
        client.onStompError = (frame) => {
            this.handlers?.onError(
                new Error(frame.headers.message ?? '실시간 연결 오류'),
            )
        }
        client.onWebSocketError = () => {
            this.handlers?.onError(
                new Error('실시간 서버에 연결하지 못했습니다.'),
            )
        }
        client.onWebSocketClose = () => {
            if (!this.active) return
            this.scheduleReconnect()
        }

        this.client = client
        client.activate()
    }

    private scheduleReconnect(): void {
        if (!this.active || this.reconnectTimer !== null) return
        const online = navigator.onLine
        this.handlers?.onStatus(online ? 'reconnecting' : 'offline')
        const delay = online ? fullJitterDelay(this.reconnectAttempt) : 1_000
        this.reconnectAttempt += 1
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.open()
        }, delay)
    }
}

function chatWebSocketUrl(): string {
    const url = new URL('/ws/chat', window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
}

function parseChatEvent(body: string): ChatEventResponse {
    const value = JSON.parse(body) as Partial<ChatEventResponse>
    if (
        value.eventVersion !== 1 ||
        typeof value.eventId !== 'string' ||
        typeof value.roomPublicId !== 'string' ||
        !['MESSAGE_CREATED', 'READ_UPDATED', 'BLOCK_CHANGED'].includes(
            value.eventType ?? '',
        ) ||
        typeof value.payload !== 'object' ||
        value.payload === null
    ) {
        throw new Error('지원하지 않는 채팅 이벤트를 받았습니다.')
    }
    return value as ChatEventResponse
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error('채팅 처리 오류')
}
