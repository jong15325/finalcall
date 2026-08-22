import { apiClient } from './client'
import type { OffsetPage } from '@/types/api'

/**
 * 댓글 API (계약 v1.24 §6.3 — EPIC-COMMENT-V2 네이버식 확장) — FC-210.
 *
 * ★ 댓글 경로는 게시글 `postPublicId`(전역 유일)에 직접 건다 — 게시판 slug 아래로 중첩하지
 *   않는다(계약 §6.3). 목록은 **offset 페이징**(글당 소규모, 계약 §1.3 예외).
 * ★ v1.24: 목록은 **루트 댓글만** 반환하고(답글은 별도 API `…/replies`), 각 댓글에 답글 수·
 *   공감/비공감·내 반응·삭제(tombstone) 여부를 싣는다. 형상은 v1.0에서 하위호환 없이 교체됐다
 *   (게이트2 (c) 확정 — 외부 소비자 없음).
 * ★★ 목록·답글 조회는 **공개**이되 인증 시 뷰어종속 `myReaction`·`editable`을 얻는다 →
 *    `auth: false`를 쓰지 **않는다**(`items.ts` `getItemInstance` 선례). 토큰이 있으면 붙이고
 *    없으면 안 붙인다 — 게스트는 `myReaction=null`·`editable=false`, 로그인 주체는 자기 반응·
 *    자기/관리자 댓글 `editable=true`를 받는다. `auth:false`로 두면 로그인 상태에서도 항상
 *    게스트 판정이 돼 자기 댓글이 수정 불가로 나온다(FC-203 리뷰 MAJOR-1).
 */

/** 루트 목록 정렬(계약 §6.3). 답글 목록은 항상 시간순(`OLDEST`)이라 param 없음. */
export type CommentSort = 'LATEST' | 'OLDEST' | 'LIKES'

/** 공감/비공감 반응 종류(계약 §6.3). 반응 토글 동작은 FC-211. */
export type ReactionType = 'LIKE' | 'DISLIKE'

/**
 * CommentResponse — 루트 목록·답글 공통 코어(계약 §6.3).
 *
 * ★ `deleted=true`(tombstone, §13.4)면 `content`·`authorNickname`=null, 카운트 0,
 *   `editable=false`, `ownedByMe=false`, `myReaction=null`으로 마스킹돼 온다. 렌더는 이 플래그로
 *   분기한다.
 */
export interface CommentResponse {
    commentPublicId: string
    authorNickname: string | null
    authorPrimaryCharacterId?: number | null
    content: string | null
    createdAt: string
    updatedAt: string
    editable: boolean
    ownedByMe: boolean
    likeCount: number
    dislikeCount: number
    myReaction: ReactionType | null
    deleted: boolean
}

/** 루트 목록 항목 = 코어 + `replyCount`(이 루트의 활성 답글 수, 네이버 "답글 N개"). */
export interface RootCommentResponse extends CommentResponse {
    replyCount: number
}

/**
 * 답글 항목 = 코어 + `mentionedNickname`(계약 §6.3).
 * `mentionedNickname`=답글의 답글일 때 @멘션 대상 닉 스냅샷(직접 답글이면 null). 답글은
 * 1단계 평탄화라 `replyCount`가 없다(§13.1).
 */
export interface ReplyResponse extends CommentResponse {
    mentionedNickname: string | null
}

/** `POST …/comments`·`…/replies` 201(계약 §6.3). */
export interface CreateCommentResponse {
    commentPublicId: string
    createdAt: string
}

/**
 * `GET /posts/{postPublicId}/comments` — 루트 댓글 목록(offset, 계약 §6.3).
 * `sort`=`LATEST`(최신순·기본)|`OLDEST`(과거순)|`LIKES`(순공감순). tombstone 루트는 포함돼 온다.
 */
