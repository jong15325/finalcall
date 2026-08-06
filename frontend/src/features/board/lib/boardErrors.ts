import { isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 게시판 쓰기(작성·수정·삭제) 실패 문구 매핑 (계약 §6 · §5) — FC-202.
 *
 * ★ 코드별로 안내가 다르다 — 한 문구로 뭉뚱그리지 않는다(errorCodes 주석 태도).
 *   권한 없음(BOARD_002/POST_002)과 없음(BOARD_001/POST_001)은 사용자가 할 일이 정반대다.
 * ★ 서버가 인가 권위다(§1.2). 이 문구는 서버가 거절했을 때의 안내일 뿐이다.
 */
export function boardWriteErrorMessage(error: unknown): string {
    if (!isApiError(error)) {
        return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
    }

    switch (error.code) {
        case ERROR_CODES.BOARD_001:
            return '게시판을 찾을 수 없어요. 목록을 새로고침해 주세요.'
        case ERROR_CODES.BOARD_002:
            return '이 게시판에 글을 쓸 권한이 없어요.'
        case ERROR_CODES.POST_001:
            return '게시글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.'
        case ERROR_CODES.POST_002:
            return '본인이 작성한 글만 수정·삭제할 수 있어요.'
        default:
            // 검증 실패(400)는 필드 사유가 붙어 오면 그걸, 아니면 서버 메시지를 쓴다.
            if (error.status === 400 && error.fieldErrors?.length) {
                return error.fieldErrors[0].reason
            }
            if (error.status === 401) {
                return '로그인이 필요해요.'
            }
            return error.message || '요청을 처리하지 못했어요.'
    }
}

/**
 * 이미지 업로드 실패 문구 매핑 (계약 §6.4 · §5) — FC-204.
 *
 * ★ 형식(IMAGE_001)·용량(IMAGE_002)은 사용자 조치가 다르다 — 뭉뚱그리지 않는다.
 */
export function imageUploadErrorMessage(error: unknown): string {
    if (!isApiError(error)) {
        return '이미지를 업로드하지 못했어요. 잠시 후 다시 시도해 주세요.'
    }

    switch (error.code) {
        case ERROR_CODES.IMAGE_001:
            return '지원하지 않는 형식이에요. jpg·png·webp·gif 만 올릴 수 있어요.'
        case ERROR_CODES.IMAGE_002:
            return '5MB 이하 이미지만 올릴 수 있어요.'
        default:
            if (error.status === 401) return '로그인이 필요해요.'
            return error.message || '이미지를 업로드하지 못했어요.'
    }
}

/**
 * 댓글 작성·수정·삭제 실패 문구 매핑 (계약 §6.3 · §5) — FC-203.
 *
 * ★ 댓글 비허용(BOARD_003)·없음(COMMENT_001)·비작성자(COMMENT_002)·원글 없음(POST_001)은
 *   사용자가 할 일이 각각 다르다 — 뭉뚱그리지 않는다. 인가 권위는 서버(§1.2).
 */
export function commentErrorMessage(error: unknown): string {
    if (!isApiError(error)) {
        return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
    }

    switch (error.code) {
        case ERROR_CODES.BOARD_003:
            return '이 게시판은 댓글을 받지 않아요.'
        case ERROR_CODES.POST_001:
            return '원글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.'
        case ERROR_CODES.COMMENT_001:
            return '댓글을 찾을 수 없어요. 이미 삭제됐을 수 있어요.'
        case ERROR_CODES.COMMENT_002:
            return '본인이 작성한 댓글만 수정·삭제할 수 있어요.'
        default:
            if (error.status === 400 && error.fieldErrors?.length) {
                return error.fieldErrors[0].reason
            }
            if (error.status === 401) {
                return '로그인이 필요해요.'
            }
            return error.message || '요청을 처리하지 못했어요.'
    }
}
