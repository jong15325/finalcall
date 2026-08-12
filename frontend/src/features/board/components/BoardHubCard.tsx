import { Link } from 'react-router'
import { TbChevronRight } from 'react-icons/tb'
import { boardPath } from '@/app/paths'
import { boardTypeMeta } from '@/features/board/lib/boardMeta'
import type { BoardResponse } from '@/lib/api/boards'

/**
 * 게시판 허브 카드 — `/boards` 진입 화면의 게시판 1장 (FC-202, 목업 화면 A).
 *
 * ★ 유형별 아이콘·강조를 `boardTypeMeta` 로 통일한다. 쓰기정책·댓글허용을 배지로 미리 알린다
 *   (표시 제어 — 인가는 서버).
 */
interface BoardHubCardProps {
    board: BoardResponse
}

export default function BoardHubCard({ board }: BoardHubCardProps) {
    const { icon: Icon } = boardTypeMeta(board.boardType)
    const isNotice = board.boardType === 'NOTICE'
    const isEvent = board.boardType === 'EVENT'

    return (
        <Link
            to={boardPath(board.slug)}
            className="flex flex-col gap-3 rounded-2xl border border-content-line bg-content-surface p-5 transition-colors hover:border-brand-structure"
        >
            <span
                className={`flex size-11 items-center justify-center rounded-xl ${
                    isEvent
                        ? 'bg-control-action-soft text-control-action-hover'
                        : isNotice
                          ? 'bg-brand-structure text-brand-highlight-bright'
                          : 'bg-brand-structure text-on-strong'
                }`}
            >
                <Icon aria-hidden className="size-6" />
            </span>

            <div className="min-w-0">
                <h3 className="text-lg font-bold text-content-fg">
                    {board.name}
                </h3>
                {board.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-content-subtle">
                        {board.description}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        board.writePolicy === 'ADMIN_ONLY'
                            ? 'bg-brand-structure text-on-strong'
                            : 'bg-content-soft text-content-muted'
                    }`}
                >
                    {board.writePolicy === 'ADMIN_ONLY' ? '관리자' : '누구나'}
                </span>
                <span className="text-xs text-content-subtle">
                    {board.allowComments ? '댓글 참여' : '댓글 없음'}
                </span>
            </div>

            <span className="mt-auto flex items-center justify-between border-t border-content-line pt-3 text-sm font-bold text-brand-structure">
                바로가기
                <TbChevronRight aria-hidden className="size-4" />
            </span>
        </Link>
    )
}
