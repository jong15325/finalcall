import { apiClient } from './client'
import type { CursorPage } from '@/types/api'

/**
 * 게시판·게시글 API (계약 v1.23 §6 — EPIC-BOARD) — FC-202.
 *
 * ★ 계약 스키마와 1:1. 클라 편의를 위한 필드 추가·개명 금지(`types/api.ts` 상단 규칙).
 * ★ 목록·상세·게시판 조회는 **공개**(인증 불요) → `auth:false`. 쓰기(작성·수정·삭제)만 인증.
 *   인가 주체·작성자는 요청 바디가 아니라 SecurityContext 로 서버가 취한다(B-009·IDOR 차단) —
 *   클라는 `authorId` 를 보내지 않는다. 관리자 여부는 서버가 `ROLE_ADMIN` 으로 판정한다.
 * ★ 댓글·이미지 업로드 API 는 이 파일에 두지 않는다 — 댓글=FC-203, 이미지 첨부=FC-204 소관.
 */

/**
 * 게시판 유형 — 프론트 렌더링 변주·정렬 힌트(계약 §6.1). **인가에는 관여하지 않는다**.
 * ★ 알려진 값을 유니온으로 좁히되 `(string & {})` 를 열어둔다 — 서버가 우리가 모르는 유형을
 *   먼저 배포해도 타입 에러 대신 중립 폴백으로 흐르게(계약 §3.3 태도).
 */
export type BoardType =
    'GENERAL' | 'NOTICE' | 'EVENT' | (string & Record<never, never>)

/** 쓰기 권한 정책(계약 §6.1). `ADMIN_ONLY`=관리자만 · `AUTHENTICATED`=로그인 회원. */
export type WritePolicy =
    'ADMIN_ONLY' | 'AUTHENTICATED' | (string & Record<never, never>)

/** BoardResponse (계약 §6.1) */
export interface BoardResponse {
    slug: string
    name: string
    description: string | null
    boardType: BoardType
    writePolicy: WritePolicy
    allowComments: boolean
    sortOrder: number
}

/**
 * PostSummary (계약 §6.2 — 목록 항목).
 * `thumbnailUrl`=첫 첨부 이미지 presigned url(없으면 null). `authorNickname`=작성 시점 스냅샷.
 */
export interface PostSummary {
    postPublicId: string
    title: string
    authorNickname: string
    authorPrimaryCharacterId?: number | null
    isPinned: boolean
    viewCount: number
    commentCount: number
    /** 첫 첨부 이미지 url. 없으면 null. presigned 라 응답마다 갱신될 수 있다(§6.4) */
    thumbnailUrl?: string | null
    createdAt: string
}

/** 상세 첨부 이미지(계약 §6.2 `images[]`). `url`=서버가 읽기 시점 생성한 presigned GET(§6.4). */
export interface PostImageResponse {
    imagePublicId: string
    url: string
    sortOrder: number
}

/**
 * PostDetailResponse (계약 §6.2 상세).
 *
 * ★ `editable`=요청 주체가 작성자이거나 관리자면 true(비로그인·타인 false). **수정/삭제 버튼
 *   노출 제어용 표시값일 뿐 인가 권위는 서버(§1.2)**.
 * ★ `images` 는 지금 빈 배열로 온다(이미지 업로드 FC-200/FC-204 미완). 갤러리는 이 배열이
 *   비면 렌더하지 않는다 — 슬롯만 대비한다.
 */
export interface PostDetailResponse {
    postPublicId: string
    boardSlug: string
    title: string
    content: string
    authorNickname: string
    authorPrimaryCharacterId?: number | null
    isPinned: boolean
    viewCount: number
    commentCount: number
    images: PostImageResponse[]
    createdAt: string
    updatedAt: string
    editable: boolean
}

/** 게시글 목록 커서 쿼리(계약 §6.2 · §1.3 cursor). */
export interface PostListQuery {
    size?: number
    cursor?: string
}

/**
 * 게시글 작성/수정 요청(계약 §6.2). `title`≤200·`content`≤10000·`imagePublicIds`≤10(선택).
 * 작성자·조회수·댓글수는 요청에 없다(서버 세팅). `imagePublicIds` 는 이미지 첨부(FC-204) 전까지 생략.
 */
