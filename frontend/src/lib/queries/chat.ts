import { useQuery } from '@tanstack/react-query'
import { getChatUnreadCount } from '@/lib/api/chat'
import { useIsAuthenticated } from '@/store/authStore'
import type { ChatUnreadCountResponse } from '@/lib/api/chat'

export const chatKeys = {
    all: ['chat'] as const,
    unread: () => [...chatKeys.all, 'unread'] as const,
}

/** 상단·모바일 drawer가 공유하는 전체 채팅 미열람 수. */
export function useUnreadChatCount() {
    const isAuthenticated = useIsAuthenticated()

    return useQuery<ChatUnreadCountResponse>({
        queryKey: chatKeys.unread(),
        queryFn: ({ signal }) => getChatUnreadCount(signal),
        enabled: isAuthenticated,
        staleTime: 15_000,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    })
}