export function getComments(
    postPublicId: string,
    query: { page: number; size: number; sort: CommentSort },
    signal?: AbortSignal,
): Promise<OffsetPage<RootCommentResponse>> {
    return apiClient.get<OffsetPage<RootCommentResponse>>(
        `/posts/${postPublicId}/comments`,
        { query: { ...query }, signal },
    )
}

/**
 * `GET /posts/{postPublicId}/comments/{commentPublicId}/replies` — 답글 목록(offset, 계약 §6.3).
 * 정렬은 `id asc`(시간순) 고정(param 없음). 삭제 답글은 배제돼 온다(§13.4).
 */
export function getReplies(
    postPublicId: string,
    commentPublicId: string,
    query: { page: number; size: number },
    signal?: AbortSignal,
): Promise<OffsetPage<ReplyResponse>> {
    return apiClient.get<OffsetPage<ReplyResponse>>(
        `/posts/${postPublicId}/comments/${commentPublicId}/replies`,
        { query: { ...query }, signal },
    )
}

/**
 * `POST /posts/{postPublicId}/comments` — 루트 댓글 작성(**인증 필요** + `allow_comments`).
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
 * `POST /posts/{postPublicId}/comments/{commentPublicId}/replies` — 답글 작성(계약 §6.3).
 *
 * ★ 대상은 경로의 `commentPublicId`다 — 서버가 대상의 루트를 해석한다(§13.1): 대상이 루트면
 *   그 루트에 직접 답글(멘션 없음), 대상이 답글이면 같은 루트로 평탄화하며 대상 작성자에게
 *   `@멘션`. 프론트는 대상 닉 프리필만 표시하고 평탄화·멘션 결정은 서버에 맡긴다.
 * 실패: `COMMENT_001`(404)·`POST_001`(404)·`BOARD_003`(422)·검증 400·401.
 */
export function createReply(
    postPublicId: string,
    commentPublicId: string,
    body: { content: string },
): Promise<CreateCommentResponse> {
    return apiClient.post<CreateCommentResponse>(
        `/posts/${postPublicId}/comments/${commentPublicId}/replies`,
        body,
    )
}

/**
 * `PUT /posts/{postPublicId}/comments/{commentPublicId}` — 댓글·답글 수정(계약 §6.3).
 * 루트·답글 공통(commentPublicId로 대상). 인증 필요 + 작성자 or 관리자. 응답 204.
 * 실패: `COMMENT_001`(404)·`COMMENT_002`(403)·검증 400·401.
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
 * `DELETE /posts/{postPublicId}/comments/{commentPublicId}` — 삭제(soft, 계약 §6.3).
 * 루트·답글 공통. 답글 삭제는 완전 배제, 활성 답글 있는 루트 삭제는 tombstone 잔류(§13.4).
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

/** `PUT …/reaction` 200 응답 — 반영 후 최종 상태(계약 §6.3). 낙관적 업데이트의 권위값. */
export interface ReactionResult {
    likeCount: number
    dislikeCount: number
    myReaction: ReactionType | null
}

/**
 * `PUT /posts/{postPublicId}/comments/{commentPublicId}/reaction` — 공감/비공감 토글(계약 §6.3, §13.2).
 *
 * ★ 단일 엔드포인트가 등록·전환·취소를 모두 흡수한다 — 현재 반응이 요청 `type`과 같으면 취소
 *   (myReaction→null), 다르면 등록/전환. 루트·답글 공통(commentPublicId로 대상).
 * ★ 인증 **필요** + 대상 미삭제 + **본인 댓글 아님**. 실패: 검증 400·401·`COMMENT_001`(404)·
 *   `COMMENT_003`(자기 댓글 반응 금지 422). 응답은 반영 후 최종 카운트·내 반응(권위값).
 */
export function toggleReaction(
    postPublicId: string,
    commentPublicId: string,
    type: ReactionType,
): Promise<ReactionResult> {
    return apiClient.put<ReactionResult>(
        `/posts/${postPublicId}/comments/${commentPublicId}/reaction`,
        { type },
    )
}
