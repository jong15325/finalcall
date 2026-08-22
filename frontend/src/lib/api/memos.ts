import { apiClient } from './client'
import type { CursorPage } from '@/types/api'

/**
 * 메모/쪽지 API (계약 §2.6 `/me/memos`, v1.20) — FC-172.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 전 엔드포인트 **인증 필요**, 주체 = SecurityContext, `/me` 접두(IDOR 설계 차단).
 *   발신자·`type` 은 요청에 싣지 않는다 — 서버가 토큰 주체·`type=5(USER)` 로 고정한다
 *   (시스템 메모 0/14 사칭 차단, 계약 §2.6).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 계약 스키마와 1:1. 상대 닉네임은 **당사자만 조회**라 마스킹하지 않고 원문이 온다
 *   (§3.3 비당사자 마스킹과 성격이 다르다 — 대화 상대를 알아야 함). `senderLevel`·
 *   `senderGender` 는 게임 패킹 int 가 아니라 **분해된 값**으로 온다(현재 기본값 Lv.1·성별 0=남,
 *   게이트2 (a) — user 게임필드 도입 전).
 * ★ 본문은 웹에 **순수 원문**으로 저장·노출된다(수동 개행 없음). 게임 28바이트 자동 줄바꿈은
 *   게임 boundary 전용이며, 웹은 작성·상세에서 미리보기(`memoBytes`)로만 재현한다(게이트2 (d)).
 */

/** `POST /me/memos` 요청 (계약 §2.6) — 발신자·type 은 서버 고정이라 없다. */
export interface SendMemoRequest {
    /** 수신자 닉네임(활성 회원, `@NotBlank`·≤16) */
    receiverNickname: string
    /** 본문(자유 텍스트 단일 필드, `@NotBlank`·≤112바이트 `getStringByte`) */
    body: string
}

/** `POST /me/memos` 응답 201 (계약 §2.6) */
export interface SendMemoResponse {
    memoPublicId: string
    createdAt: string
}

/**
 * 목록 항목 `MemoSummary` (계약 §2.6 받은함·보낸함 공통 record).
 *
 * ★ 받은함은 `senderNickname`·`senderLevel`·`senderGender`(상대=발신자)를 싣고, 보낸함은
 *   `sender 필드 자리에 receiver 노출` — `receiverNickname` 을 싣는다. 두 박스가 같은 record 를
 *   공유하되 채워지는 상대 필드가 다르므로 상대 person 필드를 모두 optional 로 둔다(계약 §2.6).
 *   레벨·성별은 **발신자 스냅샷**이라 받은함에서만 상대(발신자)를 뜻한다.
 */
export interface MemoSummary {
    memoPublicId: string
    /** 메모 종류 — 5=회원(USER), 0/14=시스템(운영자). 웹 발신은 항상 5. */
    type: number
    /** 받은함 = 상대(발신자) 닉네임 */
    senderNickname?: string
    senderPrimaryCharacterId?: number | null
    /** 받은함 = 발신자 레벨 스냅샷(현재 기본 1) */
    senderLevel?: number
    /** 받은함 = 발신자 성별 스냅샷(0=남·1=여, 현재 기본 0) */
    senderGender?: number
    /** 보낸함 = 상대(수신자) 닉네임 */
    receiverNickname?: string
    receiverPrimaryCharacterId?: number | null
    /** 본문 미리보기(목록 전용) */
    bodyPreview: string
    isRead: boolean
    createdAt: string
}

/**
 * 상세 `MemoResponse` (계약 §2.6 `GET /me/memos/{id}`).
 * 발신자·수신자 필드가 모두 채워진다(당사자 조회). GET 호출이 **수신자·미열람이면** 서버가
 * `is_read=true` 로 1회 전이한다(보낸함 열람은 전이 없음).
 */
export interface MemoResponse {
    memoPublicId: string
    type: number
    senderNickname: string
    senderPrimaryCharacterId?: number | null
    senderLevel: number
    senderGender: number
    receiverNickname: string
    receiverPrimaryCharacterId?: number | null
    body: string
    isRead: boolean
    readAt?: string | null
    createdAt: string
}

/** `GET /me/memos/unread-count` 응답 200 — 뱃지용 미열람 카운트. */
export interface UnreadMemoCountResponse {
    count: number
}

/** 커서 페이징 요청(계약 §1.3). */
export interface MemoListQuery {
    cursor?: string
    size?: number
}

/** `POST /me/memos` — 발신. 실패 `MEMO_001`(수신자 없음, 404)·`MEMO_004`(자기 발신, 422)·400·401. */
export function sendMemo(body: SendMemoRequest): Promise<SendMemoResponse> {
    return apiClient.post<SendMemoResponse>('/me/memos', body)
}

/** `GET /me/memos/received` — 받은함(커서, `id desc`). */
export function getReceivedMemos(
    query: MemoListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<MemoSummary>> {
    return apiClient.get<CursorPage<MemoSummary>>('/me/memos/received', {
        query: { ...query },
        signal,
    })
}

/** `GET /me/memos/sent` — 보낸함(커서, `id desc`). */
export function getSentMemos(
    query: MemoListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<MemoSummary>> {
    return apiClient.get<CursorPage<MemoSummary>>('/me/memos/sent', {
        query: { ...query },
        signal,
    })
}

/** `GET /me/memos/unread-count` — 미열람 개수(받은함 미열람). */
export function getUnreadMemoCount(
    signal?: AbortSignal,
): Promise<UnreadMemoCountResponse> {
    return apiClient.get<UnreadMemoCountResponse>('/me/memos/unread-count', {
        signal,
    })
}

/**
 * `GET /me/memos/{id}` — 상세 열람(+수신자 미열람이면 읽음 전이).
 * 실패 `MEMO_002`(없음, 404)·`MEMO_003`(당사자 아님, 403)·401.
 */
export function getMemo(
    memoPublicId: string,
    signal?: AbortSignal,
): Promise<MemoResponse> {
    return apiClient.get<MemoResponse>(
        `/me/memos/${encodeURIComponent(memoPublicId)}`,
        { signal },
    )
}

/**
 * `DELETE /me/memos/{id}` — soft delete(204). **한쪽 삭제가 양쪽 박스에서 사라진다**
 * (게임 `memo_del` 단일 플래그 계승, §2.6). 실패 `MEMO_002`(404)·`MEMO_003`(403)·401.
 */
export function deleteMemo(memoPublicId: string): Promise<void> {
    return apiClient.delete<void>(
        `/me/memos/${encodeURIComponent(memoPublicId)}`,
    )
}
