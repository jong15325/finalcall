import avatar1 from '../assets/vuexy-chat-avatar-1.png'
import avatar2 from '../assets/vuexy-chat-avatar-2.png'
import avatar4 from '../assets/vuexy-chat-avatar-4.png'
import avatar7 from '../assets/vuexy-chat-avatar-7.png'
import avatar8 from '../assets/vuexy-chat-avatar-8.png'
import type { WorkbenchFixture } from '../types'

export type ChatPresence = 'online' | 'away' | 'busy' | 'offline'
export type ChatMessageSender = 'me' | 'contact'

export interface ChatMessageFixture {
    id: string
    sender: ChatMessageSender
    body: string
    time: string
    seen?: boolean
}

export interface ChatContactFixture {
    id: string
    name: string
    role: string
    avatar: string
    presence: ChatPresence
    lastMessage: string
    lastActivity: string
    unreadCount: number
    messages: readonly ChatMessageFixture[]
}

export interface ChatFixture extends WorkbenchFixture {
    profile: {
        name: string
        avatar: string
        presence: ChatPresence
    }
    contacts: readonly ChatContactFixture[]
}

export const chatFixture: ChatFixture = {
    profile: {
        name: '다온상점',
        avatar: avatar1,
        presence: 'online',
    },
    contacts: [
        {
            id: 'luna-store',
            name: '루나상점',
            role: '불의 전투도끼 판매자',
            avatar: avatar2,
            presence: 'online',
            lastMessage: '확인했습니다. 감사합니다!',
            lastActivity: '오후 2:22',
            unreadCount: 1,
            messages: [
                {
                    id: 'luna-1',
                    sender: 'me',
                    body: '안녕하세요. 경매 종료 후 바로 아이템 전달 가능할까요?',
                    time: '오후 2:18',
                    seen: true,
                },
                {
                    id: 'luna-2',
                    sender: 'contact',
                    body: '네, 낙찰 확인 후 10분 안에 전달드릴게요.',
                    time: '오후 2:20',
                },
                {
                    id: 'luna-3',
                    sender: 'contact',
                    body: '거래 중 궁금한 점은 여기 남겨 주세요.',
                    time: '오후 2:20',
                },
                {
                    id: 'luna-4',
                    sender: 'me',
                    body: '확인했습니다. 감사합니다!',
                    time: '오후 2:22',
                    seen: true,
                },
            ],
        },
        {
            id: 'wind-guild',
            name: '바람길드상점',
            role: '바람의 활 판매자',
            avatar: avatar8,
            presence: 'away',
            lastMessage: '보관함 이동까지 완료했습니다.',
            lastActivity: '오후 1:04',
            unreadCount: 0,
            messages: [
                {
                    id: 'wind-1',
                    sender: 'contact',
                    body: '낙찰된 바람의 활을 보관함으로 전달했습니다.',
                    time: '오후 1:02',
                },
                {
                    id: 'wind-2',
                    sender: 'me',
                    body: '확인했어요. 빠른 거래 감사합니다.',
                    time: '오후 1:04',
                    seen: true,
                },
            ],
        },
        {
            id: 'trust-store',
            name: '신뢰상점',
            role: '대지 방어구 판매자',
            avatar: avatar7,
            presence: 'busy',
            lastMessage: '가격 제안 확인 후 답드릴게요.',
            lastActivity: '어제',
            unreadCount: 2,
            messages: [
                {
                    id: 'trust-1',
                    sender: 'me',
                    body: '등록하신 대지 방어구 세트 가격을 문의드립니다.',
                    time: '어제 오후 8:10',
                    seen: true,
                },
                {
                    id: 'trust-2',
                    sender: 'contact',
                    body: '가격 제안 확인 후 답드릴게요.',
                    time: '어제 오후 8:13',
                },
            ],
        },
        {
            id: 'star-collector',
            name: '별빛수집가',
            role: '희귀 아이템 수집가',
            avatar: avatar4,
            presence: 'offline',
            lastMessage: '다음 경매 때 다시 연락드릴게요.',
            lastActivity: '8월 16일',
            unreadCount: 0,
            messages: [
                {
                    id: 'star-1',
                    sender: 'contact',
                    body: '이번에는 예산을 넘어서 입찰을 멈췄습니다.',
                    time: '8월 16일 오후 11:41',
                },
                {
                    id: 'star-2',
                    sender: 'contact',
                    body: '다음 경매 때 다시 연락드릴게요.',
                    time: '8월 16일 오후 11:42',
                },
            ],
        },
    ],
    shellState: {
        authSession: {
            accessToken: 'chat-preview-access',
            refreshToken: 'chat-preview-refresh',
            accessExpiresAt: '2099-01-01T00:00:00Z',
            user: {
                userPublicId: 'chat-preview-user',
                nickname: '다온상점',
                isAdmin: false,
            },
        },
        unreadMemoCount: 3,
    },
}
