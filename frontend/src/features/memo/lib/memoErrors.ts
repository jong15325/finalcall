import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 메모/쪽지 서버 에러 → UI 문구 (계약 §2.6 · §5) — FC-172.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`memberErrors.ts`·`emailVerifyErrors.ts` 원칙). 발신·조회/삭제는 실패 코드 집합이 달라
 *   함수를 나눈다.
 */

/**
 * 발신 실패 문구(`POST /me/memos`).
 * `MEMO_001`(404) = 수신자 없음(활성 회원 아님). `MEMO_004`(422) = 자기 발신. 400 = 형식·용량.
 */
export function sendMemoErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.MEMO_001)) {
        return '해당 닉네임의 회원을 찾을 수 없습니다. 닉네임을 확인해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.MEMO_004)) {
        return '자기 자신에게는 쪽지를 보낼 수 없습니다.'
    }
    if (isApiError(error) && error.status === 400) {
        return '받는 사람 또는 내용 형식이 올바르지 않습니다.'
    }
    return '쪽지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 조회·삭제 실패 문구(`GET`/`DELETE /me/memos/{id}`).
 * `MEMO_002`(404) = 메모 없음. `MEMO_003`(403) = 당사자 아님. 둘 다 목록이 어긋난 상황이라
 * "목록을 새로고침" 으로 안내한다(IDOR·삭제 경합).
 */
export function memoAccessErrorMessage(error: unknown): string {
    if (
        hasErrorCode(error, ERROR_CODES.MEMO_002) ||
        hasErrorCode(error, ERROR_CODES.MEMO_003)
    ) {
        return '쪽지를 찾을 수 없습니다. 이미 삭제되었거나 접근할 수 없는 쪽지입니다.'
    }
    return '쪽지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/** 삭제 실패 문구 — 접근 에러와 같은 코드 집합이나 동작 문맥이 달라 별도 문구. */
export function deleteMemoErrorMessage(error: unknown): string {
    if (
        hasErrorCode(error, ERROR_CODES.MEMO_002) ||
        hasErrorCode(error, ERROR_CODES.MEMO_003)
    ) {
        return '이미 삭제되었거나 접근할 수 없는 쪽지입니다. 목록을 새로고침해 주세요.'
    }
    return '쪽지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
