import { ERROR_CODES } from '@/types/errorCodes'
import { isApiError } from '@/lib/api/errors'

/**
 * 즉시구매 실패 문구 (계약 §3.1 · §5) — FC-090.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`code` 로 분기한다. HTTP status 로 분기하지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `AUCTION_005`(미설정)와 `BID_005`(잔액 부족)는 둘 다 422 지만 사용자가 할 일이 다르다 —
 * 전자는 입찰로 돌아가고 후자는 잔액을 채운다. `AUCTION_006`(구매 불가·미개시/종료)와
 * `AUCTION_009`(자기구매·403)도 뭉치면 안 된다. 서버 message 를 그대로 쓰지 않고(계약 §1.4 의
 * message 는 사람용이나 우리 화면 문구는 아니다) 모르는 코드에서만 폴백으로 노출한다.
 *
 * ★ `AUCTION_006` 은 라벨이 확대됐다(v1.13) — "이미 종료"뿐 아니라 **미개시(아직 시작 전)**도
 *   포함한다. 그래서 문구를 "종료" 로 못 박지 않고 "구매할 수 없는 경매" 로 중립화한다.
 */

export interface PurchaseErrorView {
    /** 무슨 일이 있었나 — 한 줄 */
    title: string
    /** 그래서 뭘 하면 되나. 할 일이 없으면 생략 */
    description?: string
}

export function purchaseErrorViewOf(error: unknown): PurchaseErrorView {
    const code = isApiError(error) ? error.code : null

    switch (code) {
        case ERROR_CODES.AUCTION_005:
            return {
                title: '즉시구매를 설정하지 않은 경매입니다',
                description: '이 경매는 입찰로만 거래할 수 있습니다.',
            }
        case ERROR_CODES.AUCTION_006:
            /* ★ 종료뿐 아니라 미개시도 포함(라벨 확대, v1.13) — "종료"로 못 박지 않는다. */
            return {
                title: '지금은 즉시구매할 수 없는 경매입니다',
                description:
                    '이미 판매되었거나 아직 시작하지 않았습니다. 목록을 새로고침해 주세요.',
            }
        case ERROR_CODES.AUCTION_009:
            /*
             * ★ 닉네임 비교로 이미 버튼을 숨겼어도 여기 도달할 수 있다 — 다른 탭에서 로그인이
             *   바뀐 경우 등. 표시 제어는 인가가 아니므로 이 분기를 지우면 안 된다.
             */
            return {
                title: '내가 등록한 경매는 구매할 수 없습니다',
            }
        case ERROR_CODES.BID_005:
            return {
                title: '게임머니 잔액이 부족합니다',
                description:
                    '가용 잔액을 확인하거나 캐시를 교환한 뒤 다시 시도해 주세요.',
            }
        case ERROR_CODES.AUCTION_004:
            return {
                title: '경매를 찾을 수 없습니다',
                description: '이미 삭제되었거나 주소가 잘못되었습니다.',
            }
        case ERROR_CODES.COMMON_005:
        case ERROR_CODES.AUTH_004:
            return {
                title: '로그인이 만료되었습니다',
                description: '다시 로그인한 뒤 시도해 주세요.',
            }
        default:
            return {
                title: '즉시구매하지 못했습니다',
                description: isApiError(error)
                    ? error.message
                    : '잠시 후 다시 시도해 주세요.',
            }
    }
}
