/**
 * 계약 [1.4] 응답 envelope + [1.3] 페이징 타입.
 * 계약 스키마와 1:1 — 클라 편의를 위한 임의 필드 추가·개명 금지(skeleton-plan [5]).
 */

/** 검증 실패 시 항목 (계약 [1.4] `errors[]`) */
export interface FieldError {
  field: string;
  reason: string;
}

/** 성공 envelope (계약 [1.4]) */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * 에러 envelope (계약 [1.4]).
 * `code`는 도메인 ErrorCode({DOMAIN}_NNN) 또는 엣지 `GATEWAY_*`([1.6]).
 * 알 수 없는 신규 코드 수신 가능성을 열어두기 위해 wire 타입은 string으로 둔다
 * (분기 비교는 types/errorCodes.ts 의 ERROR_CODES 상수 사용).
 */
export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  errors?: FieldError[];
  timestamp: string;
}

/** envelope 판별 유니온 */
export type ApiEnvelope<T> = ApiResponse<T> | ErrorResponse;

/** cursor 페이지 (계약 [1.3] — 실시간 목록 기본) */
export interface CursorPage<T> {
  content: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

/** offset 페이지 (계약 [1.3] — 관리·소규모 예외) */
export interface OffsetPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
