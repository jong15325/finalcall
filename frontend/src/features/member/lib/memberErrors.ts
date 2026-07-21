import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 회원(마이페이지) 서버 에러 → UI 문구 (계약 §2.5 · §5) — FC-074.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`bidErrors.ts` 와 같은 원칙). 코드가 뒤바뀌거나 원문이 바뀌어도 화면은 흔들리지 않는다.
 */

/**
 * 닉네임 수정 실패 문구.
 * `MEMBER_001`(409) = 닉네임 중복. 400 = 형식 위반. 그 외 = 일반 전송 실패.
 */
export function nicknameErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.MEMBER_001)) {
        return '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.'
    }
    if (isApiError(error) && error.status === 400) {
        return '닉네임 형식이 올바르지 않습니다.'
    }
    return '닉네임을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 탈퇴 실패 문구.
 * `MEMBER_002`(409) = 진행 중 거래 보유(입찰·출품·정산 미완). 그 외 = 일반 전송 실패.
 * ★ 동의 누락 400 은 UI 가 체크박스로 선행 차단하고 api 층이 필수 필드를 실어 보내 발생하지 않는다.
 */
export function withdrawErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.MEMBER_002)) {
        return '진행 중인 거래(입찰·출품 등)가 있어 탈퇴할 수 없습니다. 정리한 뒤 다시 시도해 주세요.'
    }
    return '탈퇴를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
