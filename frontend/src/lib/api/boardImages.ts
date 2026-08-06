import { apiClient } from './client'

/**
 * 게시판 이미지 업로드 API (계약 v1.23 §6.4 — 2단계 업로드) — FC-204.
 *
 * ★ 먼저 업로드해 `imagePublicId`·미리보기 `url`(단기 presigned GET)을 받고, 게시글 작성/수정
 *   바디의 `imagePublicIds[]`(≤10, 배열 순서=표시 순서)로 귀속한다(계약 §6.2). 본문 content 에는
 *   URL 을 저장하지 않는다(첨부 갤러리 모델). presigned `url` 은 미리보기용 — **저장·재사용 금지**.
 * ★ 서버가 매직바이트로 형식을 검증하고 5MB 상한을 건다(IMAGE_001·IMAGE_002, 둘 다 422).
 */

/** `POST /board-images` 201 — `url` 은 즉시 미리보기용 presigned GET(TTL). */
export interface UploadBoardImageResponse {
    imagePublicId: string
    url: string
}

/**
 * `POST /api/v1/board-images` — 이미지 1장 업로드(**인증 필요**, multipart `file`).
 * 실패: `IMAGE_001`(미허용 형식 422)·`IMAGE_002`(용량 초과 422)·401.
 */
export function uploadBoardImage(
    file: File,
): Promise<UploadBoardImageResponse> {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<UploadBoardImageResponse>('/board-images', form)
}
