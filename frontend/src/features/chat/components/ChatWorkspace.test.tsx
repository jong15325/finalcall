import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatWorkspace from './ChatWorkspace'
import type {
    ChatEventResponse,
    ChatMessageListQuery,
    ChatMessageResponse,
    ChatRoomResponse,
} from '@/lib/api/chat'
import type {
    ChatRealtimeHandlers,
    ChatRestAdapter,
    ChatRuntime,
} from '../lib/chatRuntime'

const CURRENT_USER = {
    userPublicId: 'member-me',
    nickname: '나',
    isAdmin: false,
}
const CLIENT_MESSAGE_ID = '00000000-0000-4000-8000-000000000001'

function message(
    roomSequence: number,
    body: string,
    sentByMe = false,
): ChatMessageResponse {
    return {
        messagePublicId: `message-${roomSequence}`,
        clientMessageId: `00000000-0000-4000-8000-${String(roomSequence).padStart(12, '0')}`,
        roomSequence,
        sender: sentByMe
            ? {
                  memberPublicId: CURRENT_USER.userPublicId,
                  nickname: CURRENT_USER.nickname,
              }
            : { memberPublicId: 'member-luna', nickname: '루나상점' },
        body,
        sentByMe,
        createdAt: `2026-08-18T09:0${roomSequence}:00Z`,
    }
}

function room(overrides: Partial<ChatRoomResponse> = {}): ChatRoomResponse {
    return {
        roomPublicId: 'room-1',
        counterpart: {
            memberPublicId: 'member-luna',
            nickname: '루나상점',
        },
        lastMessage: {
            messagePublicId: 'message-1',
            roomSequence: 1,
            senderNickname: '루나상점',
            bodyPreview: '안녕하세요.',
            createdAt: '2026-08-18T09:01:00Z',
        },
        lastSequence: 1,
        lastReadSequence: 0,
        counterpartLastReadSequence: 0,
        unreadCount: 1,
        blockedByMe: false,
        canSend: true,
        createdAt: '2026-08-18T09:00:00Z',
        lastActivityAt: '2026-08-18T09:01:00Z',
        ...overrides,
    }
}

function createMockRuntime({
    initiallyOnline = true,
    rooms: initialRooms = [room()],
}: {
    initiallyOnline?: boolean
    rooms?: ChatRoomResponse[]
} = {}) {
    let online = initiallyOnline
    let networkListener: ((online: boolean) => void) | null = null
    let realtimeHandlers: ChatRealtimeHandlers | null = null
    let currentRooms = initialRooms
    const messagesByRoom: Record<string, ChatMessageResponse[]> =
        Object.fromEntries(
            initialRooms.map(({ roomPublicId }) => [
                roomPublicId,
                [message(1, '안녕하세요.')],
            ]),
        )

    const rest: ChatRestAdapter = {
        sendDirectMessage: vi.fn(async (body) => ({
            room:
                currentRooms[0] ??
                room({
                    counterpart: {
                        memberPublicId: 'member-new',
                        nickname: body.counterpartNickname,
                    },
                }),
            message: {
                ...message(2, body.body, true),
                clientMessageId: body.clientMessageId,
            },
            roomCreated: true,
            deduplicated: false,
        })),
        listRooms: vi.fn(async () => ({
            content: currentRooms,
            nextCursor: null,
            hasNext: false,
        })),
        getRoom: vi.fn(async (roomPublicId: string) => {
            const found = currentRooms.find(
                (candidate) => candidate.roomPublicId === roomPublicId,
            )
            if (!found) throw new Error('대화를 찾을 수 없습니다.')
            return found
        }),
        getMessages: vi.fn(
            async (roomPublicId: string, query: ChatMessageListQuery = {}) => {
                const messages = messagesByRoom[roomPublicId] ?? []
                if (query.afterSequence !== undefined) {
                    return {
                        content: messages.filter(
                            ({ roomSequence }) =>
                                roomSequence > (query.afterSequence ?? 0),
                        ),
                        nextCursor: null,
                        hasNext: false,
                    }
                }
                return {
                    content: messages,
                    nextCursor: null,
                    hasNext: false,
                }
            },
        ),
        sendMessage: vi.fn(async (_roomPublicId, body) => ({
            message: {
                ...message(2, body.body, true),
                clientMessageId: body.clientMessageId,
            },
            deduplicated: false,
        })),
        updateRead: vi.fn(async (_roomPublicId, throughSequence) => ({
            lastReadSequence: throughSequence,
            readAt: '2026-08-18T09:10:00Z',
        })),
        block: vi.fn(async () => {
            currentRooms = currentRooms.map((candidate) =>
                candidate.roomPublicId === 'room-1'
                    ? { ...candidate, blockedByMe: true, canSend: false }
                    : candidate,
            )
        }),
        unblock: vi.fn(async () => {
            currentRooms = currentRooms.map((candidate) =>
                candidate.roomPublicId === 'room-1'
                    ? { ...candidate, blockedByMe: false, canSend: true }
                    : candidate,
            )
        }),
        report: vi.fn(async () => ({
            reportPublicId: 'report-1',
            createdAt: '2026-08-18T09:10:00Z',
        })),
    }

    const runtime: ChatRuntime = {
        rest,
        createRealtimeClient: () => ({
            connect: (_accessToken, handlers) => {
                realtimeHandlers = handlers
            },
            disconnect: vi.fn(async () => undefined),
        }),
        createClientMessageId: () => CLIENT_MESSAGE_ID,
        isOnline: () => online,
        now: () => '2026-08-18T09:10:00Z',
        listenNetworkStatus: (listener) => {
            networkListener = listener
            return () => {
                networkListener = null
            }
        },
    }

    return {
        runtime,
        rest,
        emit(event: ChatEventResponse) {
            act(() => realtimeHandlers?.onEvent(event))
        },
        setMessages(messages: ChatMessageResponse[], roomPublicId = 'room-1') {
            messagesByRoom[roomPublicId] = messages
        },
        setRoom(nextRoom: ChatRoomResponse) {
            currentRooms = currentRooms.map((candidate) =>
                candidate.roomPublicId === nextRoom.roomPublicId
                    ? nextRoom
                    : candidate,
            )
        },
        setOnline(value: boolean) {
            online = value
            act(() => networkListener?.(value))
        },
    }
}

