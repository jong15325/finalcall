/**
 * 경매 등록 실패 문구 (계약 §3.1 · §5) — FC-073.
 *
 * ★ **`code` 로 분기한다**(HTTP status 아님) — 같은 422 라도 `AUCTION_003`(즉시구매가)와
 *   `AUCTION_008`(시간)은 사용자가 고칠 필드가 다르다. `field` 로 어느 입력을 짚을지 함께 준다.
 * ★ **서버 message 를 그대로 쓰지 않는다** — 모르는 코드에서만 폴백으로 쓴다(§1.4).
 * ★ `AUCTION_001` 은 **403 단일**(미소유·미보유·미존재 통일, SEC-007 열거 방지) — 어느 사유인지
 *   화면이 단정하지 않고 "다시 확인" 방향으로만 안내한다.
 */
import { ERROR_CODES } from '@/types/errorCodes'
import { isApiError } from '@/lib/api/errors'
import type { SellField } from './sellForm'

export interface CreateAuctionErrorView {
    /** 무슨 일이 있었나 — 한 줄 */
    title: string
    /** 그래서 뭘 하면 되나. 없으면 생략 */
    description?: string
    /** 문제가 걸린 입력. 있으면 화면이 해당 필드로 초점을 되돌린다 */
    field?: SellField
}

/** 경매 등록 실패 → 화면 문구. */
export function createAuctionErrorViewOf(
    error: unknown,
): CreateAuctionErrorView {
    const code = isApiError(error) ? error.code : null

    switch (code) {
        case ERROR_CODES.AUCTION_001:
            return {
                title: '출품할 수 없는 아이템입니다',
                description:
                    '보유 중인 인벤토리 아이템만 등록할 수 있습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.',
                field: 'item',
            }
        case ERROR_CODES.AUCTION_002:
            return {
                title: '이미 출품 중인 아이템입니다',
                description:
                    '다른 경매에 등록되어 있어 다시 출품할 수 없습니다.',
                field: 'item',
            }
        case ERROR_CODES.AUCTION_003:
            return {
                title: '즉시구매 참고가가 시작가보다 낮거나 같습니다',
                description: '시작가보다 높은 금액으로 입력해 주세요.',
                field: 'buyNowPrice',
            }
        case ERROR_CODES.AUCTION_008:
            return {
                title: '경매 시간 설정이 올바르지 않습니다',
                description:
                    '마감 시각·시작 시각·최대 연장 시각의 관계를 다시 확인해 주세요.',
                field: 'endAt',
            }
        case ERROR_CODES.COMMON_005:
        case ERROR_CODES.AUTH_004:
            return {
                title: '로그인이 만료되었습니다',
                description: '다시 로그인한 뒤 등록해 주세요.',
            }
        default:
            return {
                title: '경매를 등록하지 못했습니다',
                description: isApiError(error)
                    ? error.message
                    : '잠시 후 다시 시도해 주세요.',
            }
    }
}
