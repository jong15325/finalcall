import { Link } from 'react-router'
import { TbPhoto, TbPin, TbEye, TbMessage } from 'react-icons/tb'
import { boardPostPath } from '@/app/paths'
import { formatPostTime } from '@/features/board/lib/postView'
import type { PostSummary } from '@/lib/api/boards'

/**
 * 게시글 목록 카드 (FC-202, 목업 화면 B — 카드형·썸네일 포함).
 *
 * ★ 상단고정(`isPinned`)은 골드 배경 + 핀 배지로 목록 최상단에서 눈에 걸리게 한다.
 * ★ 썸네일 없으면 자리를 비운다(가짜 이미지 렌더 금지). `commentCount`=0 이면 배지 생략.
 * ★ 댓글수는 표시만 한다 — 댓글 CRUD 는 FC-203 소관(여기선 요약 수치만).
 */
interface PostCardProps {
    slug: string
    post: PostSummary
    /** 댓글 허용 게시판만 댓글수 배지를 낸다(공지=미표시). */
    showComments: boolean
}

export default function PostCard({ slug, post, showComments }: PostCardProps) {
    return (
        <Link
            to={boardPostPath(slug, post.postPublicId)}
            className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors ${
                post.isPinned
                    ? 'bg-gold-subtle hover:bg-[#f2e7bf]'
                    : 'hover:bg-gray-50'
            }`}
        >
            {post.thumbnailUrl ? (
                <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-lg border border-line object-cover"
                />
            ) : (
                <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-300"
                >
                    <TbPhoto className="size-5" />
                </span>
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {post.isPinned && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-subtle px-2 py-0.5 text-[11px] font-bold text-gold-deep ring-1 ring-gold/30">
                            <TbPin aria-hidden className="size-3" />
                            고정
                        </span>
                    )}
                    <span className="truncate text-[15px] font-bold text-gray-900">
                        {post.title}
                    </span>
                    {showComments && post.commentCount > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold text-orange-deep">
                            <TbMessage aria-hidden className="size-3.5" />
                            {post.commentCount}
                        </span>
                    )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span className="truncate">{post.authorNickname}</span>
                    <span aria-hidden className="text-gray-300">
                        ·
                    </span>
                    <span className="shrink-0">
                        {formatPostTime(post.createdAt)}
                    </span>
                    <span aria-hidden className="text-gray-300">
                        ·
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5">
                        <TbEye aria-hidden className="size-3.5" />
                        {post.viewCount.toLocaleString()}
                    </span>
                </div>
            </div>
        </Link>
    )
}
