import { hasErrorCode, isApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 교환(지갑) 서버 에러 → UI 문구 (계약 §4.4 · §5) — FC-075.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`memberErrors.ts`·`bidErrors.ts` 와 같은 원칙). 코드가 바뀌어도 화면은 흔들리지 않는다.
 * ★ `EXC_001`(캐시 부족)·`EXC_002`(역방향 미지원)는 둘 다 422 라 **status 로는 못 가른다**
 *   → 반드시 `code` 로 분기한다(사용자 대응이 다르다).
 */
export function exchangeErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.EXC_001)) {
        return '캐시 잔액이 부족합니다. 교환할 금액을 다시 확인해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.EXC_002)) {
        return '현재는 캐시 → 게임머니 교환만 지원합니다.'
    }
    if (isApiError(error) && error.status === 400) {
        return '교환 금액이 올바르지 않습니다.'
    }
    return '교환을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
