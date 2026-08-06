import { useState } from 'react'
import { TbPencil, TbTrash, TbAlertTriangle } from 'react-icons/tb'
import { useDeleteComment, useUpdateComment } from '@/lib/queries/comments'
import { avatarInitial, formatPostTime } from '@/features/board/lib/postView'
import { commentErrorMessage } from '@/features/board/lib/boardErrors'
import type { CommentResponse } from '@/lib/api/comments'

/**
 * 댓글 1건 — 표시 + 인라인 수정/삭제 (FC-203).
 *
 * ★ 수정/삭제 버튼은 `editable`(작성자 or 관리자, 서버 판정)일 때만 노출한다. 인가 권위는 서버(§1.2).
 * ★ 수정은 인라인 텍스트에어리어로 전환, 삭제는 2단 확인(모달 없이 행 안에서). 실패는 문구로 안내.
 */
const CONTENT_MAX = 1000

interface CommentItemProps {
    slug: string
    postPublicId: string
    comment: CommentResponse
}

export default function CommentItem({
    slug,
    postPublicId,
    comment,
}: CommentItemProps) {
    const [editing, setEditing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [draft, setDraft] = useState(comment.content)

    const updateMutation = useUpdateComment(
        postPublicId,
        comment.commentPublicId,
    )
    const deleteMutation = useDeleteComment(
        slug,
        postPublicId,
        comment.commentPublicId,
    )

    const edited = comment.updatedAt !== comment.createdAt
    const trimmed = draft.trim()
    const canSave =
        trimmed.length > 0 &&
        draft.length <= CONTENT_MAX &&
        !updateMutation.isPending

    const handleSave = () => {
        if (!canSave) return
        updateMutation.mutate(
            { content: trimmed },
            { onSuccess: () => setEditing(false) },
        )
    }

    const startEdit = () => {
        setDraft(comment.content)
        updateMutation.reset()
        setEditing(true)
    }

    return (
        <li className="flex gap-3 py-4">
            <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-200 text-xs font-bold text-gray-600"
            >
                {avatarInitial(comment.authorNickname)}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <b className="text-sm font-bold text-gray-900">
                        {comment.authorNickname}
                    </b>
                    <span className="text-xs text-gray-400">
                        {formatPostTime(comment.createdAt)}
                        {edited && ' · 수정됨'}
                    </span>

                    {comment.editable && !editing && !confirmDelete && (
                        <span className="ml-auto flex gap-1.5">
                            <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-gray-700"
                                onClick={startEdit}
                            >
                                <TbPencil aria-hidden className="size-3.5" />
                                수정
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-danger"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <TbTrash aria-hidden className="size-3.5" />
                                삭제
                            </button>
                        </span>
                    )}
                </div>

                {editing ? (
                    <div className="mt-2">
                        <textarea
                            value={draft}
                            maxLength={CONTENT_MAX}
                            rows={3}
                            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange focus:ring-2 focus:ring-orange-subtle"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        {updateMutation.isError && (
                            <p
                                role="alert"
                                className="mt-1.5 flex items-center gap-1.5 text-xs text-danger"
                            >
                                <TbAlertTriangle
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                                {commentErrorMessage(updateMutation.error)}
                            </p>
                        )}
                        <div className="mt-2 flex items-center justify-end gap-2">
                            <span className="mr-auto text-xs text-gray-400 tabular-nums">
                                {draft.length} / {CONTENT_MAX}
                            </span>
                            <button
                                type="button"
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                                onClick={() => setEditing(false)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                disabled={!canSave}
                                className="rounded-lg bg-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={handleSave}
                            >
                                {updateMutation.isPending ? '저장 중…' : '저장'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {comment.content}
                    </p>
                )}

                {confirmDelete && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-subtle px-3 py-2">
                        <span className="text-xs font-semibold text-danger">
                            이 댓글을 삭제할까요?
                        </span>
                        {deleteMutation.isError && (
                            <span className="text-xs text-danger">
                                {commentErrorMessage(deleteMutation.error)}
                            </span>
                        )}
                        <span className="ml-auto flex gap-1.5">
                            <button
                                type="button"
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-navy"
                                onClick={() => setConfirmDelete(false)}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                disabled={deleteMutation.isPending}
                                className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => deleteMutation.mutate()}
                            >
                                {deleteMutation.isPending ? '삭제 중…' : '삭제'}
                            </button>
                        </span>
                    </div>
                )}
            </div>
        </li>
    )
}
