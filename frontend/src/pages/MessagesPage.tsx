import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TbAlertTriangle, TbMail, TbMailOff, TbPencil } from 'react-icons/tb'
import PageIntro from '@/components/common/PageIntro'
import {
    DesktopPageButton,
    MobileBottomNavButton,
} from '@/components/layout/MobileBottomNavAction'
import { useAppAlert } from '@/components/common/AppAlertProvider'
import MemoRow from '@/features/memo/components/MemoRow'
import MemoDetailPane from '@/features/memo/components/MemoDetailPane'
import MemoComposeDialog from '@/features/memo/components/MemoComposeDialog'
import { deleteMemoErrorMessage } from '@/features/memo/lib/memoErrors'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import {
    markMemoReadOptimistic,
    useDeleteMemo,
    useMemoDetail,
    useReceivedMemos,
    useSendMemo,
    useSentMemos,
    useUnreadMemoCount,
} from '@/lib/queries/memos'
import type { MemoBox } from '@/features/memo/lib/memoView'
import type { MemoSummary, SendMemoRequest } from '@/lib/api/memos'

/**
 * 쪽지 `/me/messages` (FC-172 · 계약 §2.6).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 데스크톱 = **2단 메신저형**(좌 목록[받은함/보낸함 탭] · 우 상세). 모바일 = **전체화면 전환형**
 *   (목록 → 상세, 뒤로가기). 선택 여부(`selectedId`)로 모바일 표시 뷰를 가른다(`hidden lg:flex`).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 미열람 받은 쪽지를 열면 서버가 읽음 전이하고, 클라는 목록·뱃지를 낙관적으로 선반영한다
 *   (`markMemoReadOptimistic`). 삭제는 양쪽 박스·미열람 수를 무효화한다(§2.6 단일 플래그).
 * ★ 발신·삭제 실패는 code 로 문구(원문 미노출). 로딩 스켈레톤·빈 상태·부분 실패 배너를 갖춘다.
 */
