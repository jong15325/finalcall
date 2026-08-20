import { useEffect, useMemo, useRef, useState } from 'react'
import {
    TbChecks,
    TbChevronLeft,
    TbDotsVertical,
    TbMessage2Off,
    TbMicrophone,
    TbMoodSmile,
    TbPaperclip,
    TbPhone,
    TbSearch,
    TbSend,
    TbVideo,
    TbX,
} from 'react-icons/tb'
import type {
    ChatContactFixture,
    ChatFixture,
    ChatMessageFixture,
    ChatPresence,
} from '../fixtures/chat'

const presenceClasses: Record<ChatPresence, string> = {
    online: 'bg-success',
    away: 'bg-warning',
    busy: 'bg-danger',
    offline: 'bg-content-subtle',
}

const presenceLabels: Record<ChatPresence, string> = {
    online: '온라인',
    away: '자리 비움',
    busy: '응답 지연',
    offline: '오프라인',
}

interface MessageGroup {
    sender: ChatMessageFixture['sender']
    messages: ChatMessageFixture[]
}

export default function ChatCandidate({ fixture }: { fixture: ChatFixture }) {
    const [selectedContactId, setSelectedContactId] = useState(
        fixture.contacts[0]?.id ?? '',
    )
    const [mobilePane, setMobilePane] = useState<'list' | 'conversation'>(
        'list',
    )
    const [searchValue, setSearchValue] = useState('')
    const [draft, setDraft] = useState('')
    const [sentMessages, setSentMessages] = useState<
        Readonly<Record<string, readonly ChatMessageFixture[]>>
    >({})
    const searchRef = useRef<HTMLInputElement>(null)
    const messageInputRef = useRef<HTMLTextAreaElement>(null)

    const selectedContact =
        fixture.contacts.find(({ id }) => id === selectedContactId) ??
        fixture.contacts[0]
    const normalizedSearch = searchValue.trim().toLocaleLowerCase('ko-KR')
    const conversationOpen = mobilePane === 'conversation'
    const visibleContacts = useMemo(
        () =>
            fixture.contacts.filter((contact) =>
                `${contact.name} ${contact.role} ${contact.lastMessage}`
                    .toLocaleLowerCase('ko-KR')
                    .includes(normalizedSearch),
            ),
        [fixture.contacts, normalizedSearch],
    )

    const messages = selectedContact
        ? [
              ...selectedContact.messages,
              ...(sentMessages[selectedContact.id] ?? []),
          ]
        : []
    const groups = groupMessages(messages)

    useEffect(() => {
        if (mobilePane === 'conversation') {
            messageInputRef.current?.focus()
        }
    }, [mobilePane, selectedContactId])

    const selectContact = (contact: ChatContactFixture) => {
        setSelectedContactId(contact.id)
        setMobilePane('conversation')
        setDraft('')
    }

    const showSearch = () => {
        setMobilePane('list')
        requestAnimationFrame(() => searchRef.current?.focus())
    }

    const sendMessage = () => {
        const body = draft.trim()
        if (!selectedContact || body.length === 0) return

        const message: ChatMessageFixture = {
            id: `preview-${selectedContact.id}-${Date.now()}`,
            sender: 'me',
            body,
            time: '방금',
            seen: false,
        }
        setSentMessages((current) => ({
            ...current,
            [selectedContact.id]: [
                ...(current[selectedContact.id] ?? []),
                message,
            ],
        }))
        setDraft('')
        messageInputRef.current?.focus()
    }

    return (
        <section
            aria-label="채팅 디자인 게이트"
            className="relative min-w-0 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm lg:grid lg:min-h-[600px] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]"
            data-chat-workbench="FC_CHAT_WORKBENCH_317"
        >
            <aside
                data-chat-list
                aria-label="대화 목록"
                className={`min-h-[420px] min-w-0 flex-col border-content-line bg-content-surface lg:flex lg:min-h-0 lg:border-r ${
                    mobilePane === 'list' ? 'flex' : 'hidden'
                }`}
            >
                <div className="flex items-center gap-3 border-b border-content-line px-4 py-4">
                    <Avatar
                        name={fixture.profile.name}
                        src={fixture.profile.avatar}
                        presence={fixture.profile.presence}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-content-line bg-content-soft px-3 py-2 focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action/30">
                        <TbSearch
                            aria-hidden
                            className="size-4 shrink-0 text-content-subtle"
                        />
                        <label
                            htmlFor="chat-preview-search"
                            className="shrink-0 text-sm text-content-muted"
                        >
                            대화 검색
                        </label>
                        <input
                            ref={searchRef}
                            data-chat-search
                            id="chat-preview-search"
                            type="search"
                            value={searchValue}
                            aria-label="대화 검색"
                            className="w-full min-w-0 flex-1 bg-transparent text-sm text-content-fg outline-none [&::-webkit-search-cancel-button]:appearance-none"
                            onChange={(event) =>
                                setSearchValue(event.target.value)
                            }
                        />
                        {searchValue.length > 0 && (
                            <button
                                type="button"
                                aria-label="검색어 지우기"
                                className="shrink-0 rounded-full p-0.5 text-content-subtle hover:text-content-fg"
                                onClick={() => {
                                    setSearchValue('')
                                    searchRef.current?.focus()
                                }}
                            >
                                <TbX aria-hidden className="size-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {visibleContacts.length === 0 ? (
                        <div
                            data-chat-empty
                            role="status"
                            className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center"
                        >
                            <span className="flex size-12 items-center justify-center rounded-2xl bg-content-soft text-content-subtle">
                                <TbMessage2Off aria-hidden className="size-6" />
                            </span>
                            <h2 className="mt-1 text-base font-bold text-content-fg">
                                일치하는 대화가 없어요
                            </h2>
                            <p className="text-sm text-content-muted">
                                판매자 이름이나 최근 메시지로 다시 검색해
                                보세요.
                            </p>
                            <button
                                type="button"
                                className="mt-3 rounded-lg border border-content-line bg-content-surface px-4 py-2 text-sm font-bold text-content-fg hover:bg-content-soft"
                                onClick={() => {
                                    setSearchValue('')
                                    searchRef.current?.focus()
                                }}
                            >
                                전체 대화 보기
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {visibleContacts.map((contact) => {
                                const active =
                                    contact.id === selectedContact?.id
                                return (
                                    <li key={contact.id}>
                                        <button
                                            type="button"
                                            data-chat-contact={contact.id}
                                            data-chat-contact-active={
                                                active ? 'true' : 'false'
                                            }
                                            aria-current={
                                                active ? 'true' : undefined
                                            }
                                            aria-label={`${contact.name} 대화 열기${contact.unreadCount > 0 ? `, 읽지 않은 메시지 ${contact.unreadCount}개` : ''}`}
                                            className={`flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                                                active
                                                    ? 'bg-control-action text-control-action-ink shadow-sm'
                                                    : 'text-content-fg hover:bg-content-soft'
                                            }`}
                                            onClick={() =>
                                                selectContact(contact)
                                            }
                                        >
                                            <Avatar
                                                name={contact.name}
                                                src={contact.avatar}
                                                presence={contact.presence}
                                                active={active}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold">
                                                    {contact.name}
                                                </span>
                                                <span
                                                    className={`mt-0.5 block truncate text-xs ${
                                                        active
                                                            ? 'text-control-action-ink'
                                                            : 'text-content-muted'
                                                    }`}
                                                >
                                                    {contact.lastMessage}
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-1">
                                                <span
                                                    className={`whitespace-nowrap text-[11px] tabular-nums ${
                                                        active
                                                            ? 'text-control-action-ink'
                                                            : 'text-content-subtle'
                                                    }`}
                                                >
                                                    {contact.lastActivity}
                                                </span>
                                                {contact.unreadCount > 0 && (
                                                    <span className="inline-grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-control-action-ink tabular-nums">
                                                        {contact.unreadCount}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </aside>

            <div
                data-chat-conversation
                aria-label="선택한 대화"
                className={`min-h-[420px] min-w-0 flex-col bg-content-soft lg:flex lg:min-h-0 ${
                    conversationOpen ? 'flex' : 'hidden'
                }`}
            >
                {selectedContact ? (
                    <>
                        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-content-line bg-content-surface px-3 py-3 sm:px-5">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    data-chat-mobile-back
                                    type="button"
                                    aria-label="대화 목록으로"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft lg:hidden"
                                    onClick={() => setMobilePane('list')}
                                >
                                    <TbChevronLeft
                                        aria-hidden
                                        className="size-5"
                                    />
                                </button>
                                <Avatar
                                    name={selectedContact.name}
                                    src={selectedContact.avatar}
                                    presence={selectedContact.presence}
                                />
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-bold text-content-fg">
                                        {selectedContact.name}
                                    </h2>
                                    <p className="truncate text-xs text-content-muted">
                                        {selectedContact.role} ·{' '}
                                        {
                                            presenceLabels[
                                                selectedContact.presence
                                            ]
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <HeaderAction
                                    disabled
                                    label="음성 통화 (미리보기에서 비활성화)"
                                >
                                    <TbPhone aria-hidden className="size-5" />
                                </HeaderAction>
                                <HeaderAction
                                    disabled
                                    desktopOnly
                                    label="영상 통화 (미리보기에서 비활성화)"
                                >
                                    <TbVideo aria-hidden className="size-5" />
                                </HeaderAction>
                                <HeaderAction
                                    desktopOnly
                                    label="대화 검색"
                                    onClick={showSearch}
                                >
                                    <TbSearch aria-hidden className="size-5" />
                                </HeaderAction>
                                <HeaderAction
                                    disabled
                                    label="대화 메뉴 (미리보기에서 비활성화)"
                                >
                                    <TbDotsVertical
                                        aria-hidden
                                        className="size-5"
                                    />
                                </HeaderAction>
                            </div>
                        </header>

                        <div
                            aria-live="polite"
                            className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
                        >
                            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                                {groups.map((group, groupIndex) => {
                                    const mine = group.sender === 'me'
                                    return (
                                        <div
                                            key={`${group.sender}-${groupIndex}`}
                                            className={`flex min-w-0 gap-3 ${mine ? 'justify-end' : ''}`}
                                        >
                                            {!mine && (
                                                <Avatar
                                                    compact
                                                    name={selectedContact.name}
                                                    src={selectedContact.avatar}
                                                />
                                            )}
                                            <div
                                                className={`flex min-w-0 max-w-md flex-col gap-2 ${
                                                    mine
                                                        ? 'items-end'
                                                        : 'items-start'
                                                }`}
                                            >
                                                {group.messages.map(
                                                    (message) => (
                                                        <p
                                                            key={message.id}
                                                            data-chat-message={
                                                                mine
                                                                    ? 'outgoing'
                                                                    : 'incoming'
                                                            }
                                                            className={`max-w-full break-words rounded-lg px-4 py-2.5 text-sm leading-6 shadow-sm ${
                                                                mine
                                                                    ? 'bg-control-action text-control-action-ink'
                                                                    : 'border border-content-line bg-content-surface text-content-fg'
                                                            }`}
                                                            style={
                                                                mine
                                                                    ? {
                                                                          borderTopRightRadius: 0,
                                                                      }
                                                                    : {
                                                                          borderTopLeftRadius: 0,
                                                                      }
                                                            }
                                                        >
                                                            {message.body}
                                                        </p>
                                                    ),
                                                )}
                                                <p className="flex items-center gap-1.5 text-[11px] text-content-muted tabular-nums">
                                                    {mine && (
                                                        <TbChecks
                                                            aria-label={
                                                                group.messages[
                                                                    group
                                                                        .messages
                                                                        .length -
                                                                        1
                                                                ]?.seen
                                                                    ? '읽음'
                                                                    : '전송됨'
                                                            }
                                                            className="size-4 text-success-ink"
                                                        />
                                                    )}
                                                    {
                                                        group.messages[
                                                            group.messages
                                                                .length - 1
                                                        ]?.time
                                                    }
                                                </p>
                                            </div>
                                            {mine && (
                                                <Avatar
                                                    compact
                                                    name={fixture.profile.name}
                                                    src={fixture.profile.avatar}
                                                />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <form
                            data-chat-composer
                            aria-label="메시지 작성"
                            className="border-t border-content-line bg-content-surface p-3 sm:p-6"
                            onSubmit={(event) => {
                                event.preventDefault()
                                sendMessage()
                            }}
                        >
                            <div className="mx-auto flex w-full max-w-3xl min-w-0 items-end gap-2 rounded-xl border border-content-line bg-content-surface p-2 shadow-sm focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action/30">
                                <button
                                    type="button"
                                    aria-label="웃는 표정 추가"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft hover:text-content-fg"
                                    onClick={() => {
                                        setDraft((current) => `${current}🙂`)
                                        messageInputRef.current?.focus()
                                    }}
                                >
                                    <TbMoodSmile
                                        aria-hidden
                                        className="size-5"
                                    />
                                </button>
                                <label
                                    htmlFor="chat-preview-message"
                                    className="sr-only"
                                >
                                    메시지 입력
                                </label>
                                <textarea
                                    ref={messageInputRef}
                                    id="chat-preview-message"
                                    rows={1}
                                    value={draft}
                                    maxLength={500}
                                    placeholder="메시지를 입력하세요"
                                    className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-content-fg outline-none placeholder:text-content-subtle"
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === 'Enter' &&
                                            !event.shiftKey
                                        ) {
                                            event.preventDefault()
                                            sendMessage()
                                        }
                                    }}
                                />
                                <button
                                    disabled
                                    type="button"
                                    aria-label="음성 메시지 (미리보기에서 비활성화)"
                                    className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-content-muted disabled:opacity-50 sm:flex"
                                >
                                    <TbMicrophone
                                        aria-hidden
                                        className="size-5"
                                    />
                                </button>
                                <button
                                    disabled
                                    type="button"
                                    aria-label="파일 첨부 (미리보기에서 비활성화)"
                                    className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-content-muted disabled:opacity-50 sm:flex"
                                >
                                    <TbPaperclip
                                        aria-hidden
                                        className="size-5"
                                    />
                                </button>
                                <button
                                    type="submit"
                                    disabled={draft.trim().length === 0}
                                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control-action px-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:opacity-50 sm:px-4"
                                >
                                    <span className="hidden sm:block">
                                        보내기
                                    </span>
                                    <TbSend aria-hidden className="size-4" />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                        <TbMessage2Off
                            aria-hidden
                            className="size-7 text-content-subtle"
                        />
                        <p className="text-sm text-content-muted">
                            대화를 선택하면 메시지가 표시됩니다.
                        </p>
                    </div>
                )}
            </div>
        </section>
    )
}

function Avatar({
    name,
    src,
    presence,
    active = false,
    compact = false,
}: {
    name: string
    src: string
    presence?: ChatPresence
    active?: boolean
    compact?: boolean
}) {
    return (
        <span className="relative shrink-0">
            <img
                src={src}
                alt=""
                className={`${compact ? 'size-8' : 'size-10'} rounded-full object-cover`}
            />
            {presence && (
                <span
                    aria-label={presenceLabels[presence]}
                    role="img"
                    className={`absolute bottom-0 right-0 size-2 rounded-full border-2 ${
                        active ? 'border-control-action' : 'border-content-line'
                    } ${presenceClasses[presence]}`}
                    title={`${name} · ${presenceLabels[presence]}`}
                />
            )}
        </span>
    )
}

function HeaderAction({
    children,
    label,
    desktopOnly = false,
    disabled = false,
    onClick,
}: {
    children: React.ReactNode
    label: string
    desktopOnly?: boolean
    disabled?: boolean
    onClick?: () => void
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            className={`${desktopOnly ? 'hidden sm:flex' : 'flex'} size-9 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft hover:text-content-fg disabled:opacity-50`}
            onClick={onClick}
        >
            {children}
        </button>
    )
}

function groupMessages(messages: readonly ChatMessageFixture[]) {
    return messages.reduce<MessageGroup[]>((groups, message) => {
        const last = groups[groups.length - 1]
        if (last?.sender === message.sender) {
            last.messages.push(message)
            return groups
        }
        groups.push({ sender: message.sender, messages: [message] })
        return groups
    }, [])
}
