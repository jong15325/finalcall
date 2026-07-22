import { ERROR_CODES } from '@/types/errorCodes'
import { isApiError } from '@/lib/api/errors'

/**
 * 고정가 마켓 실패 문구 (계약 §3.2 · §5 SHOP_001~006) — FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`code` 로 분기한다. HTTP status 로 분기하지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `SHOP_004`(이미 판매/종료)와 `SHOP_005`(잔액 부족)는 사용자가 할 일이 다르다 — 전자는 다른
 * 매물을 찾고 후자는 잔액을 채운다. `SHOP_006`(자기구매·403)도 뭉치면 안 된다. 서버 message 를
 * 그대로 쓰지 않고(계약 §1.4) 모르는 코드에서만 폴백으로 노출한다(즉시구매 `purchaseErrors` 태도).
 *
 * ★ `SHOP_004` 라벨은 SOLD·**EXPIRED**·CANCELLED 를 아우른다(shop-spec §4.4 라벨 확대) — "판매됨"
 *   으로 못 박지 않고 "지금은 살 수 없다"로 중립화한다(기한 만료분 포함).
 */

export interface ShopErrorView {
    /** 무슨 일이 있었나 — 한 줄 */
    title: string
    /** 그래서 뭘 하면 되나. 할 일이 없으면 생략 */
    description?: string
}

/** 구매 실패 → 화면 문구(계약 §3.2 purchase 에러). */
export function shopPurchaseErrorViewOf(error: unknown): ShopErrorView {
    const code = isApiError(error) ? error.code : null

    switch (code) {
        case ERROR_CODES.SHOP_004:
            /* ★ SOLD·EXPIRED·CANCELLED 공통 — "판매됨"으로 못 박지 않는다(라벨 확대). */
            return {
                title: '지금은 구매할 수 없는 상품입니다',
                description:
                    '이미 판매되었거나 기한이 지나 내려간 상품입니다. 목록을 새로고침해 주세요.',
            }
        case ERROR_CODES.SHOP_005:
            return {
                title: '게임머니 잔액이 부족합니다',
                description:
                    '가용 잔액을 확인하거나 캐시를 교환한 뒤 다시 시도해 주세요.',
            }
        case ERROR_CODES.SHOP_006:
            /*
             * ★ 닉네임 비교로 이미 버튼을 숨겼어도 여기 도달할 수 있다 — 다른 탭에서 로그인이
             *   바뀐 경우 등. 표시 제어는 인가가 아니므로 이 분기를 지우면 안 된다.
             */
            return {
                title: '내가 등록한 상품은 구매할 수 없습니다',
            }
        case ERROR_CODES.SHOP_003:
            return {
                title: '상품을 찾을 수 없습니다',
                description: '이미 내려갔거나 주소가 잘못되었습니다.',
            }
        case ERROR_CODES.COMMON_005:
        case ERROR_CODES.AUTH_004:
            return {
                title: '로그인이 만료되었습니다',
                description: '다시 로그인한 뒤 시도해 주세요.',
            }
        default:
            return {
                title: '구매하지 못했습니다',
                description: isApiError(error)
                    ? error.message
                    : '잠시 후 다시 시도해 주세요.',
            }
    }
}

/**
 * 등록 실패 → 화면 문구(계약 §3.2 create 에러).
 *
 * ★ `SHOP_001` 은 **403 단일**(미소유·미보유·미존재 통일, SEC-007 열거 방지) — 어느 사유인지
 *   화면이 단정하지 않고 "다시 확인" 방향으로만 안내한다(경매 `AUCTION_001` 대칭).
 */
export function createShopErrorViewOf(error: unknown): ShopErrorView {
    const code = isApiError(error) ? error.code : null

    switch (code) {
        case ERROR_CODES.SHOP_001:
            return {
                title: '출품할 수 없는 아이템입니다',
                description:
                    '보유 중인 인벤토리 아이템만 등록할 수 있습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.',
            }
        case ERROR_CODES.SHOP_002:
            return {
                title: '이미 출품 중인 아이템입니다',
                description:
                    '다른 판매(경매·고정가)에 등록되어 있어 다시 출품할 수 없습니다.',
            }
        case ERROR_CODES.COMMON_005:
        case ERROR_CODES.AUTH_004:
            return {
                title: '로그인이 만료되었습니다',
                description: '다시 로그인한 뒤 등록해 주세요.',
            }
        default:
            return {
                title: '상품을 등록하지 못했습니다',
                description: isApiError(error)
                    ? error.message
                    : '잠시 후 다시 시도해 주세요.',
            }
    }
}
