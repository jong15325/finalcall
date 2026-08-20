import ChatCandidate from '../candidates/ChatCandidate'
import { chatFixture, type ChatFixture } from '../fixtures/chat'
import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = chatFixture

export default function ChatScenario({
    fixture: source,
}: {
    fixture: WorkbenchFixture
}) {
    const preview = source as ChatFixture

    return (
        <div className="w-full min-w-0 max-w-full" data-testid="chat-scenario">
            <header className="mb-5 min-w-0">
                <h1 className="text-2xl font-bold text-content-fg">
                    채팅 디자인 게이트
                </h1>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                    Vuexy 채팅 앱의 연락처·대화·작성 anatomy를 실제 FinalCall
                    AppShell과 역할형 토큰으로 검증합니다.
                </p>
            </header>
            <ChatCandidate fixture={preview} />
        </div>
    )
}
