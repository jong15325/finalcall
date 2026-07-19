/**
 * 입찰 실패 문구 (계약 §3.1 · §5) — FC-064.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`code` 로 분기한다. HTTP status 로 분기하지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `BID_004`(내가 이미 최고가)와 `BID_006`(마감)은 **둘 다 409** 인데 사용자가 할 일이 정반대다 —
 * 전자는 남이 올릴 때까지 기다리면 되고 후자는 끝이다. `BID_006`(마감)과 `BID_007`(미개시)도
 * 같은 관계다. status 로 뭉치면 그 구분이 사라진다(`types/errorCodes.ts` 가 명시한 이유).
 *
 * ★ **서버 message 를 그대로 쓰지 않는다.** 계약 §1.4 의 `message` 는 사람용이지만
 *   *우리 화면의* 문구는 아니다. 모르는 코드에서만 폴백으로 쓴다.
 */

import { ERROR_CODES } from '@/types/errorCodes'
import { formatGameMoney } from './auctionPrice'
import { isApiError } from '@/lib/api/errors'

export interface BidErrorView {
    /** 무슨 일이 있었나 — 한 줄 */
    title: string
    /** 그래서 뭘 하면 되나. 할 일이 없으면 생략 */
    description?: string
    /**
     * 입력 금액 자체가 문제인가.
     * 참이면 금액 입력에 `aria-invalid` 를 물려 초점을 되돌린다 — 사용자가 고칠 값이 거기 있다.
     */
    amountFault: boolean
}

/**
 * 입찰 실패 → 화면 문구.
 *
 * @param minNextBidAmount 상세가 준 최소 입찰가. `BID_001` 에서 **금액을 다시 안내**한다 —
 *   "더 높게 쓰세요" 만으로는 얼마인지 모른다. 서버 파생값이라 안내대로 쓰면 반드시 통과한다.
 */
export function bidErrorViewOf(
    error: unknown,
    minNextBidAmount: number | null,
): BidErrorView {
    const code = isApiError(error) ? error.code : null

    switch (code) {
        case ERROR_CODES.BID_001:
            return {
                title: '입찰가가 최소 입찰가보다 낮습니다',
                description:
                    minNextBidAmount !== null
                        ? `${formatGameMoney(minNextBidAmount)} 이상으로 입찰해 주세요.`
                        : '최소 입찰가 이상으로 입찰해 주세요.',
                amountFault: true,
            }
        case ERROR_CODES.BID_002:
            return {
                title: '즉시구매가 이상은 입찰할 수 없습니다',
                description: '즉시구매가보다 낮은 금액으로 입찰해 주세요.',
                amountFault: true,
            }
        case ERROR_CODES.BID_003:
            /*
             * ★ 닉네임 비교로 이미 숨겼는데도 여기 도달할 수 있다 — 다른 탭에서 로그인이
             *   바뀐 경우 등. 표시 제어는 인가가 아니므로 이 분기를 지우면 안 된다.
             */
            return {
                title: '내가 등록한 경매에는 입찰할 수 없습니다',
                amountFault: false,
            }
        case ERROR_CODES.BID_004:
            return {
                title: '이미 최고 입찰자입니다',
                description:
                    '다른 사람이 더 높게 입찰한 뒤에 다시 입찰할 수 있습니다.',
                amountFault: false,
            }
        case ERROR_CODES.BID_005:
            return {
                title: '게임머니 잔액이 부족합니다',
                description:
                    '입찰 중인 금액은 묶여 있습니다. 가용 잔액을 확인해 주세요.',
                amountFault: true,
            }
        case ERROR_CODES.BID_006:
            return {
                title: '이미 마감된 경매입니다',
                description: '입찰을 받지 않습니다.',
                amountFault: false,
            }
        case ERROR_CODES.BID_007:
            /* ★ 마감과 **반대로** 안내한다 — 이쪽은 기다리면 열린다. */
            return {
                title: '아직 시작하지 않은 경매입니다',
                description: '시작 시각이 되면 입찰할 수 있습니다.',
                amountFault: false,
            }
        case ERROR_CODES.AUCTION_004:
            return {
                title: '경매를 찾을 수 없습니다',
                description: '이미 삭제되었거나 주소가 잘못되었습니다.',
                amountFault: false,
            }
        case ERROR_CODES.COMMON_005:
        case ERROR_CODES.AUTH_004:
            return {
                title: '로그인이 만료되었습니다',
                description: '다시 로그인한 뒤 입찰해 주세요.',
                amountFault: false,
            }
        default:
            return {
                title: '입찰하지 못했습니다',
                description: isApiError(error)
                    ? error.message
                    : '잠시 후 다시 시도해 주세요.',
                amountFault: false,
            }
    }
}
