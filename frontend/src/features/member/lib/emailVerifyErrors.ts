import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 이메일 인증 서버 에러 → UI 문구·재시도성 (계약 §2·§5, 목업 상태 카탈로그) — FC-138.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`memberErrors.ts`·`exchangeErrors.ts` 와 같은 원칙). 코드가 바뀌어도 화면은 흔들리지 않는다.
 * ★ EMAIL_001~007 은 **재시도성이 각각 다르다**(spec §8 F3·목업 ⓔ) — 한 문구로 뭉뚱그리지 않는다:
 *   불일치=다시 입력 / 만료·시도초과=코드 재발급 / 쿨다운=기다림 / 이미 인증=재시도 불필요 /
 *   미설정=먼저 등록 / 이미 사용 중=다른 주소. `kind` 로 이 분류를 실어 호출부가 톤·흐름을 가른다.
 */

/** 재시도성 분류(목업 retry-tag) — 문구 색·다음 행동을 가른다. */
export type EmailErrorKind =
    | 'again' // 다시 입력(코드 유효) — EMAIL_001
    | 'reissue' // 코드 재발급 — EMAIL_002·003
    | 'wait' // 잠시 후 재시도 — EMAIL_004
    | 'info' // 재시도 불필요(이미 됨) — EMAIL_005
    | 'setup' // 먼저 이메일 등록 — EMAIL_006
    | 'field' // 폼 필드 정정(다른 주소) — EMAIL_007
    | 'generic' // 그 외(네트워크·검증 등)

export interface EmailErrorInfo {
    message: string
    kind: EmailErrorKind
}

/**
 * 이메일 인증 전 계열(설정·발송·확인) 공통 에러 매퍼.
 * 코드가 없으면(네트워크·비정형) `generic` 폴백을 낸다.
 */
export function emailErrorInfo(error: unknown): EmailErrorInfo {
    if (hasErrorCode(error, ERROR_CODES.EMAIL_001)) {
        return {
            message: '코드가 일치하지 않아요. 다시 확인해 주세요.',
            kind: 'again',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_002)) {
        return {
            message:
                '인증 코드가 만료됐어요. 새 코드를 받아 다시 시도해 주세요.',
            kind: 'reissue',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_003)) {
        return {
            message:
                '시도 횟수를 초과해 코드가 폐기됐어요. 코드를 다시 받아 주세요.',
            kind: 'reissue',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_004)) {
        return {
            message: '방금 코드를 보냈어요. 잠시 후 다시 시도해 주세요.',
            kind: 'wait',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_005)) {
        return {
            message: '이미 인증된 이메일이에요. 추가 인증이 필요 없습니다.',
            kind: 'info',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_006)) {
        return {
            message: '등록된 이메일이 없어요. 먼저 이메일을 등록해 주세요.',
            kind: 'setup',
        }
    }
    if (hasErrorCode(error, ERROR_CODES.EMAIL_007)) {
        return {
            message: '이미 다른 계정에서 사용 중인 이메일이에요.',
            kind: 'field',
        }
    }
    if (isApiError(error) && error.status === 400) {
        return { message: '입력값이 올바르지 않아요.', kind: 'generic' }
    }
    return {
        message: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
        kind: 'generic',
    }
}

/** 문구만 필요할 때. */
export function emailErrorMessage(error: unknown): string {
    return emailErrorInfo(error).message
}
