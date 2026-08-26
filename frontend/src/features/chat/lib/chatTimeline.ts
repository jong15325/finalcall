import type { ChatMemberResponse, ChatMessageResponse } from '@/lib/api/chat'

export type ChatDeliveryState = 'sent' | 'sending' | 'queued' | 'failed'

/** 서버 DTO와 낙관 상태를 분리한 화면 전용 메시지 모델. */
export interface ChatTimelineMessage {
    messagePublicId: string | null
    clientMessageId: string
    roomSequence: number | null
    sender: ChatMemberResponse
    body: string
    sentByMe: boolean
    createdAt: string
    delivery: ChatDeliveryState
}

export interface ChatBodyValidation {
    body: string
    error: string | null
}

export function validateChatBody(value: string): ChatBodyValidation {
    const body = value.normalize('NFC')
    if (body.trim().length === 0) {
        return { body, error: '메시지를 입력해 주세요.' }
    }
    if (
        [...body].some((character) => {
            const codePoint = character.codePointAt(0) ?? 0
            return codePoint <= 31 && codePoint !== 9 && codePoint !== 10
        })
    ) {
        return {
            body,
            error: '메시지에 사용할 수 없는 제어 문자가 포함되어 있습니다.',
        }
    }
    if ([...body].length > 1_000) {
        return { body, error: '메시지는 1,000자까지 입력할 수 있습니다.' }
    }
    if (new TextEncoder().encode(body).length > 4_000) {
        return {
            body,
            error: '메시지는 UTF-8 기준 4,000바이트까지 보낼 수 있습니다.',
        }
    }
    return { body, error: null }
}

export function toTimelineMessage(
    message: ChatMessageResponse,
): ChatTimelineMessage {
    return { ...message, delivery: 'sent' }
}

export function mergeChatMessages(
    current: readonly ChatTimelineMessage[],
    incoming: readonly ChatMessageResponse[],
): ChatTimelineMessage[] {
    const next = [...current]

    for (const message of incoming) {
        const matchingIndexes = next.flatMap((candidate, index) =>
            candidate.messagePublicId === message.messagePublicId ||
            (candidate.roomSequence !== null &&
                candidate.roomSequence === message.roomSequence) ||
            (candidate.sentByMe &&
                message.sentByMe &&
                candidate.clientMessageId === message.clientMessageId)
                ? [index]
                : [],
        )
        const committed = toTimelineMessage(message)
        if (matchingIndexes.length === 0) {
            next.push(committed)
            continue
        }

        next[matchingIndexes[0]] = committed
        for (let index = matchingIndexes.length - 1; index >= 1; index -= 1) {
            next.splice(matchingIndexes[index], 1)
        }
    }

    return sortTimeline(next)
}

export function upsertOptimisticMessage(
    current: readonly ChatTimelineMessage[],
    optimistic: ChatTimelineMessage,
): ChatTimelineMessage[] {
    const index = current.findIndex(
        ({ clientMessageId }) => clientMessageId === optimistic.clientMessageId,
    )
    const next = [...current]
    if (index >= 0) next[index] = optimistic
    else next.push(optimistic)
    return sortTimeline(next)
}

export function highestCommittedSequence(
    messages: readonly ChatTimelineMessage[],
): number {
    return messages.reduce(
        (highest, message) =>
            message.roomSequence === null
                ? highest
                : Math.max(highest, message.roomSequence),
        0,
    )
}

export function chatBodyPreview(body: string): string {
    return [...body].slice(0, 80).join('')
}

function sortTimeline(messages: ChatTimelineMessage[]): ChatTimelineMessage[] {
    return messages.sort((left, right) => {
        if (left.roomSequence !== null && right.roomSequence !== null) {
            return left.roomSequence - right.roomSequence
        }
        if (left.roomSequence !== null) return -1
        if (right.roomSequence !== null) return 1
        return left.createdAt.localeCompare(right.createdAt)
    })
}