async function openConversation() {
    const openButton = await screen.findByRole('button', {
        name: /루나상점 대화 열기/,
    })
    await userEvent.click(openButton)
    expect(await screen.findAllByText('안녕하세요.')).not.toHaveLength(0)
}

beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatWorkspace', () => {
    it('모바일 목록에서 대화로 이동하고 동일 clientMessageId로 optimistic 전송을 수렴한다', async () => {
        const mock = createMockRuntime()
        const view = render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )

        const list = view.container.querySelector('[data-chat-list]')!
        const conversation = view.container.querySelector(
            '[data-chat-conversation]',
        )!
        expect(list).toHaveClass('flex')
        expect(conversation).toHaveClass('hidden')
        await waitFor(() => expect(mock.rest.getMessages).toHaveBeenCalled())
        expect(mock.rest.updateRead).not.toHaveBeenCalled()

        await openConversation()
        expect(list).toHaveClass('hidden')
        expect(conversation).toHaveClass('flex')
        await waitFor(() =>
            expect(mock.rest.updateRead).toHaveBeenCalledWith('room-1', 1),
        )

        const form = screen.getByRole('form', { name: '메시지 작성' })
        const input = within(form).getByRole('textbox', {
            name: '메시지 입력',
        })
        await userEvent.type(input, '지금 접속할게요.')
        await userEvent.click(
            within(form).getByRole('button', { name: '메시지 보내기' }),
        )

        await waitFor(() =>
            expect(mock.rest.sendMessage).toHaveBeenCalledWith('room-1', {
                clientMessageId: CLIENT_MESSAGE_ID,
                body: '지금 접속할게요.',
            }),
        )
        const selectedConversation = screen.getByLabelText('선택한 대화')
        expect(
            within(selectedConversation).getAllByText('지금 접속할게요.'),
        ).toHaveLength(1)

        mock.emit({
            eventId: 'event-2',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-1',
            occurredAt: '2026-08-18T09:10:00Z',
            payload: {
                message: {
                    ...message(2, '지금 접속할게요.', true),
                    clientMessageId: CLIENT_MESSAGE_ID,
                },
            },
        })
        expect(
            within(selectedConversation).getAllByText('지금 접속할게요.'),
        ).toHaveLength(1)
    })

    it('sequence gap을 afterSequence REST replay로 채우고 중복 event를 무시한다', async () => {
        const mock = createMockRuntime()
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )
        await openConversation()
        mock.setMessages([
            message(1, '안녕하세요.'),
            message(2, '중간 메시지'),
            message(3, '실시간 메시지'),
        ])
        mock.setRoom(
            room({
                lastMessage: {
                    messagePublicId: 'message-3',
                    roomSequence: 3,
                    senderNickname: '루나상점',
                    bodyPreview: '실시간 메시지',
                    createdAt: '2026-08-18T09:03:00Z',
                },
                lastSequence: 3,
                unreadCount: 3,
                lastActivityAt: '2026-08-18T09:03:00Z',
            }),
        )
        const event: ChatEventResponse = {
            eventId: 'event-gap',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-1',
            occurredAt: '2026-08-18T09:03:00Z',
            payload: { message: message(3, '실시간 메시지') },
        }

        mock.emit(event)
        await waitFor(() =>
            expect(mock.rest.getMessages).toHaveBeenCalledWith('room-1', {
                afterSequence: 1,
                size: 100,
            }),
        )
        expect(await screen.findByText('중간 메시지')).toBeVisible()
        const conversation = screen.getByLabelText('선택한 대화')
        expect(within(conversation).getAllByText('실시간 메시지')).toHaveLength(
            1,
        )

        mock.emit(event)
        expect(within(conversation).getAllByText('실시간 메시지')).toHaveLength(
            1,
        )
    })

    it('비선택 방의 1→gap 3과 뒤늦은 2를 replay하고 REST unread·미리보기로 수렴한다', async () => {
        const secondRoom = room({
            roomPublicId: 'room-2',
            counterpart: {
                memberPublicId: 'member-wind',
                nickname: '바람상점',
            },
            lastMessage: {
                messagePublicId: 'room-2-message-1',
                roomSequence: 1,
                senderNickname: '바람상점',
                bodyPreview: '첫 번째 메시지',
                createdAt: '2026-08-18T09:01:00Z',
            },
        })
        const mock = createMockRuntime({ rooms: [room(), secondRoom] })
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )
        await screen.findByRole('button', { name: /바람상점 대화 열기/ })

        const second = (sequence: number, body: string) => ({
            ...message(sequence, body),
            messagePublicId: `room-2-message-${sequence}`,
        })
        mock.setMessages(
            [
                second(1, '첫 번째 메시지'),
                second(2, '두 번째 메시지'),
                second(3, '세 번째 메시지'),
            ],
            'room-2',
        )
        mock.setRoom({
            ...secondRoom,
            lastMessage: {
                messagePublicId: 'room-2-message-3',
                roomSequence: 3,
                senderNickname: '바람상점',
                bodyPreview: '세 번째 메시지',
                createdAt: '2026-08-18T09:03:00Z',
            },
            lastSequence: 3,
            lastReadSequence: 0,
            unreadCount: 3,
            lastActivityAt: '2026-08-18T09:03:00Z',
        })

        mock.emit({
            eventId: 'room-2-event-3',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-2',
            occurredAt: '2026-08-18T09:03:00Z',
            payload: { message: second(3, '세 번째 메시지') },
        })
        mock.emit({
            eventId: 'room-2-event-2',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-2',
            occurredAt: '2026-08-18T09:02:00Z',
            payload: { message: second(2, '두 번째 메시지') },
        })

        await waitFor(() =>
            expect(mock.rest.getMessages).toHaveBeenCalledWith('room-2', {
                afterSequence: 1,
                size: 100,
            }),
        )
        const roomButton = await screen.findByRole('button', {
            name: '바람상점 대화 열기, 읽지 않은 메시지 3개',
        })
        expect(within(roomButton).getByText('세 번째 메시지')).toBeVisible()
        expect(within(roomButton).queryByText('두 번째 메시지')).toBeNull()

        mock.emit({
            eventId: 'room-2-event-3-late',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-2',
            occurredAt: '2026-08-18T09:03:00Z',
            payload: { message: second(3, '동일 순서의 뒤늦은 메시지') },
        })
        expect(within(roomButton).getByText('세 번째 메시지')).toBeVisible()
        expect(
            within(roomButton).queryByText('동일 순서의 뒤늦은 메시지'),
        ).toBeNull()
    })

    it('같은 gap 메시지의 중복 event는 replay 한 번과 timeline 한 건으로 수렴한다', async () => {
        const mock = createMockRuntime()
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )
        await openConversation()
        mock.setMessages([
            message(1, '안녕하세요.'),
            message(2, '중간 메시지'),
            message(3, '중복 대상 메시지'),
        ])
        mock.setRoom(
            room({
                lastMessage: {
                    messagePublicId: 'message-3',
                    roomSequence: 3,
                    senderNickname: '루나상점',
                    bodyPreview: '중복 대상 메시지',
                    createdAt: '2026-08-18T09:03:00Z',
                },
                lastSequence: 3,
                unreadCount: 3,
                lastActivityAt: '2026-08-18T09:03:00Z',
            }),
        )
        const duplicateMessage = message(3, '중복 대상 메시지')

        mock.emit({
            eventId: 'event-gap-a',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-1',
            occurredAt: '2026-08-18T09:03:00Z',
            payload: { message: duplicateMessage },
        })
        mock.emit({
            eventId: 'event-gap-b',
            eventVersion: 1,
            eventType: 'MESSAGE_CREATED',
            roomPublicId: 'room-1',
            occurredAt: '2026-08-18T09:03:00Z',
            payload: { message: duplicateMessage },
        })

        expect(await screen.findByText('중복 대상 메시지')).toBeVisible()
        const replayCalls = vi
            .mocked(mock.rest.getMessages)
            .mock.calls.filter(([, query]) => query?.afterSequence === 1)
        expect(replayCalls).toHaveLength(1)
        expect(
            within(screen.getByLabelText('선택한 대화')).getAllByText(
                '중복 대상 메시지',
            ),
        ).toHaveLength(1)
    })

    it('오프라인 메시지를 queued로 두었다가 같은 ID로 자동 재전송한다', async () => {
        const mock = createMockRuntime({ initiallyOnline: false })
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )
        await openConversation()

        const form = screen.getByRole('form', { name: '메시지 작성' })
        await userEvent.type(
            within(form).getByRole('textbox', { name: '메시지 입력' }),
            '오프라인 메시지',
        )
        await userEvent.click(
            within(form).getByRole('button', { name: '메시지 보내기' }),
        )
        expect(mock.rest.sendMessage).not.toHaveBeenCalled()
        expect(screen.getByText('연결 후 전송')).toBeVisible()
        expect(
            screen.getByText(/이 화면의 메모리에만 임시 보관됩니다/),
        ).toBeVisible()

        const beforeUnload = new Event('beforeunload', {
            cancelable: true,
        })
        expect(window.dispatchEvent(beforeUnload)).toBe(false)

        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
        const routeLink = document.createElement('a')
        routeLink.href = '/auctions'
        routeLink.textContent = '경매로 이동'
        document.body.append(routeLink)
        const routeClick = new MouseEvent('click', {
            bubbles: true,
            button: 0,
            cancelable: true,
        })
        expect(routeLink.dispatchEvent(routeClick)).toBe(false)
        expect(confirm).toHaveBeenCalledWith(
            '전송 대기 메시지는 다른 화면으로 이동하면 사라집니다. 이동하시겠습니까?',
        )
        routeLink.remove()
        confirm.mockRestore()

        mock.setOnline(true)
        await waitFor(() =>
            expect(mock.rest.sendMessage).toHaveBeenCalledWith('room-1', {
                clientMessageId: CLIENT_MESSAGE_ID,
                body: '오프라인 메시지',
            }),
        )
    })

    it('상대 선택은 서버 호출 없는 초안이며 첫 메시지에서만 방과 메시지를 생성한다', async () => {
        const mock = createMockRuntime({ rooms: [] })
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )

        await userEvent.click(
            await screen.findByRole('button', { name: '새 대화 시작' }),
        )
        await userEvent.type(
            screen.getByRole('textbox', { name: '상대 닉네임' }),
            '새상대',
        )
        await userEvent.click(screen.getByRole('button', { name: '대화 작성' }))

        expect(mock.rest.sendDirectMessage).not.toHaveBeenCalled()
        const form = await screen.findByRole('form', { name: '메시지 작성' })
        await userEvent.type(
            within(form).getByRole('textbox', { name: '메시지 입력' }),
            '첫 메시지',
        )
        await userEvent.click(
            within(form).getByRole('button', { name: '메시지 보내기' }),
        )

        await waitFor(() =>
            expect(mock.rest.sendDirectMessage).toHaveBeenCalledWith({
                counterpartNickname: '새상대',
                clientMessageId: CLIENT_MESSAGE_ID,
                body: '첫 메시지',
            }),
        )
        expect(mock.rest.sendMessage).not.toHaveBeenCalled()
    })

    it('메시지 기록은 추가분 live log이며 하단 근처에서만 reduced-motion 방식으로 스크롤한다', async () => {
        const originalMatchMedia = window.matchMedia
        window.matchMedia = vi.fn((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        const mock = createMockRuntime()

        try {
            render(
                <ChatWorkspace
                    accessToken="access-token"
                    runtime={mock.runtime}
                    user={CURRENT_USER}
                />,
            )
            await openConversation()
            const log = screen.getByRole('log', {
                name: '루나상점 메시지 기록',
            })
            expect(log).toHaveAttribute('aria-live', 'polite')
            expect(log).toHaveAttribute('aria-relevant', 'additions')
            expect(log).toHaveAttribute('aria-busy', 'false')

            Object.defineProperties(log, {
                scrollHeight: { configurable: true, value: 1_000 },
                clientHeight: { configurable: true, value: 400 },
                scrollTop: { configurable: true, value: 100, writable: true },
            })
            fireEvent.scroll(log)
            vi.mocked(Element.prototype.scrollIntoView).mockClear()
            mock.emit({
                eventId: 'event-no-scroll',
                eventVersion: 1,
                eventType: 'MESSAGE_CREATED',
                roomPublicId: 'room-1',
                occurredAt: '2026-08-18T09:02:00Z',
                payload: { message: message(2, '스크롤 유지 메시지') },
            })
            expect(
                await within(log).findByText('스크롤 유지 메시지'),
            ).toBeVisible()
            expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
            expect(
                screen.getByRole('button', { name: '새 메시지 1개' }),
            ).toBeVisible()

            await userEvent.click(
                screen.getByRole('button', { name: '새 메시지 1개' }),
            )
            expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'auto',
                block: 'end',
            })

            log.scrollTop = 600
            fireEvent.scroll(log)
            mock.emit({
                eventId: 'event-auto-scroll',
                eventVersion: 1,
                eventType: 'MESSAGE_CREATED',
                roomPublicId: 'room-1',
                occurredAt: '2026-08-18T09:03:00Z',
                payload: { message: message(3, '하단 새 메시지') },
            })
            expect(await within(log).findByText('하단 새 메시지')).toBeVisible()
            await waitFor(() =>
                expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
                    behavior: 'auto',
                    block: 'end',
                }),
            )
        } finally {
            window.matchMedia = originalMatchMedia
        }
    })

    it('신고는 사유를 전송하고 차단 후에도 기존 대화와 신고 기능을 유지한다', async () => {
        const mock = createMockRuntime()
        render(
            <ChatWorkspace
                accessToken="access-token"
                runtime={mock.runtime}
                user={CURRENT_USER}
            />,
        )
        await openConversation()

        await userEvent.click(
            screen.getByRole('button', { name: '이 메시지 신고' }),
        )
        const dialog = screen.getByRole('dialog', { name: '메시지 신고' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        await waitFor(() =>
            expect(within(dialog).getByLabelText('신고 사유')).toHaveFocus(),
        )
        const outside = document.createElement('button')
        document.body.append(outside)
        outside.focus()
        fireEvent.keyDown(window, { key: 'Tab' })
        expect(
            within(dialog).getByRole('button', { name: '신고 창 닫기' }),
        ).toHaveFocus()
        await userEvent.selectOptions(
            within(dialog).getByLabelText('신고 사유'),
            'FRAUD',
        )
        await userEvent.type(
            within(dialog).getByLabelText('상세 내용 (선택)'),
            '거래 외부 결제를 유도했어요.',
        )
        await userEvent.click(
            within(dialog).getByRole('button', { name: '메시지 신고' }),
        )
        await waitFor(() =>
            expect(mock.rest.report).toHaveBeenCalledWith('room-1', {
                messagePublicId: 'message-1',
                reason: 'FRAUD',
                detail: '거래 외부 결제를 유도했어요.',
            }),
        )

        await userEvent.click(screen.getByRole('button', { name: '상대 차단' }))
        await userEvent.click(
            screen.getAllByRole('button', { name: '상대 차단' }).at(-1)!,
        )
        await waitFor(() =>
            expect(mock.rest.block).toHaveBeenCalledWith('room-1'),
        )
        expect(
            screen.getByText(
                '내가 차단한 사용자입니다. 기존 메시지는 확인하고 신고할 수 있습니다.',
            ),
        ).toBeVisible()
        expect(
            screen.getByRole('textbox', { name: '메시지 입력' }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: '이 메시지 신고' }),
        ).toBeEnabled()
    })
})
