import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    chatBlockErrorMessage,
    chatLoadErrorMessage,
    chatReportErrorMessage,
    chatSendErrorMessage,
} from './chatErrors'
import {
    chatBodyPreview,
    highestCommittedSequence,
    mergeChatMessages,
    upsertOptimisticMessage,
    validateChatBody,
} from './chatTimeline'
import type { ChatRuntime, ChatRealtimeStatus } from './chatRuntime'
import type { ChatTimelineMessage } from './chatTimeline'
import type {
    ChatEventResponse,
    ChatMessageResponse,
    ChatReportReason,
    ChatRoomResponse,
} from '@/lib/api/chat'
import type { UserSummary } from '@/store/authStore'

interface MessagePageState {
    hasOlder: boolean
    nextCursor: number | null
}

type MessagesByRoom = Record<string, ChatTimelineMessage[]>
type MessagePagesByRoom = Record<string, MessagePageState>

const DRAFT_ROOM_PREFIX = 'draft:'

export function useChatController({
    runtime,
    accessToken,
    user,
    conversationVisible,
}: {
    runtime: ChatRuntime
    accessToken: string
    user: UserSummary
    conversationVisible: boolean
}) {
    const [rooms, setRooms] = useState<ChatRoomResponse[]>([])
    const [roomsNextCursor, setRoomsNextCursor] = useState<string | null>(null)
    const [roomsHasNext, setRoomsHasNext] = useState(false)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [messagesByRoom, setMessagesByRoom] = useState<MessagesByRoom>({})
    const [messagePages, setMessagePages] = useState<MessagePagesByRoom>({})
    const [roomsLoading, setRoomsLoading] = useState(true)
    const [conversationLoading, setConversationLoading] = useState(false)
    const [olderLoading, setOlderLoading] = useState(false)
    const [roomsError, setRoomsError] = useState<string | null>(null)
    const [conversationError, setConversationError] = useState<string | null>(
        null,
    )
    const [sendError, setSendError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [actionPending, setActionPending] = useState(false)
    const [realtimeStatus, setRealtimeStatus] =
        useState<ChatRealtimeStatus>('connecting')
    const [online, setOnline] = useState(runtime.isOnline())
    const [bootstrapped, setBootstrapped] = useState(false)

    const roomsRef = useRef(rooms)
    const messagesRef = useRef(messagesByRoom)
    const selectedRoomRef = useRef(selectedRoomId)
    const conversationVisibleRef = useRef(conversationVisible)
    const seenEventIdsRef = useRef(new Set<string>())
    const readRequestedRef = useRef<Record<string, number>>({})
    const syncInFlightRef = useRef<Promise<void> | null>(null)
    const replayInFlightRef = useRef(new Map<string, Promise<void>>())
    const handleEventRef = useRef<(event: ChatEventResponse) => void>(() => {})
    const syncOnConnectRef = useRef<() => Promise<void>>(async () => {})
    const retryQueuedRef = useRef<() => void>(() => {})
    conversationVisibleRef.current = conversationVisible

    const updateRooms = useCallback(
        (updater: (current: ChatRoomResponse[]) => ChatRoomResponse[]) => {
            const next = updater(roomsRef.current)
            roomsRef.current = next
            setRooms(next)
        },
        [],
    )

    const updateMessages = useCallback(
        (
            roomPublicId: string,
            updater: (current: ChatTimelineMessage[]) => ChatTimelineMessage[],
        ) => {
            const current = messagesRef.current
            const next = {
                ...current,
                [roomPublicId]: updater(current[roomPublicId] ?? []),
            }
            messagesRef.current = next
            setMessagesByRoom(next)
        },
        [],
    )

    const refreshRoom = useCallback(
        async (roomPublicId: string) => {
            const room = await runtime.rest.getRoom(roomPublicId)
            updateRooms((current) => mergeRooms(current, [room]))
            return room
        },
        [runtime, updateRooms],
    )

    const markRead = useCallback(
        async (roomPublicId: string, throughSequence: number) => {
            const room = roomsRef.current.find(
                (candidate) => candidate.roomPublicId === roomPublicId,
            )
            if (!room || throughSequence <= room.lastReadSequence) return
            if (
                throughSequence <= (readRequestedRef.current[roomPublicId] ?? 0)
            )
                return

            readRequestedRef.current[roomPublicId] = throughSequence
            updateRooms((current) =>
                current.map((candidate) =>
                    candidate.roomPublicId === roomPublicId
                        ? {
                              ...candidate,
                              lastReadSequence: throughSequence,
                              unreadCount: Math.max(
                                  0,
                                  candidate.lastSequence - throughSequence,
                              ),
                          }
                        : candidate,
                ),
            )

            try {
                const result = await runtime.rest.updateRead(
                    roomPublicId,
                    throughSequence,
                )
                updateRooms((current) =>
                    current.map((candidate) =>
                        candidate.roomPublicId === roomPublicId
                            ? {
                                  ...candidate,
                                  lastReadSequence: result.lastReadSequence,
                                  unreadCount: Math.max(
                                      0,
                                      candidate.lastSequence -
                                          result.lastReadSequence,
                                  ),
                              }
                            : candidate,
                    ),
                )
            } catch {
                delete readRequestedRef.current[roomPublicId]
                try {
                    await refreshRoom(roomPublicId)
                } catch {
                    // 다음 room sync가 읽음 위치를 복구한다.
                }
            }
        },
        [refreshRoom, runtime, updateRooms],
    )

    const replayGap = useCallback(
        (roomPublicId: string, afterSequence: number) => {
            const pending = replayInFlightRef.current.get(roomPublicId)
            if (pending) return pending

            const replay = (async () => {
                let cursor = afterSequence

                for (;;) {
                    const beforeReplay = highestCommittedSequence(
                        messagesRef.current[roomPublicId] ?? [],
                    )

                    for (;;) {
                        const page = await runtime.rest.getMessages(
                            roomPublicId,
                            {
                                afterSequence: cursor,
                                size: 100,
                            },
                        )
                        updateMessages(roomPublicId, (current) =>
                            mergeChatMessages(current, page.content),
                        )
                        if (
                            !page.hasNext ||
                            page.nextCursor === null ||
                            page.nextCursor <= cursor
                        )
                            break
                        cursor = page.nextCursor
                    }

                    const room = await runtime.rest.getRoom(roomPublicId)
                    updateRooms((current) => mergeRooms(current, [room]))
                    const highest = highestCommittedSequence(
                        messagesRef.current[roomPublicId] ?? [],
                    )
                    if (room.lastSequence <= highest || highest <= beforeReplay)
                        break
                    cursor = highest
                }

                const highest = highestCommittedSequence(
                    messagesRef.current[roomPublicId] ?? [],
                )
                if (
                    selectedRoomRef.current === roomPublicId &&
                    conversationVisibleRef.current &&
                    highest > 0
                ) {
                    void markRead(roomPublicId, highest)
                }
            })().finally(() => {
                replayInFlightRef.current.delete(roomPublicId)
            })

            replayInFlightRef.current.set(roomPublicId, replay)
            return replay
        },
        [markRead, runtime, updateMessages, updateRooms],
    )

    const loadConversation = useCallback(
        async (roomPublicId: string) => {
            setConversationLoading(true)
            setConversationError(null)
            try {
                const [room, page] = await Promise.all([
                    runtime.rest.getRoom(roomPublicId),
                    runtime.rest.getMessages(roomPublicId, { size: 50 }),
                ])
                updateRooms((current) => mergeRooms(current, [room]))
                updateMessages(roomPublicId, (current) =>
                    mergeChatMessages(current, page.content),
                )
                setMessagePages((current) => ({
                    ...current,
                    [roomPublicId]: {
                        hasOlder: page.hasNext,
                        nextCursor: page.nextCursor,
                    },
                }))
                const highest = Math.max(
                    room.lastSequence,
                    ...page.content.map(({ roomSequence }) => roomSequence),
                )
                if (
                    conversationVisibleRef.current &&
                    highest > room.lastReadSequence
                ) {
                    void markRead(roomPublicId, highest)
                }
            } catch (error) {
                setConversationError(chatLoadErrorMessage(error))
            } finally {
                setConversationLoading(false)
            }
        },
        [markRead, runtime, updateMessages, updateRooms],
    )

    const selectRoom = useCallback(
        (roomPublicId: string) => {
            selectedRoomRef.current = roomPublicId
            setSelectedRoomId(roomPublicId)
            setConversationError(null)
            setSendError(null)
            setActionError(null)
            void loadConversation(roomPublicId)
        },
        [loadConversation],
    )

    useEffect(() => {
        if (!conversationVisible || !selectedRoomId) return
        const highest = highestCommittedSequence(
            messagesByRoom[selectedRoomId] ?? [],
        )
        if (highest > 0) void markRead(selectedRoomId, highest)
    }, [conversationVisible, markRead, messagesByRoom, selectedRoomId])

    const loadRooms = useCallback(
        async (append = false) => {
            setRoomsLoading(true)
            setRoomsError(null)
            try {
                const page = await runtime.rest.listRooms({
                    cursor: append ? (roomsNextCursor ?? undefined) : undefined,
                    size: 20,
                })
                updateRooms((current) =>
                    append
                        ? mergeRooms(current, page.content)
                        : mergeRooms([], page.content),
                )
                setRoomsNextCursor(page.nextCursor)
                setRoomsHasNext(page.hasNext)

                if (!append) {
                    const selectedStillExists = page.content.some(
                        ({ roomPublicId }) =>
                            roomPublicId === selectedRoomRef.current,
                    )
                    const nextSelected = selectedStillExists
                        ? selectedRoomRef.current
                        : (page.content[0]?.roomPublicId ?? null)
                    selectedRoomRef.current = nextSelected
                    setSelectedRoomId(nextSelected)
                    if (nextSelected) void loadConversation(nextSelected)
                }
            } catch (error) {
                setRoomsError(chatLoadErrorMessage(error))
            } finally {
                setRoomsLoading(false)
                setBootstrapped(true)
            }
        },
        [loadConversation, roomsNextCursor, runtime, updateRooms],
    )

    useEffect(() => {
        void loadRooms()
        // 초기 진입 한 번. 명시적 재시도는 반환한 reloadRooms를 쓴다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runtime])

    const loadOlder = useCallback(async () => {
        const roomPublicId = selectedRoomRef.current
        if (!roomPublicId) return
        const pageState = messagePages[roomPublicId]
        if (!pageState?.hasOlder || pageState.nextCursor === null) return

        setOlderLoading(true)
        try {
            const page = await runtime.rest.getMessages(roomPublicId, {
                beforeSequence: pageState.nextCursor,
                size: 50,
            })
            updateMessages(roomPublicId, (current) =>
                mergeChatMessages(current, page.content),
            )
            setMessagePages((current) => ({
                ...current,
                [roomPublicId]: {
                    hasOlder: page.hasNext,
                    nextCursor: page.nextCursor,
                },
            }))
        } catch (error) {
            setConversationError(chatLoadErrorMessage(error))
        } finally {
            setOlderLoading(false)
        }
    }, [messagePages, runtime, updateMessages])

    const persistMessage = useCallback(
        async (roomPublicId: string, clientMessageId: string) => {
            const optimistic = (messagesRef.current[roomPublicId] ?? []).find(
                (message) => message.clientMessageId === clientMessageId,
            )
            if (!optimistic || optimistic.delivery === 'sent') return

            updateMessages(roomPublicId, (current) =>
                upsertOptimisticMessage(current, {
                    ...optimistic,
                    delivery: 'sending',
                }),
            )
            setSendError(null)
            try {
                const draftCounterpartNickname = roomPublicId.startsWith(
                    DRAFT_ROOM_PREFIX,
                )
                    ? decodeURIComponent(
                          roomPublicId.slice(DRAFT_ROOM_PREFIX.length),
                      )
                    : null
                if (draftCounterpartNickname) {
                    const directResult = await runtime.rest.sendDirectMessage({
                        counterpartNickname: draftCounterpartNickname,
                        clientMessageId,
                        body: optimistic.body,
                    })
                    const persistedRoomId = directResult.room.roomPublicId
                    updateRooms((current) =>
                        mergeRooms(
                            current.filter(
                                ({ roomPublicId: candidateId }) =>
                                    candidateId !== roomPublicId,
                            ),
                            [directResult.room],
                        ),
                    )
                    const draftMessages =
                        messagesRef.current[roomPublicId] ?? []
                    const currentMessages = messagesRef.current
                    const nextMessages = {
                        ...currentMessages,
                        [persistedRoomId]: mergeChatMessages(
                            [
                                ...(currentMessages[persistedRoomId] ?? []),
                                ...draftMessages,
                            ],
                            [directResult.message],
                        ),
                    }
                    delete nextMessages[roomPublicId]
                    messagesRef.current = nextMessages
                    setMessagesByRoom(nextMessages)
                    selectedRoomRef.current = persistedRoomId
                    setSelectedRoomId(persistedRoomId)
                } else {
                    const result = await runtime.rest.sendMessage(
                        roomPublicId,
                        {
                            clientMessageId,
                            body: optimistic.body,
                        },
                    )
                    updateMessages(roomPublicId, (current) =>
                        mergeChatMessages(current, [result.message]),
                    )
                    updateRooms((current) =>
                        current.map((room) =>
                            room.roomPublicId === roomPublicId
                                ? roomAfterMessage(room, result.message, true)
                                : room,
                        ),
                    )
                }
            } catch (error) {
                updateMessages(roomPublicId, (current) =>
                    upsertOptimisticMessage(current, {
                        ...optimistic,
                        delivery: runtime.isOnline() ? 'failed' : 'queued',
                    }),
                )
                setSendError(chatSendErrorMessage(error))
            }
        },
        [runtime, updateMessages, updateRooms],
    )

    const sendMessage = useCallback(
        (value: string): string | null => {
            const roomPublicId = selectedRoomRef.current
            const room = roomsRef.current.find(
                (candidate) => candidate.roomPublicId === roomPublicId,
            )
            if (!room || !room.canSend) {
                return '현재 이 대화에서는 새 메시지를 보낼 수 없습니다.'
            }

            const validation = validateChatBody(value)
            if (validation.error) return validation.error

            const clientMessageId = runtime.createClientMessageId()
            const optimistic: ChatTimelineMessage = {
                messagePublicId: null,
                clientMessageId,
                roomSequence: null,
                sender: {
                    memberPublicId: user.userPublicId,
                    nickname: user.nickname,
                },
                body: validation.body,
                sentByMe: true,
                createdAt: runtime.now(),
                delivery: runtime.isOnline() ? 'sending' : 'queued',
            }
            updateMessages(room.roomPublicId, (current) =>
                upsertOptimisticMessage(current, optimistic),
            )
            setSendError(null)
            if (runtime.isOnline()) {
                void persistMessage(room.roomPublicId, clientMessageId)
            }
            return null
        },
        [persistMessage, runtime, updateMessages, user],
    )

    const retryMessage = useCallback(
        (clientMessageId: string) => {
            const roomPublicId = selectedRoomRef.current
            if (!roomPublicId || !runtime.isOnline()) return
            void persistMessage(roomPublicId, clientMessageId)
        },
        [persistMessage, runtime],
    )

    const retryQueued = useCallback(() => {
        for (const [roomPublicId, messages] of Object.entries(
            messagesRef.current,
        )) {
            for (const message of messages) {
                if (message.delivery === 'queued') {
                    void persistMessage(roomPublicId, message.clientMessageId)
                }
            }
        }
    }, [persistMessage])
    retryQueuedRef.current = retryQueued

    useEffect(
        () =>
            runtime.listenNetworkStatus((isOnline) => {
                setOnline(isOnline)
                if (!isOnline) setRealtimeStatus('offline')
                else retryQueuedRef.current()
            }),
        [runtime],
    )

    const syncOnConnect = useCallback(async () => {
        if (syncInFlightRef.current) return syncInFlightRef.current
        const sync = (async () => {
            try {
                const page = await runtime.rest.listRooms({ size: 20 })
                updateRooms((current) => mergeRooms(current, page.content))
                setRoomsNextCursor(page.nextCursor)
                setRoomsHasNext(page.hasNext)

                for (const room of page.content) {
                    const cached = messagesRef.current[room.roomPublicId]
                    if (!cached) continue
                    const highest = highestCommittedSequence(cached)
                    if (room.lastSequence > highest) {
                        await replayGap(room.roomPublicId, highest)
                    }
                }
            } catch {
                // WebSocket은 동기화 barrier가 아니다. 다음 REST 재시도/선택에서 복구한다.
            }
        })().finally(() => {
            syncInFlightRef.current = null
        })
        syncInFlightRef.current = sync
        return sync
    }, [replayGap, runtime, updateRooms])
    syncOnConnectRef.current = syncOnConnect

    const handleEvent = useCallback(
        (event: ChatEventResponse) => {
            if (!rememberEvent(seenEventIdsRef.current, event.eventId)) return

            if (event.eventType === 'MESSAGE_CREATED') {
                const { message } = event.payload
                const room = roomsRef.current.find(
                    (candidate) =>
                        candidate.roomPublicId === event.roomPublicId,
                )
                const cached = messagesRef.current[event.roomPublicId]
                const highest = cached
                    ? highestCommittedSequence(cached)
                    : (room?.lastSequence ?? 0)

                if (message.roomSequence > highest + 1) {
                    void replayGap(event.roomPublicId, highest).catch(() => {
                        if (selectedRoomRef.current === event.roomPublicId) {
                            setConversationError(
                                '메시지 순서를 복구하지 못했습니다. 다시 불러와 주세요.',
                            )
                        }
                    })
                } else {
                    updateMessages(event.roomPublicId, (current) =>
                        mergeChatMessages(current, [message]),
                    )
                }

                updateRooms((current) =>
                    current.map((candidate) =>
                        candidate.roomPublicId === event.roomPublicId
                            ? roomAfterMessage(
                                  candidate,
                                  message,
                                  selectedRoomRef.current ===
                                      event.roomPublicId &&
                                      conversationVisibleRef.current,
                              )
                            : candidate,
                    ),
                )

                if (!room) {
                    void refreshRoom(event.roomPublicId).catch(() => {
                        void loadRooms(false)
                    })
                }

                if (
                    selectedRoomRef.current === event.roomPublicId &&
                    conversationVisibleRef.current &&
                    !message.sentByMe
                ) {
                    void markRead(event.roomPublicId, message.roomSequence)
                }
                return
            }

            if (event.eventType === 'READ_UPDATED') {
                const { readerMemberPublicId, throughSequence } = event.payload
                updateRooms((current) =>
                    current.map((room) => {
                        if (room.roomPublicId !== event.roomPublicId)
                            return room
                        const mine = readerMemberPublicId === user.userPublicId
                        if (!mine) {
                            return {
                                ...room,
                                counterpartLastReadSequence: Math.max(
                                    room.counterpartLastReadSequence,
                                    throughSequence,
                                ),
                            }
                        }
                        const lastReadSequence = Math.max(
                            room.lastReadSequence,
                            throughSequence,
                        )
                        return {
                            ...room,
                            lastReadSequence,
                            unreadCount: Math.max(
                                0,
                                room.lastSequence - lastReadSequence,
                            ),
                        }
                    }),
                )
                return
            }

            void refreshRoom(event.roomPublicId).catch(() => {
                setActionError(
                    '차단 상태가 변경되었습니다. 대화 목록을 새로고침해 주세요.',
                )
            })
        },
        [
            loadRooms,
            markRead,
            refreshRoom,
            replayGap,
            updateMessages,
            updateRooms,
            user,
        ],
    )
    handleEventRef.current = handleEvent

    useEffect(() => {
        if (!bootstrapped) return
        const realtime = runtime.createRealtimeClient()
        realtime.connect(accessToken, {
            onEvent: (event) => handleEventRef.current(event),
            onStatus: (status) => {
                setRealtimeStatus(status)
                if (status === 'connected') void syncOnConnectRef.current()
            },
            onError: () => {
                // 상세 오류는 REST 정본을 가리지 않고 연결 상태 문구로만 안내한다.
            },
        })
        return () => {
            void realtime.disconnect()
        }
    }, [accessToken, bootstrapped, runtime])

    const toggleBlock = useCallback(async () => {
        const roomPublicId = selectedRoomRef.current
        const room = roomsRef.current.find(
            (candidate) => candidate.roomPublicId === roomPublicId,
        )
        if (!room) return false

        setActionPending(true)
        setActionError(null)
        try {
            if (room.blockedByMe) await runtime.rest.unblock(room.roomPublicId)
            else await runtime.rest.block(room.roomPublicId)
            const refreshed = await refreshRoom(room.roomPublicId)
            setNotice(
                refreshed.blockedByMe
                    ? '상대를 차단했습니다. 기존 대화와 신고 기능은 유지됩니다.'
                    : '차단을 해제했습니다. 상대의 상태에 따라 메시지를 보낼 수 있습니다.',
            )
            return true
        } catch (error) {
            setActionError(chatBlockErrorMessage(error))
            return false
        } finally {
            setActionPending(false)
        }
    }, [refreshRoom, runtime])

    const reportMessage = useCallback(
        async (
            messagePublicId: string,
            reason: ChatReportReason,
            detail?: string,
        ) => {
            const roomPublicId = selectedRoomRef.current
            if (!roomPublicId) return false
            setActionPending(true)
            setActionError(null)
            try {
                await runtime.rest.report(roomPublicId, {
                    messagePublicId,
                    reason,
                    detail: detail?.trim() || undefined,
                })
                setNotice(
                    '신고를 접수했습니다. 신고만으로 메시지가 삭제되거나 계정이 정지되지는 않습니다.',
                )
                return true
            } catch (error) {
                setActionError(chatReportErrorMessage(error))
                return false
            } finally {
                setActionPending(false)
            }
        },
        [runtime],
    )

    const startDraft = useCallback(
        (counterpartNickname: string) => {
            const nickname = counterpartNickname.trim()
            if (!nickname) return false
            const existing = roomsRef.current.find(
                ({ counterpart }) => counterpart.nickname === nickname,
            )
            if (existing) {
                selectRoom(existing.roomPublicId)
                return true
            }
            const roomPublicId = `${DRAFT_ROOM_PREFIX}${encodeURIComponent(nickname)}`
            const now = runtime.now()
            const draftRoom: ChatRoomResponse = {
                roomPublicId,
                counterpart: {
                    memberPublicId: '',
                    nickname,
                },
                lastMessage: null,
                lastSequence: 0,
                lastReadSequence: 0,
                counterpartLastReadSequence: 0,
                unreadCount: 0,
                blockedByMe: false,
                canSend: true,
                createdAt: now,
                lastActivityAt: now,
            }
            updateRooms((current) => mergeRooms(current, [draftRoom]))
            selectedRoomRef.current = roomPublicId
            setSelectedRoomId(roomPublicId)
            setConversationError(null)
            setSendError(null)
            setActionError(null)
            return true
        },
        [runtime, selectRoom, updateRooms],
    )

    const selectedRoom = useMemo(
        () =>
            rooms.find(({ roomPublicId }) => roomPublicId === selectedRoomId) ??
            null,
        [rooms, selectedRoomId],
    )
    const hasQueuedMessages = useMemo(
        () =>
            Object.values(messagesByRoom).some((messages) =>
                messages.some(({ delivery }) => delivery === 'queued'),
            ),
        [messagesByRoom],
    )

    return {
        rooms,
        roomsHasNext,
        selectedRoom,
        selectedRoomId,
        messages: selectedRoomId ? (messagesByRoom[selectedRoomId] ?? []) : [],
        hasOlder: selectedRoomId
            ? (messagePages[selectedRoomId]?.hasOlder ?? false)
            : false,
        roomsLoading,
        conversationLoading,
        olderLoading,
        roomsError,
        conversationError,
        sendError,
        actionError,
        notice,
        hasQueuedMessages,
        actionPending,
        realtimeStatus: online ? realtimeStatus : 'offline',
        selectRoom,
        reloadRooms: () => void loadRooms(false),
        loadMoreRooms: () => void loadRooms(true),
        loadOlder,
        sendMessage,
        retryMessage,
        toggleBlock,
        reportMessage,
        startDraft,
        clearNotice: () => setNotice(null),
        clearActionError: () => setActionError(null),
    }
}

function mergeRooms(
    current: readonly ChatRoomResponse[],
    incoming: readonly ChatRoomResponse[],
): ChatRoomResponse[] {
    const byId = new Map(current.map((room) => [room.roomPublicId, room]))
    for (const room of incoming) {
        const existing = byId.get(room.roomPublicId)
        if (!existing || room.lastSequence >= existing.lastSequence) {
            byId.set(room.roomPublicId, room)
        }
    }
    return [...byId.values()].sort((left, right) =>
        right.lastActivityAt.localeCompare(left.lastActivityAt),
    )
}

function roomAfterMessage(
    room: ChatRoomResponse,
    message: ChatMessageResponse,
    selected: boolean,
): ChatRoomResponse {
    const isNew = message.roomSequence > room.lastSequence
    if (!isNew) return room

    const readSequence =
        selected || message.sentByMe
            ? Math.max(room.lastReadSequence, message.roomSequence)
            : room.lastReadSequence
    return {
        ...room,
        lastMessage: {
            messagePublicId: message.messagePublicId,
            roomSequence: message.roomSequence,
            senderNickname: message.sender.nickname,
            bodyPreview: chatBodyPreview(message.body),
            createdAt: message.createdAt,
        },
        lastSequence: Math.max(room.lastSequence, message.roomSequence),
        lastReadSequence: readSequence,
        unreadCount:
            !selected && !message.sentByMe
                ? room.unreadCount + 1
                : Math.max(0, message.roomSequence - readSequence),
        lastActivityAt:
            message.createdAt > room.lastActivityAt
                ? message.createdAt
                : room.lastActivityAt,
    }
}

function rememberEvent(events: Set<string>, eventId: string): boolean {
    if (events.has(eventId)) return false
    events.add(eventId)
    if (events.size > 500) {
        const oldest = events.values().next().value as string | undefined
        if (oldest) events.delete(oldest)
    }
    return true
}
