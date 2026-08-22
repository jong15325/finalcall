import ChatWorkspace from '@/features/chat/components/ChatWorkspace'
import { useAuthStore } from '@/store/authStore'

export default function ChatPage() {
    const accessToken = useAuthStore((state) => state.accessToken)
    const user = useAuthStore((state) => state.user)

    if (!accessToken || !user) {
        return (
            <p role="status" className="py-16 text-center text-content-muted">
                채팅 세션을 준비하고 있습니다.
            </p>
        )
    }

    return <ChatWorkspace user={user} />
}
