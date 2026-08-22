import { act, render, waitFor } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRealtimeProvider, useChatRealtime } from './ChatRealtimeProvider'
import { chatKeys } from '@/lib/queries/chat'
import { useAuthStore } from '@/store/authStore'
import type { ChatRealtimeHandlers, ChatRuntime } from './chatRuntime'
import type { ChatEventResponse } from '@/lib/api/chat'

const getChatUnreadCount = vi.fn()

vi.mock('@/lib/api/chat', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/api/chat')>()),
    getChatUnreadCount: () => getChatUnreadCount(),
}))

function messageEvent(sentByMe: boolean): ChatEventResponse {
    return {
        eventVersion: 1,
        eventId: crypto.randomUUID(),
        eventType: 'MESSAGE_CREATED',
        roomPublicId: 'room-1',
        occurredAt: '2026-08-22T00:00:00Z',
        payload: {
            message: {
                messagePublicId: crypto.randomUUID(),
                clientMessageId: crypto.randomUUID(),
                roomSequence: 1,
                sender: {
                    memberPublicId: sentByMe ? 'user-1' : 'user-2',
                    nickname: sentByMe ? '나' : '상대',
                },
                body: '메시지',
                sentByMe,
                createdAt: '2026-08-22T00:00:00Z',
            },
        },
    }
}

function createRuntime(disconnectBarrier: Promise<void> = Promise.resolve()) {
    let handlers: ChatRealtimeHandlers | null = null
    let active = 0
    let maxActive = 0
    const disconnect = vi.fn(async () => {
        await disconnectBarrier
        active -= 1
    })
    const connect = vi.fn((_token: string, next: ChatRealtimeHandlers) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        handlers = next
    })
    const runtime = {
        createRealtimeClient: vi.fn(() => ({ connect, disconnect })),
    } as unknown as ChatRuntime
    return {
        runtime,
        connect,
        disconnect,
        emit(event: ChatEventResponse) {
            handlers?.onEvent(event)
        },
        connectSucceeded() {
            handlers?.onStatus('connected')
        },
        activeCount: () => active,
        maxActiveCount: () => maxActive,
    }
}

function Consumer({
    onEvent,
}: {
    onEvent: (event: ChatEventResponse) => void
}) {
    const realtime = useChatRealtime()
    useEffect(() => realtime.subscribe(onEvent), [onEvent, realtime])
    return null
}

describe('ChatRealtimeProvider', () => {
    beforeEach(() => {
        useAuthStore.setState({
            accessToken: 'token-1',
            refreshToken: 'refresh-1',
            accessExpiresAt: '2026-08-22T01:00:00Z',
            user: { userPublicId: 'user-1', nickname: '나', isAdmin: false },
        })
        getChatUnreadCount.mockReset()
        getChatUnreadCount.mockResolvedValue({ count: 0 })
    })

    it('탭당 연결 하나로 event를 fan-out하고 송수신 모두 서버 unread로 수렴한다', async () => {
        const runtime = createRuntime()
        const queryClient = new QueryClient()
        const onEvent = vi.fn()
        const view = render(
            <QueryClientProvider client={queryClient}>
                <ChatRealtimeProvider runtime={runtime.runtime}>
                    <Consumer onEvent={onEvent} />
                </ChatRealtimeProvider>
            </QueryClientProvider>,
        )

        await waitFor(() => expect(runtime.connect).toHaveBeenCalledOnce())
        expect(runtime.runtime.createRealtimeClient).toHaveBeenCalledOnce()
        await waitFor(() => expect(getChatUnreadCount).toHaveBeenCalled())
        getChatUnreadCount.mockClear()

        act(() => {
            runtime.emit(messageEvent(true))
            runtime.emit(messageEvent(false))
        })

        expect(onEvent).toHaveBeenCalledTimes(2)
        await waitFor(() => expect(getChatUnreadCount).toHaveBeenCalled())
        expect(queryClient.getQueryData(chatKeys.unread())).toEqual({
            count: 0,
        })
        view.unmount()
        await waitFor(() => expect(runtime.disconnect).toHaveBeenCalledOnce())
    })

    it('event 폭주를 진행 중 1회와 trailing 1회로 합친다', async () => {
        let resolveFirst!: (value: { count: number }) => void
        let resolveTrailing!: (value: { count: number }) => void
        getChatUnreadCount
            .mockImplementationOnce(
                () =>
                    new Promise<{ count: number }>((resolve) => {
                        resolveFirst = resolve
                    }),
            )
            .mockImplementationOnce(
                () =>
                    new Promise<{ count: number }>((resolve) => {
                        resolveTrailing = resolve
                    }),
            )
        const runtime = createRuntime()
        const queryClient = new QueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <ChatRealtimeProvider runtime={runtime.runtime}>
                    <div />
                </ChatRealtimeProvider>
            </QueryClientProvider>,
        )
        await waitFor(() => expect(getChatUnreadCount).toHaveBeenCalledOnce())

        act(() => {
            runtime.emit(messageEvent(false))
            runtime.emit(messageEvent(false))
            runtime.connectSucceeded()
        })
        expect(getChatUnreadCount).toHaveBeenCalledOnce()
        resolveFirst({ count: 2 })

        await waitFor(() => expect(getChatUnreadCount).toHaveBeenCalledTimes(2))
        act(() => {
            runtime.emit(messageEvent(false))
            runtime.emit(messageEvent(false))
        })
        resolveTrailing({ count: 4 })
        await act(async () => Promise.resolve())
        expect(getChatUnreadCount).toHaveBeenCalledTimes(2)
    })

    it('StrictMode 재설정도 transport 하나만 활성화한다', async () => {
        const runtime = createRuntime()
        const queryClient = new QueryClient()
        const view = render(
            <QueryClientProvider client={queryClient}>
                <StrictMode>
                    <ChatRealtimeProvider runtime={runtime.runtime}>
                        <div />
                    </ChatRealtimeProvider>
                </StrictMode>
            </QueryClientProvider>,
        )
        await waitFor(() => expect(runtime.connect).toHaveBeenCalledOnce())
        expect(runtime.maxActiveCount()).toBe(1)
        view.unmount()
        await waitFor(() => expect(runtime.activeCount()).toBe(0))
    })

    it('token 전환은 disconnect 완료 뒤 재연결하고 logout에서 정리한다', async () => {
        let releaseDisconnect!: () => void
        const disconnectBarrier = new Promise<void>((resolve) => {
            releaseDisconnect = resolve
        })
        const runtime = createRuntime(disconnectBarrier)
        const queryClient = new QueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <ChatRealtimeProvider runtime={runtime.runtime}>
                    <div />
                </ChatRealtimeProvider>
            </QueryClientProvider>,
        )
        await waitFor(() => expect(runtime.connect).toHaveBeenCalledOnce())

        act(() => {
            useAuthStore.setState({ accessToken: 'token-2' })
        })

        await waitFor(() => expect(runtime.disconnect).toHaveBeenCalledOnce())
        expect(runtime.connect).toHaveBeenCalledOnce()
        expect(runtime.activeCount()).toBe(1)
        releaseDisconnect()
        await waitFor(() => expect(runtime.connect).toHaveBeenCalledTimes(2))
        expect(runtime.maxActiveCount()).toBe(1)

        act(() => useAuthStore.getState().clearSession())
        await waitFor(() => expect(runtime.disconnect).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(runtime.activeCount()).toBe(0))
        expect(runtime.connect).toHaveBeenCalledTimes(2)
    })
})
