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
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-navy"
        >
            <span
                className={`flex size-11 items-center justify-center rounded-xl ${
                    isEvent
                        ? 'bg-orange-subtle text-orange-deep'
                        : isNotice
                          ? 'bg-navy text-gold-bright'
                          : 'bg-navy text-white'
                }`}
            >
                <Icon aria-hidden className="size-6" />
            </span>

            <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900">
                    {board.name}
                </h3>
                {board.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {board.description}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        board.writePolicy === 'ADMIN_ONLY'
                            ? 'bg-navy text-white'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                >
                    {board.writePolicy === 'ADMIN_ONLY' ? '관리자' : '누구나'}
                </span>
                <span className="text-xs text-gray-400">
                    {board.allowComments ? '댓글 참여' : '댓글 없음'}
                </span>
            </div>

            <span className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm font-bold text-navy">
                바로가기
                <TbChevronRight aria-hidden className="size-4" />
            </span>
        </Link>
    )
}
