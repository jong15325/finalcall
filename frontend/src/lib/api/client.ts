import type { ApiEnvelope } from '@/types/api';
import { ERROR_CODES } from '@/types/errorCodes';
import {
  ApiError,
  networkError,
  normalizeErrorResponse,
} from './errors';
import {
  applyRotatedTokens,
  clearSession,
  getAccessToken,
  getRefreshToken,
} from './session';

/** base URL (계약 [1.1] `/api/v1`). env 오버라이드 가능(.env.example). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** 401 refresh 회전을 시도하지 않는 경로 — 무한 루프 방지(인증 계열 자체). */
const AUTH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/refresh']);

export interface RequestOptions {
  /** 쿼리 파라미터 — undefined/null 값은 제외 */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** JSON 본문 */
  body?: unknown;
  /** 추가 헤더 (예: exchanges 의 Idempotency-Key) */
  headers?: Record<string, string>;
  /** 인증 첨부 여부 (기본 true). 공개 GET 에서 false 가능. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (!raw) return undefined;
  // delta-seconds 형식만 지원(HTTP-date 는 미지원 — 서버는 초 단위를 보낸다).
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

/**
 * envelope 언랩 (계약 [1.4]).
 * 성공: data 반환. 에러: ApiError throw. 204/빈 본문: undefined.
 * 엣지 오류(GATEWAY_*)도 동일 envelope 이므로 별도 파서를 두지 않는다([1.6]).
 */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) {
    if (res.ok) return undefined as T;
    throw networkError(`빈 응답 (HTTP ${res.status})`, res.status);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw networkError(`비정형 응답 (HTTP ${res.status})`, res.status);
  }

  if (envelope.success) return envelope.data;
  throw normalizeErrorResponse(envelope, res.status, parseRetryAfterMs(res.headers));
}

async function rawFetch(path: string, method: string, options: RequestOptions): Promise<Response> {
  const { query, body, headers, auth = true, signal } = options;
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set('Content-Type', 'application/json');
  finalHeaders.set('Accept', 'application/json');

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw networkError('네트워크 요청 실패');
  }
}

// ── refresh 회전 (계약 [2] 회전 정책) ────────────────────────────────
// 동시 401 다발 시 refresh 호출을 1회로 합류(single-flight)시킨다.
let refreshPromise: Promise<void> | null = null;

async function performRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    throw new ApiError({ code: ERROR_CODES.AUTH_004, message: '세션 없음', status: 401 });
  }

  const res = await rawFetch('/auth/refresh', 'POST', { body: { refreshToken }, auth: false });
  try {
    // 응답: { accessToken, refreshToken, accessExpiresAt } — 회전된 신규 refreshToken 포함
    const tokens = await unwrap<{
      accessToken: string;
      refreshToken: string;
      accessExpiresAt: string;
    }>(res);
    applyRotatedTokens(tokens);
  } catch (error) {
    // AUTH_004 등 refresh 실패 → 세션 정리 후 재로그인 유도([2], skeleton-plan [5])
    clearSession();
    throw error;
  }
}

function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * 코어 요청. envelope 언랩 후 data 반환.
 * 401(+인증 경로 아님 + refresh 보유) 시 refresh 회전 1회 시도 후 원요청 재시도.
 */
async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, method, options);

  if (res.status === 401 && options.auth !== false && !AUTH_PATHS.has(path) && getRefreshToken()) {
    await refreshSession(); // 실패 시 throw → 아래 재시도 없이 전파(세션 이미 정리됨)
    const retryRes = await rawFetch(path, method, options);
    return unwrap<T>(retryRes);
  }

  return unwrap<T>(res);
}

/** 계약 엔드포인트 단위 함수는 이 헬퍼 위에 구축한다(프론트 CLAUDE.md [5]). */
export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, { ...options, body }),
};
