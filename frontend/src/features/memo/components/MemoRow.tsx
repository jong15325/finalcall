import MemoAvatar from './MemoAvatar'
import MemoLevelTag from './MemoLevelTag'
import {
    avatarInitial,
    formatMemoTimeRelative,
    isSystemMemo,
    summaryCounterpartName,
} from '@/features/memo/lib/memoView'
import type { MemoBox } from '@/features/memo/lib/memoView'
import type { MemoSummary } from '@/lib/api/memos'

/**
 * 쪽지 목록 행 (FC-172) — 아바타 · 상대 닉네임 · 레벨/성별 태그 · 시각 · 본문 미리보기 · 미열람 점.
 *
 * ★ 미열람(받은함)만 본문·닉을 진하게 + 오렌지 점으로 강조한다(읽은 쪽지는 muted). 보낸함은
 *   미열람 개념이 없으므로 점을 그리지 않는다.
 * ★ 레벨/성별은 **발신자 스냅샷**이라 받은함(상대=발신자)에서만 의미가 있다 — 보낸함(상대=수신자)
 *   에는 상대 스냅샷이 없어 태그를 생략한다(계약 §2.6, 오표기 방지).
 * ★ 시스템(운영자) 메모는 네이비 아바타 + "시스템" 칩으로 회원 쪽지와 구분한다.
 */
interface MemoRowProps {
    memo: MemoSummary
    box: MemoBox
    active: boolean
    onSelect: () => void
}

function MemoRow({ memo, box, active, onSelect }: MemoRowProps) {
    const system = isSystemMemo(memo.type)
    const name = summaryCounterpartName(memo, box)
    const unread = box === 'received' && !memo.isRead
    const showLevel = box === 'received' && !system

    return (
        <button
            type="button"
            aria-current={active}
            className={`flex w-full items-start gap-3 border-b border-content-line px-4 py-3.5 text-left transition-colors ${
                active
                    ? 'bg-control-action-soft'
                    : 'bg-content-surface hover:bg-content-soft'
            }`}
            onClick={onSelect}
        >
            <MemoAvatar
                initial={avatarInitial(name)}
                name={name}
                system={system}
                className="size-10"
                primaryCharacterId={
                    box === 'received'
                        ? memo.senderPrimaryCharacterId
                        : memo.receiverPrimaryCharacterId
                }
            />

            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span
                            className={`truncate text-sm ${
                                unread
                                    ? 'font-bold text-content-fg'
                                    : 'font-semibold text-content-fg'
                            }`}
                        >
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
                    </span>
                    <span className="flex flex-none items-center gap-1.5">
                        <span className="text-[11px] text-content-subtle">
                            {formatMemoTimeRelative(memo.createdAt)}
                        </span>
                        {unread && (
                            <span
                                className="size-2 rounded-full bg-control-action"
                                aria-label="안 읽음"
                            />
                        )}
                    </span>
                </span>
                <span
                    className={`mt-1 block truncate text-[13px] ${
                        unread ? 'text-content-fg' : 'text-content-subtle'
                    }`}
                >
                    {memo.bodyPreview}
                </span>
            </span>
        </button>
    )
}

export default MemoRow
