import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 인증(로그인·회원가입) 서버 에러 → UI 문구 (계약 §2 · §5) — FC-078.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`memberErrors.ts`·`exchangeErrors.ts` 와 같은 원칙). 코드가 뒤바뀌거나 원문이 바뀌어도
 *   화면은 흔들리지 않는다.
 */

/**
 * 로그인 실패 문구.
 * `AUTH_003`(401) = 자격 불일치 — ★ **아이디/비밀번호 중 무엇이 틀렸는지 노출하지 않는다**
 * (회원 열거 방지 SEC-007). 서버도 단일 코드로만 내려주고, 화면도 단일 문구로만 응답한다.
 */
export function loginErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.AUTH_003)) {
        return '아이디 또는 비밀번호가 올바르지 않습니다.'
    }
    if (isApiError(error) && error.status === 400) {
        return '아이디와 비밀번호를 다시 확인해 주세요.'
    }
    return '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 회원가입 실패 문구.
 * `AUTH_001`(409) = 중복 loginId(최소화 문구) · `AUTH_002`(409) = 중복 nickname · 400 = 형식 위반.
 * ★ `AUTH_001`·`AUTH_002` 는 둘 다 409 라 **status 로는 못 가른다** → 반드시 `code` 로 분기한다
 *   (한쪽은 아이디, 한쪽은 닉네임을 고쳐야 한다).
 */
export function signupErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.AUTH_001)) {
        return '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.AUTH_002)) {
        return '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.'
    }
    if (isApiError(error) && error.status === 400) {
        return '입력값을 확인해 주세요. 아이디·비밀번호·닉네임 형식을 지켜 주세요.'
    }
    return '회원가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