export interface PostWriteRequest {
    title: string
    content: string
    imagePublicIds?: string[]
}

/** `POST /boards/{slug}/posts` 201(계약 §6.2). */
export interface CreatePostResponse {
    postPublicId: string
}

/** `GET /boards` — 게시판 목록(공개). `is_active=true`만·`sort_order asc`(서버 정렬). */
export function getBoards(signal?: AbortSignal): Promise<BoardResponse[]> {
    return apiClient
        .get<{ boards: BoardResponse[] }>('/boards', { auth: false, signal })
        .then((data) => data.boards)
}

/** `GET /boards/{slug}` — 게시판 단건(공개). 없으면 `BOARD_001`(404). */
export function getBoard(
    slug: string,
    signal?: AbortSignal,
): Promise<BoardResponse> {
    return apiClient.get<BoardResponse>(`/boards/${slug}`, {
        auth: false,
        signal,
    })
}

/** `GET /boards/{slug}/posts` — 게시글 목록 커서(공개). 정렬=고정 우선·최신순(서버). */
export function getPosts(
    slug: string,
    query: PostListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<PostSummary>> {
    return apiClient.get<CursorPage<PostSummary>>(`/boards/${slug}/posts`, {
        query: { ...query },
        auth: false,
        signal,
    })
}

/**
 * `GET /boards/{slug}/posts/{postPublicId}` — **인증 불요(공개)이되 인증 시 뷰어종속 `editable` 을 얻는다.**
 *
 * ★★ 그래서 `auth: false` 를 쓰지 **않는다**(`items.ts` `getItemInstance` 의 `slotNo` 선례와 동일).
 *    기본(`auth: true`)은 토큰이 있으면 붙이고 없으면 안 붙인다 — 게스트·만료토큰은 200 익명
 *    취급되어 `editable=false`, 로그인 주체는 작성자/관리자면 `editable=true` 를 받는다.
 *    `auth:false` 로 두면 로그인 상태에서도 토큰이 빠져 자기 글이 항상 수정 불가로 판정됐다(리뷰 MAJOR-1).
 * ★ 서버가 이 조회로 `viewCount` 를 원자 증가시킨다(디둡 없음, §6.2). 불필요한 재조회는
 *   조회수를 부풀리므로 상세 쿼리는 창 포커스 재조회를 끈다(queries/boards 참고).
 */
export function getPost(
    slug: string,
    postPublicId: string,
    signal?: AbortSignal,
): Promise<PostDetailResponse> {
    return apiClient.get<PostDetailResponse>(
        `/boards/${slug}/posts/${postPublicId}`,
        { signal },
    )
}

/**
 * `POST /boards/{slug}/posts` — 게시글 작성(**인증 필요** + write_policy 충족).
 * 실패: `BOARD_001`(404)·`BOARD_002`(권한 없음 403)·검증 400·401.
 */
export function createPost(
    slug: string,
    body: PostWriteRequest,
): Promise<CreatePostResponse> {
    return apiClient.post<CreatePostResponse>(`/boards/${slug}/posts`, body)
}

/**
 * `PUT /boards/{slug}/posts/{postPublicId}` — 게시글 수정(**인증 필요** + 작성자 or 관리자).
 * 응답 204(본문 없음). 실패: `POST_001`(404)·`POST_002`(403)·`BOARD_002`(403)·검증 400·401.
 */
export function updatePost(
    slug: string,
    postPublicId: string,
    body: PostWriteRequest,
): Promise<void> {
    return apiClient.put<void>(`/boards/${slug}/posts/${postPublicId}`, body)
}

/**
 * `DELETE /boards/{slug}/posts/{postPublicId}` — 게시글 삭제(soft, **인증 필요** + 작성자 or 관리자).
 * 응답 204. 실패: `POST_001`(404)·`POST_002`(403)·`BOARD_002`(403)·401.
 */
export function deletePost(slug: string, postPublicId: string): Promise<void> {
    return apiClient.delete<void>(`/boards/${slug}/posts/${postPublicId}`)
}
