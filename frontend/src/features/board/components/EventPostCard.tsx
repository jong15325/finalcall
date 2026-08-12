import { Link } from 'react-router'
import { TbPhoto, TbPin, TbMessage } from 'react-icons/tb'
import { boardPostPath } from '@/app/paths'
import { formatPostTime } from '@/features/board/lib/postView'
import type { PostSummary } from '@/lib/api/boards'

/**
 * 이벤트 게시글 배너 카드 (FC-202, 목업 화면 B2 — EVENT 변주).
 *
 * ★ 이벤트 게시판은 첫 이미지(배너)를 강조한 카드 그리드로 그린다. 썸네일이 없으면 네이비
 *   그라데이션 자리로 대체한다(배너 부재 시에도 카드 형태 유지).
 */
interface EventPostCardProps {
    slug: string
    post: PostSummary
}

export default function EventPostCard({ slug, post }: EventPostCardProps) {
    return (
        <Link
            to={boardPostPath(slug, post.postPublicId)}
            className="flex flex-col overflow-hidden rounded-xl border border-content-line bg-content-surface transition-shadow hover:border-content-line hover:shadow-md"
        >
            <div className="relative aspect-[16/7]">
                {post.thumbnailUrl ? (
                    <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                    />
                ) : (
                    <span
                        aria-hidden
                        className="grid size-full place-items-center bg-gradient-to-br from-chrome-selected to-brand-structure text-brand-structure"
                    >
                        <TbPhoto className="size-8 text-on-strong/40" />
                    </span>
                )}
                {post.isPinned && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-highlight-soft px-2 py-0.5 text-[11px] font-bold text-brand-highlight-deep">
                        <TbPin aria-hidden className="size-3" />
                        진행중
                    </span>
                )}
            </div>
            <div className="p-4">
                <h3 className="truncate text-[15px] font-bold text-content-fg">
                    {post.title}
                </h3>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-content-subtle">
                    <span>{formatPostTime(post.createdAt)}</span>
                    {post.commentCount > 0 && (
                        <>
                            <span aria-hidden className="text-content-line">
                                ·
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-control-action-hover">
                                <TbMessage aria-hidden className="size-3.5" />
                                {post.commentCount}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </Link>
    )
}
