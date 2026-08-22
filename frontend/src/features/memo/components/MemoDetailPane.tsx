import {
    TbArrowBackUp,
    TbChevronLeft,
    TbMailOpened,
    TbTrash,
} from 'react-icons/tb'
import MemoAvatar from './MemoAvatar'
import MemoLevelTag from './MemoLevelTag'
import GamePreview from './GamePreview'
import { memoAccessErrorMessage } from '@/features/memo/lib/memoErrors'
import {
    avatarInitial,
    formatMemoTimeFull,
    isSystemMemo,
} from '@/features/memo/lib/memoView'
import type { MemoBox } from '@/features/memo/lib/memoView'
import type { MemoResponse } from '@/lib/api/memos'

/**
 * 쪽지 상세 패널 (FC-172) — 데스크톱 2단의 우측, 모바일 전체화면 상세.
 *
 * ★ 상태를 모두 우아하게: 선택 없음(데스크톱 빈 안내) · 로딩 스켈레톤 · 에러(재시도) · 상세.
 * ★ 상세 표시 대상은 박스 축에 따라 다르다 — 받은함=발신자(레벨 태그 있음), 보낸함=수신자(상대
 *   스냅샷 없음 → 레벨 태그 생략). 답장 대상도 이 규칙을 따른다(호출부가 계산).
 * ★ "게임에서 이렇게 보여요" 미리보기를 본문 아래 상시 노출(28바이트 폭, 게임 boundary 재현).
 * ★ 뒤로가기 버튼은 모바일에서만 노출(`lg:hidden`) — 데스크톱은 좌측 목록이 늘 보인다.
 */
interface MemoDetailPaneProps {
    /** 선택된 메모 public id(없으면 빈 안내) */
    selectedId: string | null
    box: MemoBox
    memo: MemoResponse | undefined
    isPending: boolean
    isError: boolean
    error: unknown
    onRetry: () => void
    onBack: () => void
    onReply: (targetNickname: string) => void
    onDelete: () => void
    isDeleting: boolean
}

function MemoDetailPane({
    selectedId,
    box,
    memo,
    isPending,
    isError,
    error,
    onRetry,
    onBack,
    onReply,
    onDelete,
    isDeleting,
}: MemoDetailPaneProps) {
    if (selectedId === null) {
        return (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-10 text-center lg:flex">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-content-soft text-content-line">
                    <TbMailOpened aria-hidden className="size-7" />
                </span>
                <p className="text-sm text-content-subtle">
                    왼쪽에서 쪽지를 선택하면 여기에 내용이 표시됩니다.
                </p>
            </div>
        )
    }

    if (isPending) {
        return <DetailSkeleton onBack={onBack} />
    }

    if (isError || !memo) {
        return (
            <div className="flex flex-1 flex-col">
                <MobileBackBar onBack={onBack} />
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                    <p className="text-sm text-content-subtle">
                        {memoAccessErrorMessage(error)}
                    </p>
                    <button
                        type="button"
                        className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                        onClick={onRetry}
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        )
    }

    const system = isSystemMemo(memo.type)
    const name = box === 'sent' ? memo.receiverNickname : memo.senderNickname
    const showLevel = box === 'received' && !system
    const replyTarget =
        box === 'sent' ? memo.receiverNickname : memo.senderNickname
    const readNote =
        box === 'received' ? (memo.isRead ? '읽음' : '안 읽음') : null

    return (
        <div className="flex flex-1 flex-col">
            <MobileBackBar onBack={onBack} />

            {/* 헤더 */}
            <div className="flex items-start gap-3 border-b border-content-line px-5 py-4">
                <MemoAvatar
                    initial={avatarInitial(name)}
                    name={name}
                    system={system}
                    className="size-11"
                    primaryCharacterId={
                        box === 'sent'
                            ? memo.receiverPrimaryCharacterId
                            : memo.senderPrimaryCharacterId
                    }
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-base font-bold text-content-fg">
                            {name}
                        </span>
                        {system ? (
                            <span className="flex-none rounded-full bg-brand-structure/10 px-1.5 py-0.5 text-[10px] font-bold text-chrome-selected">
                                시스템
                            </span>
                        ) : (
                            showLevel && (
                                <MemoLevelTag
                                    level={memo.senderLevel}
                                    gender={memo.senderGender}
                                />
                            )
                        )}
                    </div>
                    <p className="mt-1 text-xs text-content-subtle">
                        {box === 'received' ? '받은 쪽지' : '보낸 쪽지'} ·{' '}
                        {formatMemoTimeFull(memo.createdAt)}
                        {readNote ? ` · ${readNote}` : ''}
                    </p>
                </div>

                <div className="flex flex-none items-center gap-2">
                    {/* 시스템 메모엔 답장하지 않는다(운영자 발신 · 수신 불가) */}
                    {!system && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-content-line bg-content-surface px-3 py-2 text-sm font-bold text-content-fg hover:bg-content-soft"
                            onClick={() => onReply(replyTarget)}
                        >
                            <TbArrowBackUp aria-hidden className="size-4" />
                            답장
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 rounded-lg border border-content-line bg-content-surface px-3 py-2 text-sm font-bold text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={onDelete}
                    >
                        <TbTrash aria-hidden className="size-4" />
                        {isDeleting ? '삭제 중…' : '삭제'}
                    </button>
                </div>
            </div>

            {/* 본문 + 게임 미리보기 */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                <p className="whitespace-pre-wrap break-keep px-5 py-5 text-[15px] leading-7 text-content-fg">
                    {memo.body}
                </p>
                <div className="px-5 pb-5">
                    <GamePreview
                        body={memo.body}
                        caption="게임에서는 한 줄 28바이트(한글 2·영문숫자 1)로 자동 줄바꿈됩니다. 글자 중간은 잘리지 않습니다."
                    />
                </div>
            </div>
        </div>
    )
}

/** 모바일 상세 상단 뒤로가기 바(데스크톱에선 숨김). */
function MobileBackBar({ onBack }: { onBack: () => void }) {
    return (
        <div className="flex h-12 items-center gap-1 border-b border-content-line px-2 lg:hidden">
            <button
                type="button"
                aria-label="목록으로"
                className="flex size-9 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft"
                onClick={onBack}
            >
                <TbChevronLeft aria-hidden className="size-5" />
            </button>
            <span className="text-sm font-bold text-content-fg">쪽지</span>
        </div>
    )
}

function DetailSkeleton({ onBack }: { onBack: () => void }) {
    return (
        <div aria-hidden className="flex flex-1 flex-col">
            <MobileBackBar onBack={onBack} />
            <div className="flex items-start gap-3 border-b border-content-line px-5 py-4">
                <div className="size-11 animate-pulse rounded-full bg-content-soft" />
                <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-32 animate-pulse rounded bg-content-soft" />
                    <div className="h-3 w-48 animate-pulse rounded bg-content-soft" />
                </div>
            </div>
            <div className="space-y-2 px-5 py-5">
                <div className="h-4 w-full animate-pulse rounded bg-content-soft" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-content-soft" />
                <div className="h-24 w-full animate-pulse rounded bg-content-soft" />
            </div>
        </div>
    )
}

export default MemoDetailPane
