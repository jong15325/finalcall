import { hasErrorCode } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 임시보관 이동(relocate) 서버 에러 → UI 문구 (계약 §4.2 · §5) — FC-076.
 *
 * ★ **서버 원문(`message`)을 노출하지 않는다** — `code` 로 분기해 우리 문구를 낸다
 *   (`memberErrors.ts`·`bidErrors.ts` 와 같은 원칙).
 * ★ 코드마다 사용자가 할 일이 다르다 — 뭉뚱그리지 않는다:
 *   - `INV_001`(만실) → 인벤토리를 비워야 한다(칸을 비우면 풀린다).
 *   - `INV_002`(슬롯 점유) → 자동 배정으로 재시도(우리는 slotNo 를 지정하지 않으므로 경합·재시도).
 *   - `ITEM_002`(소유자 아님) → 내 아이템이 아니다(목록 새로고침).
 *   - `ITEM_003`(TEMP 아님) → 이미 옮겨졌거나 상태가 바뀌었다(다른 탭 처리 등 → 목록 새로고침).
 */
export function relocateErrorMessage(error: unknown): string {
    if (hasErrorCode(error, ERROR_CODES.INV_001)) {
        return '인벤토리가 가득 찼습니다. 정규 슬롯을 비운 뒤 다시 이동해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.INV_002)) {
        return '대상 슬롯이 사용 중입니다. 잠시 후 다시 시도해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.ITEM_002)) {
        return '내 아이템이 아닙니다. 목록을 새로고침해 주세요.'
    }
    if (hasErrorCode(error, ERROR_CODES.ITEM_003)) {
        return '이미 옮겨졌거나 이동할 수 없는 상태입니다. 목록을 새로고침해 주세요.'
    }
    return '아이템을 이동하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
