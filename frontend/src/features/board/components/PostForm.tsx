import { useState } from 'react'
import { TbInfoCircle, TbAlertTriangle } from 'react-icons/tb'
import ImageUploader from './ImageUploader'
import type { BoardResponse, PostWriteRequest } from '@/lib/api/boards'
import type { UploadBoardImageResponse } from '@/lib/api/boardImages'

/**
 * 게시글 작성/수정 폼 (FC-202 → FC-204 이미지 첨부 실기능화). 작성·수정이 같은 폼을 쓴다.
 *
 * ★ 검증은 클라에서 미리 막되(제목 ≤200·본문 ≤10000·빈 값 금지), **최종 판정은 서버**다(§1.2).
 * ★ 이미지는 2단계 업로드(계약 §6.4) — `ImageUploader` 가 업로드해 모은 `imagePublicId` 배열을
 *   **최종 집합**으로 제출한다(수정 시 남긴 것만 전송 → 누락분 서버 언바인딩, §6.2). 배열 순서=표시 순서.
 */

const TITLE_MAX = 200
const CONTENT_MAX = 10000

interface PostFormProps {
    board: BoardResponse
    /** 수정 시 초기값(작성이면 생략) */
    initial?: { title: string; content: string }
    /** 수정 시 기존 첨부 이미지(작성이면 생략). presigned url 은 미리보기용. */
    initialImages?: UploadBoardImageResponse[]
    /** 제출 문구(작성="등록"·수정="수정"). */
    submitLabel: string
    isSubmitting: boolean
    /** 서버/네트워크 실패 문구(없으면 미표시). */
    errorMessage?: string | null
    onSubmit: (body: PostWriteRequest) => void
    onCancel: () => void
}

export default function PostForm({
    board,
    initial,
    initialImages,
    submitLabel,
    isSubmitting,
    errorMessage,
    onSubmit,
    onCancel,
}: PostFormProps) {
    const [title, setTitle] = useState(initial?.title ?? '')
    const [content, setContent] = useState(initial?.content ?? '')
    const [images, setImages] = useState<UploadBoardImageResponse[]>(
        initialImages ?? [],
    )

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    const titleValid = trimmedTitle.length > 0 && title.length <= TITLE_MAX
    const contentValid =
        trimmedContent.length > 0 && content.length <= CONTENT_MAX
    const canSubmit = titleValid && contentValid && !isSubmitting

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        onSubmit({
            title: trimmedTitle,
            content: trimmedContent,
            imagePublicIds: images.map((image) => image.imagePublicId),
        })
    }

    return (
        <form
            className="rounded-2xl border border-content-line bg-content-surface p-6 sm:p-7"
            onSubmit={handleSubmit}
        >
            {/* 게시판 안내 */}
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-content-soft px-3.5 py-3 text-sm text-content-muted">
                <TbInfoCircle
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-brand-structure"
                />
                <span>
                    <b className="text-content-fg">{board.name}</b>에 글을
                    올립니다.
                    {board.writePolicy === 'ADMIN_ONLY'
                        ? ' 관리자만 작성할 수 있어요.'
                        : ' 서로 존중하는 글을 남겨주세요.'}
                </span>
            </div>

            {errorMessage && (
                <p
                    role="alert"
                    className="mb-5 flex items-center gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
                >
                    <TbAlertTriangle aria-hidden className="size-4 shrink-0" />
                    {errorMessage}
                </p>
            )}

            {/* 제목 */}
            <div className="mb-5">
                <label
                    htmlFor="post-title"
                    className="mb-1.5 block text-sm font-bold text-content-fg"
                >
                    제목 <span className="text-control-action-hover">*</span>
                </label>
                <input
                    id="post-title"
                    type="text"
                    value={title}
                    maxLength={TITLE_MAX}
                    placeholder="제목을 입력하세요"
                    className="h-11 w-full rounded-lg border border-content-line bg-content-surface px-3.5 text-content-fg outline-none focus:border-control-action focus:ring-2 focus:ring-control-action-soft"
                    onChange={(event) => setTitle(event.target.value)}
                />
                <p className="mt-1.5 text-right text-xs text-content-subtle tabular-nums">
                    {title.length} / {TITLE_MAX}
                </p>
            </div>

            {/* 본문 */}
            <div className="mb-5">
                <label
                    htmlFor="post-content"
                    className="mb-1.5 block text-sm font-bold text-content-fg"
                >
                    내용 <span className="text-control-action-hover">*</span>
                </label>
                <textarea
                    id="post-content"
                    value={content}
                    maxLength={CONTENT_MAX}
                    placeholder="내용을 입력하세요"
                    rows={12}
                    className="w-full resize-y rounded-lg border border-content-line bg-content-surface px-3.5 py-3 leading-relaxed text-content-fg outline-none focus:border-control-action focus:ring-2 focus:ring-control-action-soft"
                    onChange={(event) => setContent(event.target.value)}
                />
                <p className="mt-1.5 text-right text-xs text-content-subtle tabular-nums">
                    {content.length.toLocaleString()} /{' '}
                    {CONTENT_MAX.toLocaleString()}
                </p>
            </div>

            {/* 이미지 첨부 (2단계 업로드 · 계약 §6.4) */}
            <div className="mb-6">
                <ImageUploader images={images} setImages={setImages} />
            </div>

            {/* 액션 */}
            <div className="flex justify-end gap-2.5 border-t border-content-line pt-5">
                <button
                    type="button"
                    className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:border-brand-structure"
                    onClick={onCancel}
                >
                    취소
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-on-strong hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? '처리 중…' : submitLabel}
                </button>
            </div>
        </form>
    )
}