export default function MessagesPage() {
    const queryClient = useQueryClient()
    const appAlert = useAppAlert()

    const [box, setBox] = useState<MemoBox>('received')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [composeOpen, setComposeOpen] = useState(false)
    const [composePrefill, setComposePrefill] = useState<string | undefined>()

    const received = useReceivedMemos()
    const sent = useSentMemos()
    const unread = useUnreadMemoCount()

    const active = box === 'received' ? received : sent
    const memos = useMemo(
        () => active.data?.pages.flatMap((page) => page.content) ?? [],
        [active.data],
    )
    const detail = useMemoDetail(selectedId)
    const sendMutation = useSendMemo()
    const deleteMutation = useDeleteMemo()

    // 상세 GET 이 성공했을 때만(=서버가 실제 읽음 전이한 시점) 낙관적 반영할 대상. 선택 즉시가
    // 아니라 성공 후 반영해, GET 실패 시 뱃지·목록이 어긋나지 않게 한다(MINOR-3).
    const pendingReadRef = useRef<string | null>(null)

    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(active.hasNextPage),
        isFetching: active.isFetching,
        onLoadMore: () => void active.fetchNextPage(),
    })

    const switchBox = (next: MemoBox) => {
        if (next === box) return
        setBox(next)
        setSelectedId(null)
    }

    const handleSelect = (memo: MemoSummary) => {
        setSelectedId(memo.memoPublicId)
        // 미열람 받은 쪽지만 읽음 전이 대상으로 예약한다 — 실제 반영은 상세 GET 성공 후.
        pendingReadRef.current =
            box === 'received' && !memo.isRead ? memo.memoPublicId : null
    }

    // 상세 GET 성공 시점에만 목록·뱃지를 낙관적으로 읽음 처리한다(서버가 이때 읽음 전이하므로
    // 동치). GET 실패면 예약이 남아 뱃지·목록은 불변 → 순간 드리프트 없음.
    useEffect(() => {
        if (!detail.isSuccess || !detail.data) return
        const pendingId = pendingReadRef.current
        if (pendingId === null || detail.data.memoPublicId !== pendingId) return
        pendingReadRef.current = null
        markMemoReadOptimistic(queryClient, pendingId)
    }, [detail.isSuccess, detail.data, queryClient])

    const openCompose = (prefillTo?: string) => {
        sendMutation.reset()
        setComposePrefill(prefillTo)
        setComposeOpen(true)
    }

    const handleSubmit = async (request: SendMemoRequest) => {
        const confirmed = await appAlert.confirm({
            title: '쪽지를 보내시겠어요?',
            description: `${request.receiverNickname}님에게 입력한 내용을 전송합니다.`,
            confirmLabel: '보내기',
        })
        if (!confirmed) return
        sendMutation.mutate(request, {
            onSuccess: (result) => {
                setComposeOpen(false)
                setBox('sent')
                setSelectedId(result.memoPublicId)
            },
        })
    }

    const handleDelete = async () => {
        if (selectedId === null) return
        const confirmed = await appAlert.danger({
            title: '쪽지를 삭제할까요?',
            description: '삭제한 쪽지는 다시 복구할 수 없습니다.',
            confirmLabel: '삭제',
        })
        if (!confirmed) return
        deleteMutation.mutate(selectedId, {
            onSuccess: () => setSelectedId(null),
        })
    }

    const unreadCount = unread.data?.count ?? 0

    return (
        <div className="flex flex-col gap-4">
            <PageIntro
                icon={TbMail}
                eyebrow="DIRECT MESSAGE"
                title="쪽지"
                description="받은 쪽지와 보낸 쪽지를 확인하고 게임 이용자와 메시지를 주고받으세요."
            />
            <MobileBottomNavButton
                icon={TbPencil}
                label="쪽지 쓰기"
                onClick={() => openCompose()}
            />

            {deleteMutation.isError && (
                <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger-ink"
                >
                    {deleteMemoErrorMessage(deleteMutation.error)}
                </p>
            )}

            <section
                aria-label="쪽지함"
                className="overflow-hidden rounded-2xl border border-content-line bg-content-surface lg:grid lg:min-h-[600px] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]"
            >
                {/* 좌: 목록 (모바일은 선택 시 숨김) */}
                <div
                    className={`min-h-[420px] flex-col lg:flex lg:min-h-0 lg:border-r lg:border-content-line ${
                        selectedId ? 'hidden lg:flex' : 'flex'
                    }`}
                >
                    {/* 탭 */}
                    <div className="flex-none border-b border-content-line p-3">
                        <div
                            role="tablist"
                            aria-label="쪽지함 선택"
                            className="inline-flex w-full gap-1 rounded-lg bg-content-soft p-1"
                        >
                            <TabButton
                                active={box === 'received'}
                                label="받은함"
                                badge={unreadCount}
                                onClick={() => switchBox('received')}
                            />
                            <TabButton
                                active={box === 'sent'}
                                label="보낸함"
                                onClick={() => switchBox('sent')}
                            />
                        </div>
                    </div>

                    {/* 부분 실패 — 받은 목록은 두고 배너만 */}
                    {memos.length > 0 && active.isError && (
                        <p
                            role="alert"
                            className="flex-none bg-danger-soft px-4 py-2 text-xs text-danger-ink"
                        >
                            최신 목록을 불러오지 못했습니다.
                        </p>
                    )}

                    {/* 목록 본문 */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {active.isPending ? (
                            <ListSkeleton />
                        ) : active.isError && memos.length === 0 ? (
                            <ListState
                                icon={TbAlertTriangle}
                                title="쪽지를 불러오지 못했습니다"
                                description="잠시 후 다시 시도해 주세요."
                                action={
                                    <button
                                        type="button"
                                        className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                                        onClick={() => void active.refetch()}
                                    >
                                        다시 시도
                                    </button>
                                }
                            />
                        ) : memos.length === 0 ? (
                            <ListState
                                icon={TbMailOff}
                                title={
                                    box === 'received'
                                        ? '받은 쪽지가 없어요'
                                        : '보낸 쪽지가 없어요'
                                }
                                description={
                                    box === 'received'
                                        ? '새 쪽지가 오면 여기에 표시됩니다.'
                                        : '쪽지 쓰기로 첫 쪽지를 보내보세요.'
                                }
                            />
                        ) : (
                            <>
                                <ul>
                                    {memos.map((memo) => (
                                        <li key={memo.memoPublicId}>
                                            <MemoRow
                                                memo={memo}
                                                box={box}
                                                active={
                                                    memo.memoPublicId ===
                                                    selectedId
                                                }
                                                onSelect={() =>
                                                    handleSelect(memo)
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                                <div
                                    ref={sentinelRef}
                                    aria-hidden
                                    className="h-px"
                                />
                                {active.isFetchingNextPage && (
                                    <p
                                        role="status"
                                        className="py-2 text-center text-xs text-content-subtle"
                                    >
                                        더 불러오는 중…
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 우: 상세 (모바일은 미선택 시 숨김) */}
                <div
                    className={`min-w-0 flex-col ${
                        selectedId ? 'flex' : 'hidden lg:flex'
                    }`}
                >
                    <MemoDetailPane
                        selectedId={selectedId}
                        box={box}
                        memo={detail.data}
                        isPending={detail.isPending && selectedId !== null}
                        isError={detail.isError}
                        error={detail.error}
                        isDeleting={deleteMutation.isPending}
                        onRetry={() => void detail.refetch()}
                        onBack={() => setSelectedId(null)}
                        onReply={(target) => openCompose(target)}
                        onDelete={handleDelete}
                    />
                </div>
            </section>
            <DesktopPageButton
                icon={TbPencil}
                label="쪽지 쓰기"
                onClick={() => openCompose()}
            />

            <MemoComposeDialog
                open={composeOpen}
                prefillTo={composePrefill}
                isSubmitting={sendMutation.isPending}
                submitError={sendMutation.error}
                onClose={() => setComposeOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    )
}

function TabButton({
    active,
    onClick,
    label,
    badge,
}: {
    active: boolean
    onClick: () => void
    label: string
    badge?: number
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
                active
                    ? 'bg-content-surface text-content-fg shadow-sm'
                    : 'text-content-subtle hover:text-content-fg'
            }`}
            onClick={onClick}
        >
            {label}
            {badge !== undefined && badge > 0 && (
                <span className="inline-grid min-w-[18px] place-items-center rounded-full bg-control-action px-1 text-[11px] font-bold text-control-action-ink tabular-nums">
                    {badge}
                </span>
            )}
        </button>
    )
}

function ListSkeleton() {
    return (
        <ul aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
                <li
                    key={index}
                    className="flex items-start gap-3 border-b border-content-line px-4 py-3.5"
                >
                    <div className="size-10 animate-pulse rounded-full bg-content-soft" />
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-content-soft" />
                        <div className="h-3 w-4/5 animate-pulse rounded bg-content-soft" />
                    </div>
                </li>
            ))}
        </ul>
    )
}

function ListState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-content-soft text-content-line">
                <Icon aria-hidden className="size-6" />
            </span>
            <h2 className="mt-1 text-base font-bold text-content-fg">
                {title}
            </h2>
            <p className="text-sm text-content-subtle">{description}</p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    )
}
