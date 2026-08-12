import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
    TbPhoto,
    TbPlus,
    TbX,
    TbChevronLeft,
    TbChevronRight,
    TbAlertTriangle,
    TbLoader2,
} from 'react-icons/tb'
import { uploadBoardImage } from '@/lib/api/boardImages'
import { imageUploadErrorMessage } from '@/features/board/lib/boardErrors'
import type { UploadBoardImageResponse } from '@/lib/api/boardImages'

/**
 * 이미지 첨부 업로더 (FC-204, 계약 §6.4 — 2단계 업로드).
 *
 * ★ 파일 선택 → `POST /board-images` 업로드 → `imagePublicId`·미리보기 url 수집. 상위(PostForm)가
 *   보유한 목록을 이 컴포넌트가 갱신하고, 제출 시 **배열 순서 = 표시 순서**로 `imagePublicIds` 전송.
 * ★ **presigned url 은 미리보기용** — 저장·재사용하지 않는다(응답마다 갱신, §6.4).
 * ★ ≤10장·5MB 가드는 클라에서 미리 막되(불필요한 업로드 회피), 형식 최종 판정은 서버(매직바이트).
 * ★ 순서는 좌우 이동 버튼으로 조정한다(순번 배지 = sortOrder). 드래그 라이브러리는 도입하지 않는다.
 */
const MAX_IMAGES = 10
const MAX_SIZE_BYTES = 5 * 1024 * 1024

interface ImageUploaderProps {
    images: UploadBoardImageResponse[]
    setImages: React.Dispatch<React.SetStateAction<UploadBoardImageResponse[]>>
}

export default function ImageUploader({
    images,
    setImages,
}: ImageUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploadingCount, setUploadingCount] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const uploadMutation = useMutation({ mutationFn: uploadBoardImage })

    const total = images.length + uploadingCount
    const isFull = total >= MAX_IMAGES

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return
        setError(null)

        // 유효 파일만 선택 순서대로 수집(남은 칸·크기·형식 가드) — File 참조는 여기서 확보한다.
        let available = MAX_IMAGES - images.length - uploadingCount
        const valid: File[] = []
        for (const file of Array.from(fileList)) {
            if (available <= 0) {
                setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`)
                break
            }
            if (file.size > MAX_SIZE_BYTES) {
                setError('5MB 이하 이미지만 올릴 수 있어요.')
                continue
            }
            if (!file.type.startsWith('image/')) {
                setError('이미지 파일만 올릴 수 있어요.')
                continue
            }
            available -= 1
            valid.push(file)
        }
        if (valid.length === 0) return

        // ★★ **순차 업로드** — 병렬 완료순 append 는 sortOrder 가 선택 순서와 어긋난다(리뷰 MINOR-2).
        //    한 장씩 await 해 append 하면 배열 순서 = 선택 순서 = 표시 순서가 보존된다.
        setUploadingCount((count) => count + valid.length)
        for (const file of valid) {
            try {
                const result = await uploadMutation.mutateAsync(file)
                setImages((previous) =>
                    previous.length >= MAX_IMAGES
                        ? previous
                        : [...previous, result],
                )
            } catch (uploadError) {
                setError(imageUploadErrorMessage(uploadError))
            } finally {
                setUploadingCount((count) => Math.max(0, count - 1))
            }
        }
    }

    const remove = (imagePublicId: string) =>
        setImages((previous) =>
            previous.filter((image) => image.imagePublicId !== imagePublicId),
        )

    const move = (from: number, to: number) =>
        setImages((previous) => {
            if (to < 0 || to >= previous.length) return previous
            const next = [...previous]
            const [item] = next.splice(from, 1)
            next.splice(to, 0, item)
            return next
        })

    const openPicker = () => inputRef.current?.click()

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-content-fg">
                    이미지 첨부
                </span>
                <span className="text-xs text-content-subtle tabular-nums">
                    {total} / {MAX_IMAGES}
                </span>
            </div>

            <input
                ref={inputRef}
                multiple
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                    void handleFiles(event.target.files)
                    // 같은 파일을 다시 고를 수 있도록 값을 비운다.
                    event.target.value = ''
                }}
            />

            {images.length === 0 && uploadingCount === 0 ? (
                <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-content-line bg-content-soft px-4 py-6 text-sm text-content-subtle hover:border-brand-structure"
                    onClick={openPicker}
                >
                    <span className="grid size-10 place-items-center rounded-xl border border-content-line bg-content-surface text-content-subtle">
                        <TbPhoto aria-hidden className="size-5" />
                    </span>
                    이미지를 <b className="text-brand-structure">추가</b>하세요 (최대{' '}
                    {MAX_IMAGES}장 · 5MB · jpg/png/webp/gif)
                </button>
            ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {images.map((image, index) => (
                        <div
                            key={image.imagePublicId}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-content-line bg-content-soft"
                        >
                            {/* presigned 미리보기 만료 시 이미지가 깨져도 첨부는 유효하다(imagePublicId 만 제출).
                                깨지면 아래 사진 아이콘이 드러난다(리뷰 MINOR-5). */}
                            <span
                                aria-hidden
                                className="absolute inset-0 grid place-items-center text-content-line"
                            >
                                <TbPhoto className="size-5" />
                            </span>
                            <img
                                src={image.url}
                                alt=""
                                className="relative size-full object-cover"
                                onError={(event) => {
                                    event.currentTarget.style.visibility =
                                        'hidden'
                                }}
                            />
                            <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-brand-structure/80 text-[11px] font-bold text-on-strong tabular-nums">
                                {index + 1}
                            </span>
                            <button
                                type="button"
                                aria-label="이미지 제거"
                                className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-brand-structure/80 text-on-strong hover:bg-danger"
                                onClick={() => remove(image.imagePublicId)}
                            >
                                <TbX aria-hidden className="size-3" />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-brand-structure/70 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                    type="button"
                                    aria-label="앞으로 이동"
                                    disabled={index === 0}
                                    className="grid size-5 place-items-center rounded text-on-strong hover:bg-content-surface/20 disabled:opacity-30"
                                    onClick={() => move(index, index - 1)}
                                >
                                    <TbChevronLeft
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                </button>
                                <button
                                    type="button"
                                    aria-label="뒤로 이동"
                                    disabled={index === images.length - 1}
                                    className="grid size-5 place-items-center rounded text-on-strong hover:bg-content-surface/20 disabled:opacity-30"
                                    onClick={() => move(index, index + 1)}
                                >
                                    <TbChevronRight
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* 업로드 중 타일 */}
                    {Array.from({ length: uploadingCount }).map((_, index) => (
                        <div
                            key={`uploading-${index}`}
                            className="grid aspect-square place-items-center rounded-lg border border-content-line bg-content-soft text-content-subtle"
                        >
                            <TbLoader2
                                aria-hidden
                                className="size-5 animate-spin"
                            />
                        </div>
                    ))}

                    {/* 추가 타일 */}
                    {!isFull && (
                        <button
                            type="button"
                            className="grid aspect-square place-items-center rounded-lg border border-dashed border-content-line bg-content-surface text-content-subtle hover:border-brand-structure hover:text-brand-structure"
                            onClick={openPicker}
                        >
                            <TbPlus aria-hidden className="size-5" />
                        </button>
                    )}
                </div>
            )}

            {error && (
                <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs text-danger-ink"
                >
                    <TbAlertTriangle
                        aria-hidden
                        className="size-3.5 shrink-0"
                    />
                    {error}
                </p>
            )}
        </div>
    )
}
