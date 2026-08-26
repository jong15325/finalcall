import { describe, expect, it } from 'vitest'
import {
    highestCommittedSequence,
    mergeChatMessages,
    toTimelineMessage,
    upsertOptimisticMessage,
    validateChatBody,
} from './chatTimeline'
import type { ChatMessageResponse } from '@/lib/api/chat'

const member = { memberPublicId: 'U-1', nickname: '다온상점' }

function message(
    roomSequence: number,
    overrides: Partial<ChatMessageResponse> = {},
): ChatMessageResponse {
    return {
        messagePublicId: `M-${roomSequence}`,
        clientMessageId: `00000000-0000-4000-8000-00000000000${roomSequence}`,
        roomSequence,
        sender: member,
        body: `메시지 ${roomSequence}`,
        sentByMe: true,
        createdAt: `2026-08-18T10:0${roomSequence}:00Z`,
        ...overrides,
    }
}

describe('chatTimeline', () => {
    it('본문을 NFC로 정규화하고 계약의 공백·제어문자·길이 한도를 검증한다', () => {
        expect(validateChatBody('e\u0301')).toEqual({
            body: 'é',
            error: null,
        })
        expect(validateChatBody(' \n\t ').error).toBe('메시지를 입력해 주세요.')
        expect(
            validateChatBody(`허용 안 됨${String.fromCharCode(1)}`).error,
        ).toBe('메시지에 사용할 수 없는 제어 문자가 포함되어 있습니다.')
        expect(validateChatBody('🙂'.repeat(1_000)).error).toBeNull()
        expect(validateChatBody('🙂'.repeat(1_001)).error).toBe(
            '메시지는 1,000자까지 입력할 수 있습니다.',
        )
    })

    it('낙관 메시지를 같은 clientMessageId 서버 응답으로 교체한다', () => {
        const optimistic = {
            ...message(1),
            messagePublicId: null,
            roomSequence: null,
            delivery: 'sending' as const,
        }
        const pending = upsertOptimisticMessage([], optimistic)
        const committed = mergeChatMessages(pending, [message(1)])

        expect(committed).toHaveLength(1)
        expect(committed[0]).toMatchObject({
            messagePublicId: 'M-1',
            roomSequence: 1,
            delivery: 'sent',
        })
    })

    it('서버 이벤트가 먼저 도착한 초안 메시지를 하나로 수렴한다', () => {
        const optimistic = {
            ...message(1),
            messagePublicId: null,
            roomSequence: null,
            delivery: 'sending' as const,
        }
        const committed = message(1)

        const merged = mergeChatMessages(
            [toTimelineMessage(committed), optimistic],
            [committed],
        )

        expect(merged).toEqual([toTimelineMessage(committed)])
    })

    it('publicId·sequence 중복을 제거하고 권위 sequence로 정렬한다', () => {
        const merged = mergeChatMessages(
            [],
            [message(3), message(1), message(2)],
        )
        const duplicated = mergeChatMessages(merged, [
            message(2, { body: '서버 최신 본문' }),
        ])

        expect(duplicated.map(({ roomSequence }) => roomSequence)).toEqual([
            1, 2, 3,
        ])
        expect(duplicated[1].body).toBe('서버 최신 본문')
        expect(highestCommittedSequence(duplicated)).toBe(3)
    })
})
