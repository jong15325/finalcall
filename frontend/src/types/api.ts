/**
 * 계약 §1.4 응답 envelope + §1.3 페이징 타입 (FC-056 복원).
 * 계약 스키마와 1:1 — 클라 편의를 위한 임의 필드 추가·개명 금지.
 */

/** 검증 실패 시 항목 (계약 §1.4 `errors[]`) */
export interface FieldError {
    field: string
    reason: string
}

/** 성공 envelope (계약 §1.4) */
export interface ApiSuccessResponse<T> {
    success: true
    data: T
    timestamp: string
}

/**
 * 에러 envelope (계약 §1.4).
 * `code` 는 도메인 ErrorCode(`{DOMAIN}_NNN`) 또는 엣지 `GATEWAY_*`(§1.6).
 *
 * ★ wire 타입을 `string` 으로 두는 이유 — 서버가 우리가 모르는 신규 코드를 보낼 수 있다.
 *   유니온으로 좁히면 미등록 코드가 타입 에러가 되어 중립 폴백 경로가 사라진다
 *   (계약 v1.10 §3.3.1 클라 의무: 미등록 코드는 중립 처리). 분기 비교는 `ERROR_CODES` 상수로.
 */
export interface ApiErrorResponse {
    success: false
    code: string
    message: string
    errors?: FieldError[]
    timestamp: string
}

/** envelope 판별 유니온 */
export type ApiEnvelope<T> = ApiSuccessResponse<T> | ApiErrorResponse

/** cursor 페이지 (계약 §1.3 — 실시간 목록 기본) */
export interface CursorPage<T> {
    content: T[]
    nextCursor: string | null
    hasNext: boolean
}

/** offset 페이지 (계약 §1.3 — 관리·소규모 예외) */
export interface OffsetPage<T> {
    content: T[]
    page: number
    size: number
    totalElements: number
    totalPages: number
}
