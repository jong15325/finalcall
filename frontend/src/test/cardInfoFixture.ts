import type { CardInfoResponse } from '@/lib/api/cardInfo'

export function cardInfoFixture(
    overrides: Partial<CardInfoResponse> = {},
): CardInfoResponse {
    return {
        level: 3,
        shortName: 'Lv.3 불도',
        formalName: '3레벨 도끼',
        category: { code: 1, label: '무기' },
        kind: { code: 1, label: '도끼', abbreviation: '도' },
        element: { code: 2, label: '불', abbreviation: '불' },
        channelLimit: { code: 'BEGINNER', label: '초보채널 이상' },
        frame: { type: 'BLACK', label: '블랙', remainingGoldforceDays: 0 },
        skills: [
            { slot: 1, code: 11, name: '공격시간 3 감소', percent: null },
            { slot: 2, code: 202, name: '트리플샷', percent: 33 },
        ],
        calculatedAt: '2026-08-23T00:00:00Z',
        validUntil: null,
        ...overrides,
    }
}
