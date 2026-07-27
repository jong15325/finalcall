import { apiClient } from './client'

/**
 * 이메일 설정·인증 엔드포인트 (계약 §2 email 3종, v1.15) — FC-138.
 *
 * ★ 세 엔드포인트 모두 **인증 필요**이고 주체는 SecurityContext(userId)다 — 임의 이메일을
 *   파라미터로 받지 않아(자기 계정 이메일만) 이메일 열거면이 열리지 않는다(계약 §2·SEC-007).
 *   그래서 `verification-request` 는 요청 바디가 없고, `verify` 는 코드만 받는다.
 * ★ 계약이 준 응답 스키마를 그대로 둔다 — `PUT` 만 방금 제출한 정규화 이메일을 에코하고(설정 폼
 *   전용), 그 외 화면은 `GET /me` 의 마스킹을 쓴다(원문 미노출, 계약 §2.5). 여기서 합치지 않는다.
 */

/**
 * `PUT /me/email` 응답 200 — 방금 제출한 정규화 이메일 에코 + 재초기화된 인증 상태.
 * 이메일 변경은 `emailVerified=false` 로 재초기화되고 pending 코드·쿨다운이 폐기된다(계약 §2).
 */
export interface SetEmailResponse {
    email: string
    emailVerified: false
}

/** `POST /me/email/verify` 응답 200 — 인증 성공 플래그. */
export interface VerifyEmailResponse {
    emailVerified: true
}

/**
 * 이메일 설정/변경 (`PUT /me/email`).
 * 실패: `EMAIL_007` 이미 사용 중(409)·검증 400·401. 동일 이메일 재제출은 no-op(인증 상태 유지).
 */
export function setEmail(email: string): Promise<SetEmailResponse> {
    return apiClient.put<SetEmailResponse>('/me/email', { email })
}

/**
 * 인증 코드 발송 요청 (`POST /me/email/verification-request`, 202 · 본문 없음).
 * 요청 바디는 없다(계정 이메일 사용). 실패: `EMAIL_004` 쿨다운(429)·`EMAIL_005` 이미 인증(409)·
 * `EMAIL_006` 이메일 미설정(409)·401.
 */
export function requestEmailVerification(): Promise<void> {
    return apiClient.post<void>('/me/email/verification-request')
}

/**
 * 인증 코드 확인 (`POST /me/email/verify`).
 * 실패: `EMAIL_001` 불일치(422)·`EMAIL_002` 만료·미발송 통일(422)·`EMAIL_003` 시도 초과·코드
 * 폐기(429)·`EMAIL_005` 이미 인증(409)·검증 400·401. 코드는 6자리 숫자다(`\d{6}`).
 */
export function verifyEmailCode(code: string): Promise<VerifyEmailResponse> {
    return apiClient.post<VerifyEmailResponse>('/me/email/verify', { code })
}
