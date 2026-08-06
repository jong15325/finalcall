import { apiClient } from './client'
import type { OffsetPage } from '@/types/api'

/**
 * 댓글 API (계약 v1.23 §6.3 — EPIC-BOARD) — FC-203.
 *
 * ★ 댓글 경로는 게시글 `postPublicId`(전역 유일)에 직접 건다 — 게시판 slug 아래로 중첩하지
 *   않는다(계약 §6.3 1단 중첩). 목록은 **offset 페이징**(글당 소규모, 계약 §1.3 예외).
 * ★ 목록 조회는 **공개**(인증 불요). 작성·수정·삭제만 인증. 작성자·주체는 서버가
 *   SecurityContext 로 취한다(B-009·IDOR 차단) — 클라는 `authorId` 를 보내지 않는다.
 */

/** CommentResponse (계약 §6.3). `editable`=주체가 작성자이거나 관리자면 true(표시 제어). */
export interface CommentResponse {
    commentPublicId: string
    authorNickname: string
    content: string
    createdAt: string
    updatedAt: string
    editable: boolean
}

/** `POST /posts/{postPublicId}/comments` 201(계약 §6.3). */
export interface CreateCommentResponse {
    commentPublicId: string
    createdAt: string
}

/**
 * `GET /posts/{postPublicId}/comments` — offset 페이지. `id asc`(작성순, 서버).
 *
 * ★★ **인증 불요(공개)이되 인증 시 뷰어종속 `editable` 을 얻는다** → `auth: false` 를 쓰지 않는다
 *    (`items.ts` `getItemInstance` 선례). 토큰이 있으면 붙이고 없으면 안 붙인다 — 게스트는
 *    `editable=false`, 로그인 주체는 자기/관리자 댓글에 `editable=true`. `auth:false` 로 두면
 *    로그인 상태에서도 자기 댓글이 항상 수정 불가로 판정됐다(리뷰 MAJOR-1).
 */
export function getComments(
    postPublicId: string,
    query: { page: number; size: number },
    signal?: AbortSignal,
): Promise<OffsetPage<CommentResponse>> {
    return apiClient.get<OffsetPage<CommentResponse>>(
        `/posts/${postPublicId}/comments`,
        { query: { ...query }, signal },
    )
}

/**
 * `POST /posts/{postPublicId}/comments` — 댓글 작성(**인증 필요** + `allow_comments`).
 * `content`≤1000·`@NotBlank`. 실패: `POST_001`(404)·`BOARD_003`(댓글 비허용 422)·검증 400·401.
 */
export function createComment(
    postPublicId: string,
    body: { content: string },
): Promise<CreateCommentResponse> {
    return apiClient.post<CreateCommentResponse>(
        `/posts/${postPublicId}/comments`,
        body,
    )
}

/**
 * `PUT /posts/{postPublicId}/comments/{commentPublicId}` — 수정(**인증 필요** + 작성자 or 관리자).
 * 응답 204. 실패: `COMMENT_001`(404)·`COMMENT_002`(403)·검증 400·401.
 */
export function updateComment(
    postPublicId: string,
    commentPublicId: string,
    body: { content: string },
): Promise<void> {
    return apiClient.put<void>(
        `/posts/${postPublicId}/comments/${commentPublicId}`,
        body,
    )
}

/**
 * `DELETE /posts/{postPublicId}/comments/{commentPublicId}` — 삭제(soft, 작성자 or 관리자).
 * 응답 204. 실패: `COMMENT_001`(404)·`COMMENT_002`(403)·401.
 */
export function deleteComment(
    postPublicId: string,
    commentPublicId: string,
): Promise<void> {
    return apiClient.delete<void>(
        `/posts/${postPublicId}/comments/${commentPublicId}`,
    )
}
