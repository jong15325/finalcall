import { TbMessageCircle, TbAlertTriangle } from 'react-icons/tb'
import { useBoards } from '@/lib/queries/boards'
import BoardHubCard from '@/features/board/components/BoardHubCard'
import BoardStateBlock from '@/features/board/components/BoardStateBlock'
import PageIntro from '@/components/common/PageIntro'

/**
 * 게시판 허브 `/boards` (FC-202 — 디자인 게이트 승인 화면 A).
 *
 * ★ `GET /boards` 레지스트리를 카드로 낸다(커뮤니티·공지·이벤트). 서버가 `is_active=true`만·
 *   `sort_order asc` 로 정렬해 주므로 클라는 그대로 렌더한다.
 * ★ 로딩/빈/에러를 화면 영역에서 낸다(전체 블러 금지).
 */
export default function BoardHubPage() {
    const { data: boards, isPending, isError, refetch } = useBoards()
    return (
        <div className="flex flex-col gap-5">
            <PageIntro
                icon={TbMessageCircle}
                eyebrow="COMMUNITY BOARD"
                title="게시판"
                description="공지·커뮤니티·이벤트 소식을 확인하고 이야기를 나눠보세요."
            />

            {isPending && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-48 animate-pulse rounded-2xl border border-content-line bg-content-surface"
                        />
                    ))}
                </div>
            )}

            {!isPending && isError && (
                <BoardStateBlock
                    icon={TbAlertTriangle}
                    title="게시판을 불러오지 못했어요"
                    description="잠시 후 다시 시도해 주세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                            onClick={() => void refetch()}
                        >
                            다시 시도
                        </button>
                    }
                />
            )}

            {!isPending && !isError && boards && boards.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {boards.map((board) => (
                        <BoardHubCard key={board.slug} board={board} />
                    ))}
                </div>
            )}

            {!isPending && !isError && boards && boards.length === 0 && (
                <BoardStateBlock
                    icon={TbMessageCircle}
                    title="열려 있는 게시판이 없어요"
                    description="곧 게시판이 준비될 예정이에요."
                />
            )}
        </div>
    )
}

