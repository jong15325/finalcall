import { useEffect, useMemo, useRef, useState } from 'react'
import {
    TbAlertTriangle,
    TbChevronLeft,
    TbFlag,
    TbMessage2Off,
    TbMessagePlus,
    TbRefresh,
    TbSearch,
    TbSend,
    TbShieldOff,
    TbUserCancel,
    TbX,
} from 'react-icons/tb'
import ChatAvatar from './ChatAvatar'
import { NewChatDialog, ReportChatDialog } from './ChatDialogs'
import { browserChatRuntime } from '../lib/chatRuntime'
import { useChatController } from '../lib/useChatController'
import type { ChatRuntime, ChatRealtimeStatus } from '../lib/chatRuntime'
import type { ChatTimelineMessage } from '../lib/chatTimeline'
import type { ChatMessageResponse } from '@/lib/api/chat'
import type { UserSummary } from '@/store/authStore'

export default function ChatWorkspace({
    accessToken,
    user,
    runtime = browserChatRuntime,
}: {
    accessToken: string
    user: UserSummary
    runtime?: ChatRuntime
}) {
    const [mobilePane, setMobilePane] = useState<'list' | 'conversation'>(
        'list',
    )
    const wideLayout = useWideChatLayout()
    const chat = useChatController({
        runtime,
        accessToken,
        user,
        conversationVisible: wideLayout || mobilePane === 'conversation',
    })
    const [searchValue, setSearchValue] = useState('')
    const [draft, setDraft] = useState('')
    const [composerError, setComposerError] = useState<string | null>(null)
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
    const [newChatOpen, setNewChatOpen] = useState(false)
    const [reportTarget, setReportTarget] =
        useState<ChatMessageResponse | null>(null)
    const messageInputRef = useRef<HTMLTextAreaElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const timelineScrollRef = useRef<HTMLDivElement>(null)
    const timelineEndRef = useRef<HTMLDivElement>(null)
    const timelineNearBottomRef = useRef(true)
    const [unseenMessageCount, setUnseenMessageCount] = useState(0)
    const reducedMotion = usePrefersReducedMotion()

    useVolatileQueueExitWarning(chat.hasQueuedMessages)

    const normalizedSearch = searchValue.trim().toLocaleLowerCase('ko-KR')
    const visibleRooms = useMemo(
        () =>
            chat.rooms.filter((room) =>
                `${room.counterpart.nickname} ${room.lastMessage?.bodyPreview ?? ''}`
                    .toLocaleLowerCase('ko-KR')
                    .includes(normalizedSearch),
            ),
        [chat.rooms, normalizedSearch],
    )
    const lastMessageKey = chat.messages.at(-1)?.clientMessageId
    const latestMessageSentByMe = chat.messages.at(-1)?.sentByMe ?? false

    useEffect(() => {
        if (mobilePane === 'conversation') {
            messageInputRef.current?.focus()
        }
    }, [mobilePane, chat.selectedRoomId])

    useEffect(() => {
        timelineNearBottomRef.current = true
        setUnseenMessageCount(0)
    }, [chat.selectedRoomId])

    useEffect(() => {
        if (!lastMessageKey) return
        if (!timelineNearBottomRef.current && !latestMessageSentByMe) {
            setUnseenMessageCount((current) => current + 1)
            return
        }
        setUnseenMessageCount(0)
        timelineEndRef.current?.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'end',
        })
    }, [
        chat.selectedRoomId,
        lastMessageKey,
        latestMessageSentByMe,
        reducedMotion,
    ])

    const openRoom = (roomPublicId: string) => {
        chat.selectRoom(roomPublicId)
        setMobilePane('conversation')
        setDraft('')
        setComposerError(null)
        setBlockConfirmOpen(false)
    }

    const submitMessage = () => {
        const error = chat.sendMessage(draft)
        if (error) {
            setComposerError(error)
            return
        }
        setDraft('')
        setComposerError(null)
        messageInputRef.current?.focus()
    }

    const loadOlderPreservingPosition = async () => {
        const timeline = timelineScrollRef.current
        if (!timeline) {
            await chat.loadOlder()
            return
        }
        const previousHeight = timeline.scrollHeight
        const previousTop = timeline.scrollTop
        await chat.loadOlder()
        requestAnimationFrame(() => {
            timeline.scrollTop =
                previousTop + (timeline.scrollHeight - previousHeight)
        })
    }

    const scrollToLatest = () => {
        timelineNearBottomRef.current = true
        setUnseenMessageCount(0)
        timelineEndRef.current?.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'end',
        })
    }

    const selectedIsDraft = chat.selectedRoomId?.startsWith('draft:') ?? false

    return (
        <div
            data-chat-operational
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden"
        >
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                <h1
                    className={`${mobilePane === 'conversation' ? 'hidden lg:block' : 'block'} text-2xl font-bold text-content-fg`}
                >
                    채팅
                </h1>
                <ConnectionBadge status={chat.realtimeStatus} />
            </header>

            <section
                aria-label="실시간 채팅"
                className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm lg:grid lg:max-h-[760px] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:min-h-[640px]"
            >
                <aside
                    data-chat-list
                    aria-label="대화 목록"
                    aria-busy={chat.roomsLoading}
                    className={`min-h-0 min-w-0 flex-col overflow-hidden bg-content-surface lg:flex lg:border-r lg:border-content-line ${
                        mobilePane === 'list' ? 'flex' : 'hidden'
                    }`}
                >
                    <div className="flex items-center gap-2 border-b border-content-line p-3 sm:p-4">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-content-line bg-content-soft px-3 focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-focus">
                            <TbSearch
                                aria-hidden
                                className="size-4 shrink-0 text-content-subtle"
                            />
                            <label htmlFor="chat-search" className="sr-only">
                                대화 검색
                            </label>
                            <input
                                ref={searchRef}
                                id="chat-search"
                                type="search"
                                value={searchValue}
                                placeholder="닉네임 또는 최근 메시지 검색"
                                className="min-h-11 w-full min-w-0 bg-transparent text-base text-content-fg outline-none placeholder:text-content-subtle [&::-webkit-search-cancel-button]:appearance-none"
                                onChange={(event) =>
                                    setSearchValue(event.target.value)
                                }
                            />
                            {searchValue && (
                                <button
                                    type="button"
                                    aria-label="검색어 지우기"
                                    className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-surface hover:text-content-fg"
                                    onClick={() => {
                                        setSearchValue('')
                                        searchRef.current?.focus()
                                    }}
                                >
                                    <TbX aria-hidden className="size-4" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            aria-label="새 대화 시작"
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-control-action text-control-action-ink hover:bg-control-action-hover"
                            onClick={() => {
                                chat.clearActionError()
                                setNewChatOpen(true)
                            }}
                        >
                            <TbMessagePlus aria-hidden className="size-5" />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        {chat.roomsLoading && chat.rooms.length === 0 ? (
                            <RoomListSkeleton />
                        ) : chat.roomsError && chat.rooms.length === 0 ? (
                            <EmptyState
                                icon={TbAlertTriangle}
                                title="대화를 불러오지 못했습니다"
                                description={chat.roomsError}
                                actionLabel="다시 불러오기"
                                onAction={chat.reloadRooms}
                            />
                        ) : visibleRooms.length === 0 ? (
                            <EmptyState
                                icon={TbMessage2Off}
                                title={
                                    searchValue
                                        ? '일치하는 대화가 없어요'
                                        : '아직 시작한 대화가 없어요'
                                }
                                description={
                                    searchValue
                                        ? '닉네임이나 최근 메시지로 다시 검색해 보세요.'
                                        : '닉네임으로 첫 대화를 시작할 수 있습니다.'
                                }
                                actionLabel={
                                    searchValue
                                        ? '전체 대화 보기'
                                        : '새 대화 시작'
                                }
                                onAction={() => {
                                    if (searchValue) {
                                        setSearchValue('')
                                        searchRef.current?.focus()
                                    } else {
                                        chat.clearActionError()
                                        setNewChatOpen(true)
                                    }
                                }}
                            />
                        ) : (
                            <>
                                <ul className="space-y-1">
                                    {visibleRooms.map((room) => {
                                        const active =
                                            room.roomPublicId ===
                                            chat.selectedRoomId
                                        return (
                                            <li key={room.roomPublicId}>
                                                <button
                                                    type="button"
                                                    aria-current={
                                                        active
                                                            ? 'true'
                                                            : undefined
                                                    }
                                                    aria-label={`${room.counterpart.nickname} 대화 열기${room.unreadCount > 0 ? `, 읽지 않은 메시지 ${room.unreadCount}개` : ''}`}
                                                    className={`flex min-h-16 w-full min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left motion-safe:transition-colors ${
                                                        active
                                                            ? 'bg-control-action text-control-action-ink shadow-sm'
                                                            : 'text-content-fg hover:bg-content-soft'
                                                    }`}
                                                    onClick={() =>
                                                        openRoom(
                                                            room.roomPublicId,
                                                        )
                                                    }
                                                >
                                                    <ChatAvatar
                                                        nickname={
                                                            room.counterpart
                                                                .nickname
                                                        }
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-bold">
                                                            {
                                                                room.counterpart
                                                                    .nickname
                                                            }
                                                        </span>
                                                        <span
                                                            className={`mt-1 block truncate text-xs ${
                                                                active
                                                                    ? 'text-control-action-ink'
                                                                    : 'text-content-muted'
                                                            }`}
                                                        >
                                                            {room.lastMessage
                                                                ?.bodyPreview ??
                                                                '아직 메시지가 없습니다.'}
                                                        </span>
                                                    </span>
                                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                                        <time
                                                            dateTime={
                                                                room.lastActivityAt
                                                            }
                                                            className={`whitespace-nowrap text-xs tabular-nums ${
                                                                active
                                                                    ? 'text-control-action-ink'
                                                                    : 'text-content-subtle'
                                                            }`}
                                                        >
                                                            {formatListTime(
                                                                room.lastActivityAt,
                                                            )}
                                                        </time>
                                                        {room.unreadCount >
                                                            0 && (
                                                            <span className="inline-grid min-w-[20px] place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-control-action-ink tabular-nums">
                                                                {room.unreadCount >
                                                                99
                                                                    ? '99+'
                                                                    : room.unreadCount}
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                                {chat.roomsHasNext && (
                                    <button
                                        type="button"
                                        disabled={chat.roomsLoading}
                                        className="mt-3 min-h-11 w-full rounded-lg border border-content-line text-sm font-bold text-content-fg hover:bg-content-soft disabled:opacity-50"
                                        onClick={chat.loadMoreRooms}
                                    >
                                        {chat.roomsLoading
                                            ? '대화 불러오는 중…'
                                            : '대화 더 보기'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </aside>

                <div
                    data-chat-conversation
                    aria-label="선택한 대화"
                    className={`min-h-0 min-w-0 flex-col overflow-hidden bg-content-soft lg:flex ${
                        mobilePane === 'conversation' ? 'flex' : 'hidden'
                    }`}
                >
                    {chat.selectedRoom ? (
                        <>
                            <header className="flex min-w-0 items-center justify-between gap-3 border-b border-content-line bg-content-surface px-3 py-3 sm:px-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <button
                                        type="button"
                                        aria-label="대화 목록으로"
                                        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft lg:hidden"
                                        onClick={() => setMobilePane('list')}
                                    >
                                        <TbChevronLeft
                                            aria-hidden
                                            className="size-5"
                                        />
                                    </button>
                                    <ChatAvatar
                                        nickname={
                                            chat.selectedRoom.counterpart
                                                .nickname
                                        }
                                    />
                                    <div className="min-w-0">
                                        <h2 className="truncate text-base font-bold text-content-fg">
                                            {
                                                chat.selectedRoom.counterpart
                                                    .nickname
                                            }
                                        </h2>
                                        <p className="truncate text-xs text-content-muted">
                                            {chat.selectedRoom.canSend
                                                ? '대화 가능'
                                                : '현재 메시지를 보낼 수 없음'}
                                        </p>
                                    </div>
                                </div>
                                {!selectedIsDraft && (
                                    <button
                                        type="button"
                                        disabled={chat.actionPending}
                                        aria-label={
                                            chat.selectedRoom.blockedByMe
                                                ? '상대 차단 해제'
                                                : '상대 차단'
                                        }
                                        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold disabled:opacity-50 ${
                                            chat.selectedRoom.blockedByMe
                                                ? 'border border-content-line text-content-fg hover:bg-content-soft'
                                                : 'text-danger-ink hover:bg-danger-soft'
                                        }`}
                                        onClick={() => {
                                            chat.clearActionError()
                                            if (
                                                chat.selectedRoom?.blockedByMe
                                            ) {
                                                void chat.toggleBlock()
                                            } else {
                                                setBlockConfirmOpen(true)
                                            }
                                        }}
                                    >
                                        <TbUserCancel
                                            aria-hidden
                                            className="size-5"
                                        />
                                        <span className="hidden sm:inline">
                                            {chat.selectedRoom.blockedByMe
                                                ? '차단 해제'
                                                : '상대 차단'}
                                        </span>
                                    </button>
                                )}
                            </header>

                            {blockConfirmOpen && (
                                <div
                                    role="alert"
                                    className="flex flex-wrap items-center gap-3 border-b border-content-line bg-warning-soft px-4 py-3 text-sm text-warning"
                                >
                                    <TbShieldOff
                                        aria-hidden
                                        className="size-5 shrink-0"
                                    />
                                    <p className="min-w-0 flex-1">
                                        차단하면 양쪽 모두 새 메시지를 보낼 수
                                        없습니다. 기존 대화와 신고 기능은
                                        유지됩니다.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={chat.actionPending}
                                        className="min-h-11 rounded-lg bg-danger px-3 font-bold text-control-action-ink disabled:opacity-50"
                                        onClick={() =>
                                            void chat
                                                .toggleBlock()
                                                .then((succeeded) => {
                                                    if (succeeded)
                                                        setBlockConfirmOpen(
                                                            false,
                                                        )
                                                })
                                        }
                                    >
                                        상대 차단
                                    </button>
                                    <button
                                        type="button"
                                        className="min-h-11 rounded-lg px-3 font-bold hover:bg-content-surface/70"
                                        onClick={() =>
                                            setBlockConfirmOpen(false)
                                        }
                                    >
                                        취소
                                    </button>
                                </div>
                            )}

                            <ConversationAlerts
                                roomCanSend={chat.selectedRoom.canSend}
                                blockedByMe={chat.selectedRoom.blockedByMe}
                                hasQueuedMessages={chat.hasQueuedMessages}
                                actionError={chat.actionError}
                                notice={chat.notice}
                                onClearNotice={chat.clearNotice}
                            />

                            <div
                                ref={timelineScrollRef}
                                role="log"
                                aria-label={`${chat.selectedRoom.counterpart.nickname} 메시지 기록`}
                                aria-live="polite"
                                aria-relevant="additions"
                                aria-atomic="false"
                                aria-busy={
                                    chat.conversationLoading ||
                                    chat.olderLoading
                                }
                                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-5 sm:px-6"
                                onScroll={(event) => {
                                    const nearBottom = isTimelineNearBottom(
                                        event.currentTarget,
                                    )
                                    timelineNearBottomRef.current = nearBottom
                                    if (nearBottom) setUnseenMessageCount(0)
                                }}
                            >
                                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                                    {chat.hasOlder && (
                                        <button
                                            type="button"
                                            disabled={chat.olderLoading}
                                            className="mx-auto min-h-11 rounded-lg border border-content-line bg-content-surface px-4 text-sm font-bold text-content-fg hover:bg-content-soft disabled:opacity-50"
                                            onClick={() =>
                                                void loadOlderPreservingPosition()
                                            }
                                        >
                                            {chat.olderLoading
                                                ? '이전 메시지 불러오는 중…'
                                                : '이전 메시지 보기'}
                                        </button>
                                    )}
                                    {chat.conversationLoading &&
                                    chat.messages.length === 0 ? (
                                        <MessageSkeleton />
                                    ) : chat.conversationError &&
                                      chat.messages.length === 0 ? (
                                        <EmptyState
                                            icon={TbAlertTriangle}
                                            title="메시지를 불러오지 못했습니다"
                                            description={chat.conversationError}
                                            actionLabel="다시 불러오기"
                                            onAction={() =>
                                                chat.selectRoom(
                                                    chat.selectedRoom!
                                                        .roomPublicId,
                                                )
                                            }
                                        />
                                    ) : chat.messages.length === 0 ? (
                                        <EmptyState
                                            icon={TbMessage2Off}
                                            title="아직 메시지가 없어요"
                                            description="안전한 거래를 위해 대화 내용을 채팅에 남겨 보세요."
                                        />
                                    ) : (
                                        chat.messages.map((message) => (
                                            <MessageBubble
                                                key={
                                                    message.messagePublicId ??
                                                    message.clientMessageId
                                                }
                                                message={message}
                                                counterpartNickname={
                                                    chat.selectedRoom!
                                                        .counterpart.nickname
                                                }
                                                counterpartLastReadSequence={
                                                    chat.selectedRoom!
                                                        .counterpartLastReadSequence
                                                }
                                                onRetry={chat.retryMessage}
                                                onReport={(target) => {
                                                    chat.clearActionError()
                                                    setReportTarget(target)
                                                }}
                                            />
                                        ))
                                    )}
                                    <div ref={timelineEndRef} aria-hidden />
                                </div>
                                {unseenMessageCount > 0 && (
                                    <button
                                        type="button"
                                        className="sticky bottom-2 mx-auto mt-3 flex min-h-11 items-center rounded-full bg-control-action px-4 text-sm font-bold text-control-action-ink shadow-md hover:bg-control-action-hover"
                                        onClick={scrollToLatest}
                                    >
                                        새 메시지 {unseenMessageCount}개
                                    </button>
                                )}
                            </div>

                            <form
                                aria-label="메시지 작성"
                                className="shrink-0 border-t border-content-line bg-content-surface p-3 sm:p-5"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    submitMessage()
                                }}
                            >
                                {chat.sendError && (
                                    <p
                                        role="alert"
                                        className="mx-auto mb-2 max-w-3xl text-sm text-danger-ink"
                                    >
                                        {chat.sendError}
                                    </p>
                                )}
                                <div className="mx-auto flex w-full max-w-3xl min-w-0 items-end gap-2 rounded-xl border border-content-line bg-content-surface p-2 shadow-sm focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-focus">
                                    <label
                                        htmlFor="chat-message"
                                        className="sr-only"
                                    >
                                        메시지 입력
                                    </label>
                                    <textarea
                                        ref={messageInputRef}
                                        id="chat-message"
                                        rows={1}
                                        value={draft}
                                        maxLength={1_000}
                                        disabled={!chat.selectedRoom.canSend}
                                        placeholder={
                                            chat.selectedRoom.canSend
                                                ? '메시지를 입력하세요'
                                                : '현재 메시지를 보낼 수 없습니다'
                                        }
                                        aria-describedby={
                                            composerError
                                                ? 'chat-composer-error'
                                                : undefined
                                        }
                                        className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-6 text-content-fg outline-none placeholder:text-content-subtle disabled:cursor-not-allowed disabled:opacity-60"
                                        onChange={(event) => {
                                            setDraft(event.target.value)
                                            setComposerError(null)
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === 'Enter' &&
                                                !event.shiftKey &&
                                                !event.nativeEvent.isComposing
                                            ) {
                                                event.preventDefault()
                                                submitMessage()
                                            }
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        aria-label="메시지 보내기"
                                        disabled={
                                            !chat.selectedRoom.canSend ||
                                            draft.trim().length === 0
                                        }
                                        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control-action px-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:opacity-50 sm:px-4"
                                    >
                                        <span className="hidden sm:inline">
                                            보내기
                                        </span>
                                        <TbSend
                                            aria-hidden
                                            className="size-4"
                                        />
                                    </button>
                                </div>
                                {composerError && (
                                    <p
                                        id="chat-composer-error"
                                        role="alert"
                                        className="mx-auto mt-2 max-w-3xl text-sm text-danger-ink"
                                    >
                                        {composerError}
                                    </p>
                                )}
                            </form>
                        </>
                    ) : (
                        <EmptyState
                            icon={TbMessage2Off}
                            title="대화를 선택해 주세요"
                            description="대화 목록에서 상대를 선택하면 메시지가 표시됩니다."
                        />
                    )}
                </div>
            </section>

            <NewChatDialog
                open={newChatOpen}
                pending={false}
                error={chat.actionError}
                onClose={() => {
                    setNewChatOpen(false)
                    chat.clearActionError()
                }}
                onSubmit={async (counterpartNickname) => {
                    const succeeded = chat.startDraft(counterpartNickname)
                    if (succeeded) setMobilePane('conversation')
                    return succeeded
                }}
            />
            <ReportChatDialog
                open={reportTarget !== null}
                pending={chat.actionPending}
                error={chat.actionError}
                counterpartNickname={
                    chat.selectedRoom?.counterpart.nickname ?? '상대'
                }
                onClose={() => {
                    setReportTarget(null)
                    chat.clearActionError()
                }}
                onSubmit={(reason, detail) =>
                    reportTarget?.messagePublicId
                        ? chat.reportMessage(
                              reportTarget.messagePublicId,
                              reason,
                              detail,
                          )
                        : Promise.resolve(false)
                }
            />
        </div>
    )
}

function ConnectionBadge({ status }: { status: ChatRealtimeStatus }) {
    const labels: Record<ChatRealtimeStatus, string> = {
        connected: '실시간 연결됨',
        connecting: '실시간 연결 중',
        reconnecting: '실시간 연결 복구 중',
        offline: '오프라인 · 연결 후 자동 재전송',
        disconnected: '실시간 연결 종료',
    }
    const statusClasses: Record<ChatRealtimeStatus, string> = {
        connected: 'border-success bg-success-soft [&>span]:bg-success',
        connecting: 'border-warning bg-warning-soft [&>span]:bg-warning',
        reconnecting: 'border-warning bg-warning-soft [&>span]:bg-warning',
        offline:
            'border-content-line bg-content-soft [&>span]:bg-content-subtle',
        disconnected:
            'border-content-line bg-content-soft [&>span]:bg-content-subtle',
    }
    return (
        <p
            role="status"
            aria-label={labels[status]}
            title={labels[status]}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border ${statusClasses[status]}`}
        >
            <span aria-hidden className="size-2.5 rounded-full" />
        </p>
    )
}

function ConversationAlerts({
    roomCanSend,
    blockedByMe,
    hasQueuedMessages,
    actionError,
    notice,
    onClearNotice,
}: {
    roomCanSend: boolean
    blockedByMe: boolean
    hasQueuedMessages: boolean
    actionError: string | null
    notice: string | null
    onClearNotice: () => void
}) {
    return (
        <>
            {!roomCanSend && (
                <p className="border-b border-content-line bg-content-surface px-4 py-2.5 text-sm text-content-muted">
                    {blockedByMe
                        ? '내가 차단한 사용자입니다. 기존 메시지는 확인하고 신고할 수 있습니다.'
                        : '현재 이 대화에서는 새 메시지를 보낼 수 없습니다. 차단 방향이나 상대 상태는 공개되지 않습니다.'}
                </p>
            )}
            {hasQueuedMessages && (
                <p
                    role="status"
                    className="border-b border-content-line bg-warning-soft px-4 py-2.5 text-sm text-warning"
                >
                    전송 대기 메시지는 이 화면의 메모리에만 임시 보관됩니다.
                    전송 전에 다른 화면으로 이동하거나 새로고침하면 사라집니다.
                </p>
            )}
            {actionError && (
                <p
                    role="alert"
                    className="border-b border-content-line bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                >
                    {actionError}
                </p>
            )}
            {notice && (
                <div
                    role="status"
                    className="flex items-center gap-3 border-b border-content-line bg-success-soft px-4 py-2 text-sm text-success-ink"
                >
                    <p className="min-w-0 flex-1">{notice}</p>
                    <button
                        type="button"
                        aria-label="안내 닫기"
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-content-surface/60"
                        onClick={onClearNotice}
                    >
                        <TbX aria-hidden className="size-4" />
                    </button>
                </div>
            )}
        </>
    )
}

function MessageBubble({
    message,
    counterpartNickname,
    counterpartLastReadSequence,
    onRetry,
    onReport,
}: {
    message: ChatTimelineMessage
    counterpartNickname: string
    counterpartLastReadSequence: number
    onRetry: (clientMessageId: string) => void
    onReport: (message: ChatMessageResponse) => void
}) {
    const mine = message.sentByMe
    const serverMessage =
        message.messagePublicId && message.roomSequence !== null
            ? ({
                  ...message,
                  messagePublicId: message.messagePublicId,
                  roomSequence: message.roomSequence,
              } satisfies ChatMessageResponse)
            : null

    return (
        <article
            data-chat-message={mine ? 'outgoing' : 'incoming'}
            className={`flex min-w-0 gap-3 ${mine ? 'justify-end' : 'justify-start'}`}
            aria-label={
                mine ? '내가 보낸 메시지' : `${counterpartNickname}의 메시지`
            }
        >
            {!mine && <ChatAvatar compact nickname={counterpartNickname} />}
            <div
                className={`flex min-w-0 max-w-[min(78%,32rem)] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
            >
                <p
                    className={`max-w-full whitespace-pre-wrap break-words rounded-lg px-4 py-2.5 text-base leading-6 shadow-sm ${
                        mine
                            ? 'rounded-tr-sm bg-control-action text-control-action-ink'
                            : 'rounded-tl-sm border border-content-line bg-content-surface text-content-fg'
                    }`}
                >
                    {message.body}
                </p>
                <div className="flex min-h-6 items-center gap-2 text-xs text-content-muted tabular-nums">
                    <time dateTime={message.createdAt}>
                        {formatMessageTime(message.createdAt)}
                    </time>
                    {mine ? (
                        <DeliveryLabel
                            message={message}
                            read={
                                message.roomSequence !== null &&
                                message.roomSequence <=
                                    counterpartLastReadSequence
                            }
                            onRetry={onRetry}
                        />
                    ) : (
                        serverMessage && (
                            <button
                                type="button"
                                aria-label="이 메시지 신고"
                                className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-bold text-content-muted hover:bg-danger-soft hover:text-danger-ink"
                                onClick={() => onReport(serverMessage)}
                            >
                                <TbFlag aria-hidden className="size-3.5" />
                                신고
                            </button>
                        )
                    )}
                </div>
            </div>
            {mine && <ChatAvatar compact nickname={message.sender.nickname} />}
        </article>
    )
}

function DeliveryLabel({
    message,
    read,
    onRetry,
}: {
    message: ChatTimelineMessage
    read: boolean
    onRetry: (clientMessageId: string) => void
}) {
    if (message.delivery === 'failed') {
        return (
            <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-bold text-danger-ink hover:bg-danger-soft"
                onClick={() => onRetry(message.clientMessageId)}
            >
                <TbRefresh aria-hidden className="size-3.5" />
                전송 다시 시도
            </button>
        )
    }
    if (message.delivery === 'queued') return <span>연결 후 전송</span>
    if (message.delivery === 'sending') return <span>보내는 중…</span>
    return <span>{read ? '읽음' : '전송됨'}</span>
}

function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
}: {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
}) {
    return (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-content-soft text-content-subtle">
                <Icon aria-hidden className="size-6" />
            </span>
            <h2 className="mt-1 text-base font-bold text-content-fg">
                {title}
            </h2>
            <p className="max-w-[42ch] text-sm leading-6 text-content-muted">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    className="mt-3 min-h-11 rounded-lg border border-content-line bg-content-surface px-4 text-sm font-bold text-content-fg hover:bg-content-soft"
                    onClick={onAction}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    )
}

function RoomListSkeleton() {
    return (
        <ul aria-hidden className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
                <li
                    key={index}
                    className="flex items-center gap-3 rounded-lg px-3 py-3"
                >
                    <span className="size-10 rounded-full bg-content-soft motion-safe:animate-pulse" />
                    <span className="flex-1 space-y-2">
                        <span className="block h-3.5 w-24 rounded bg-content-soft motion-safe:animate-pulse" />
                        <span className="block h-3 w-4/5 rounded bg-content-soft motion-safe:animate-pulse" />
                    </span>
                </li>
            ))}
        </ul>
    )
}

function MessageSkeleton() {
    return (
        <div aria-hidden className="space-y-5">
            <div className="h-14 w-3/5 rounded-xl bg-content-surface motion-safe:animate-pulse" />
            <div className="ml-auto h-16 w-2/3 rounded-xl bg-content-line motion-safe:animate-pulse" />
            <div className="h-12 w-2/5 rounded-xl bg-content-surface motion-safe:animate-pulse" />
        </div>
    )
}

function formatListTime(value: string): string {
    return formatTime(value, {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function formatMessageTime(value: string): string {
    return formatTime(value, {
        hour: 'numeric',
        minute: '2-digit',
    })
}

function useWideChatLayout(): boolean {
    const query = '(min-width: 1024px)'
    const [wide, setWide] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    )

    useEffect(() => {
        const media = window.matchMedia(query)
        const handleChange = ({ matches }: MediaQueryListEvent) =>
            setWide(matches)
        setWide(media.matches)
        media.addEventListener('change', handleChange)
        return () => media.removeEventListener('change', handleChange)
    }, [])

    return wide
}

function usePrefersReducedMotion(): boolean {
    const query = '(prefers-reduced-motion: reduce)'
    const [reduced, setReduced] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    )

    useEffect(() => {
        const media = window.matchMedia(query)
        const handleChange = ({ matches }: MediaQueryListEvent) =>
            setReduced(matches)
        setReduced(media.matches)
        media.addEventListener('change', handleChange)
        return () => media.removeEventListener('change', handleChange)
    }, [])

    return reduced
}

function useVolatileQueueExitWarning(active: boolean): void {
    useEffect(() => {
        if (!active) return

        const message =
            '전송 대기 메시지는 다른 화면으로 이동하면 사라집니다. 이동하시겠습니까?'
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        const handleLinkClick = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
                return

            const target = event.target
            if (!(target instanceof Element)) return
            const link = target.closest<HTMLAnchorElement>('a[href]')
            if (
                !link ||
                link.target === '_blank' ||
                link.hasAttribute('download')
            )
                return

            const next = new URL(link.href, window.location.href)
            const current = new URL(window.location.href)
            if (next.origin !== current.origin || next.href === current.href)
                return
            if (window.confirm(message)) return

            event.preventDefault()
            event.stopPropagation()
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('click', handleLinkClick, true)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('click', handleLinkClick, true)
        }
    }, [active])
}

function isTimelineNearBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight <= 96
}

function formatTime(value: string, options: Intl.DateTimeFormatOptions) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('ko-KR', options).format(date)
}
