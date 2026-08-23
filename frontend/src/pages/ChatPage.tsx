import ChatWorkspace from '@/features/chat/components/ChatWorkspace'
import { useAuthStore } from '@/store/authStore'
import { TbMessages } from 'react-icons/tb'
import PageIntro from '@/components/common/PageIntro'

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

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
            <PageIntro
                icon={TbMessages}
                eyebrow="LIVE CONVERSATION"
                title="대화"
                description="거래 상대와 실시간으로 대화하고 진행 중인 거래를 빠르게 확인하세요."
            />
            <ChatWorkspace user={user} />
        </div>
    )
}
