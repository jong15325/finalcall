import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getChatUnreadCount } from '@/lib/api/chat'
import { chatKeys } from '@/lib/queries/chat'
import { useAuthStore } from '@/store/authStore'
import { browserChatRuntime } from './chatRuntime'
import type { ChatRealtimeStatus, ChatRuntime } from './chatRuntime'
import type { ChatEventResponse } from '@/lib/api/chat'

type ChatEventListener = (event: ChatEventResponse) => void

interface ChatRealtimeContextValue {
    status: ChatRealtimeStatus
    subscribe: (listener: ChatEventListener) => () => void
    refreshUnread: () => void
}

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null)

export function ChatRealtimeProvider({
    children,
    runtime = browserChatRuntime,
}: PropsWithChildren<{ runtime?: ChatRuntime }>) {
    const queryClient = useQueryClient()
    const accessToken = useAuthStore((state) => state.accessToken)
    const userPublicId = useAuthStore((state) => state.user?.userPublicId)
    const [status, setStatus] = useState<ChatRealtimeStatus>('disconnected')
    const listenersRef = useRef(new Set<ChatEventListener>())
    const generationRef = useRef(0)
    const userPublicIdRef = useRef<string | undefined>(undefined)
    const refreshInFlightRef = useRef<Promise<void> | null>(null)
    const refreshDirtyRef = useRef(false)
    const realtimeLifecycleRef = useRef<Promise<void>>(Promise.resolve())

    const refreshUnread = useCallback(() => {
        if (!accessToken || !userPublicId) return
        if (refreshInFlightRef.current) {
            refreshDirtyRef.current = true
            return
        }

        const generation = generationRef.current
        const run = async () => {
            const fetch = async () => {
                try {
                    await queryClient.fetchQuery({
                        queryKey: chatKeys.unread(),
                        queryFn: ({ signal }) => getChatUnreadCount(signal),
                        staleTime: 0,
                    })
                } catch {
                    // 마지막 성공값을 유지하고 다음 event/focus/poll에서 복구한다.
                }
            }

            refreshDirtyRef.current = false
            await fetch()
            if (
                refreshDirtyRef.current &&
                generation === generationRef.current
            ) {
                refreshDirtyRef.current = false
                await fetch()
            }
        }
        refreshInFlightRef.current = run().finally(() => {
            if (generation === generationRef.current) {
                refreshInFlightRef.current = null
            }
        })
    }, [accessToken, queryClient, userPublicId])

    const subscribe = useCallback((listener: ChatEventListener) => {
        listenersRef.current.add(listener)
        return () => listenersRef.current.delete(listener)
    }, [])

    useEffect(() => {
        generationRef.current += 1
        const generation = generationRef.current
        refreshDirtyRef.current = false
        refreshInFlightRef.current = null
        void queryClient.cancelQueries({ queryKey: chatKeys.unread() })

        if (userPublicIdRef.current !== userPublicId) {
            queryClient.removeQueries({ queryKey: chatKeys.all })
            userPublicIdRef.current = userPublicId
        }

        if (!accessToken || !userPublicId) {
            setStatus('disconnected')
            return
        }

        let cancelled = false
        let realtime: ReturnType<ChatRuntime['createRealtimeClient']> | null =
            null
        const start = realtimeLifecycleRef.current.then(() => {
            if (cancelled || generation !== generationRef.current) return
            realtime = runtime.createRealtimeClient()
            realtime.connect(accessToken, {
                onEvent: (event) => {
                    if (generation !== generationRef.current) return
                    listenersRef.current.forEach((listener) => listener(event))
                    if (
                        event.eventType === 'MESSAGE_CREATED' ||
                        (event.eventType === 'READ_UPDATED' &&
                            event.payload.readerMemberPublicId === userPublicId)
                    ) {
                        refreshUnread()
                    }
                },
                onStatus: (nextStatus) => {
                    if (generation !== generationRef.current) return
                    setStatus(nextStatus)
                    if (nextStatus === 'connected') refreshUnread()
                },
                onError: () => {
                    // 연결 상태와 REST fallback이 복구를 안내한다.
                },
            })
        })

        const onOnline = () => refreshUnread()
        const onFocus = () => refreshUnread()
        window.addEventListener('online', onOnline)
        window.addEventListener('focus', onFocus)
        refreshUnread()

        return () => {
            cancelled = true
            generationRef.current += 1
            window.removeEventListener('online', onOnline)
            window.removeEventListener('focus', onFocus)
            realtimeLifecycleRef.current = start
                .then(async () => {
                    if (realtime) await realtime.disconnect()
                })
                .catch(() => {
                    // 종료 실패가 다음 인증 세션의 연결 직렬화를 영구 차단하지 않게 한다.
                })
        }
    }, [accessToken, queryClient, refreshUnread, runtime, userPublicId])

    const value = useMemo(
        () => ({ status, subscribe, refreshUnread }),
        [refreshUnread, status, subscribe],
    )

    return (
        <ChatRealtimeContext.Provider value={value}>
            {children}
        </ChatRealtimeContext.Provider>
    )
}

// Provider와 소비 hook을 함께 두어 context 구현을 한 파일에서 닫는다.
// eslint-disable-next-line react-refresh/only-export-components
export function useChatRealtime() {
    const context = useContext(ChatRealtimeContext)
    if (!context) {
        throw new Error('ChatRealtimeProvider 안에서 사용해야 합니다.')
    }
    return context
}
