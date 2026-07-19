import { PiGavelDuotone } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import CountdownText from '@/features/auction/components/CountdownText'
import {
    auctionPriceOf,
    formatGameMoney,
} from '@/features/auction/lib/auctionPrice'
import { auctionPhaseLabelOf } from '@/features/auction/lib/auctionPhase'
import type { AuctionPhase } from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 모바일 고정 하단 바 (FC-064).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **이 바가 "반응형은 배치 변경이 아니다" 에 대한 답이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 데스크톱 안2 는 [아트|스펙] 위에 [입찰 전폭] 을 얹는다. 그것을 좁은 폭에서 그냥 세로로
 * 쌓으면 **아트와 스펙을 보는 동안 가격·마감이 화면 밖으로 밀려난다.** 경매는
 * *"지금 얼마·언제 끝나는가"* 와 *"무엇을 사는가"* 를 **동시에** 봐야 판단이 되는 화면이라
 * 그 순간 화면이 제 일을 못 하게 된다.
 *
 * 그래서 모바일은 **다른 구조**다 — 본문은 아트·스펙·이력을 세로로 흐르게 두고,
 * **가격·잔여시간·입찰 CTA 는 하단에 상시 고정**한다. 스크롤 위치와 무관하게 둘이 함께 보인다.
 * 입찰 폼 자체는 시트로 띄운다(NN/g: 이커머스 **상세를 바텀시트로 만들지 마라** →
 * **"상세는 페이지 / 입찰은 시트"**).
 *
 * ★ 마감·시작 전이면 **버튼을 내주지 않는다** — 상태를 글자로만 적는다. `phase` 판정이
 *   서버 `status` 가 아니라 시각 기반이라는 점이 여기서 눈에 보이는 결과가 된다.
 *
 * ★ `lg:hidden` — 넓은 폭에서는 **DOM 에 있되 보이지 않는다.** 전폭 입찰 카드가 이미 같은
 *   정보를 상시 노출하므로 바가 겹치면 같은 말이 두 번 있게 된다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **바닥에 이미 주인이 있다 — 셸의 `MobileTabBar`(`fixed bottom-0 z-30 h-16`).**
 * ══════════════════════════════════════════════════════════════════════════════
 * `bottom-0` 으로 두면 이 바가 **내비게이션을 통째로 덮는다**(z-40 이 z-30 위다).
 * 경매 하나 보러 들어온 사람이 홈·목록으로 돌아갈 길을 잃는 셈이다.
 * 그래서 탭바 높이(`4rem`)**와 그 아래 안전영역까지** 합한 만큼 띄운다 —
 * 안전영역 패딩은 **탭바가 이미 갖고 있으므로** 여기서 또 주면 이중으로 뜬다.
 * 계산을 CSS 에 맡겨(`calc`) 탭바 높이가 바뀌어도 한 곳만 고치면 되게 한다.
 */

interface AuctionStickyBarProps {
    auction: AuctionDetail
    phase: AuctionPhase
    /** 입찰 시트를 여는 버튼. 초점 복귀 대상이라 ref 를 밖에서 잡는다 */
    triggerRef: React.RefObject<HTMLButtonElement | null>
    onBid: () => void
}

const AuctionStickyBar = ({
    auction,
    phase,
    triggerRef,
    onBid,
}: AuctionStickyBarProps) => {
    const price = auctionPriceOf(auction)

    return (
        <div
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-gray-200 bg-white shadow-[0_-0.5rem_1rem_-0.75rem_rgba(0,0,0,0.25)] lg:hidden dark:border-gray-700 dark:bg-gray-800"
            data-testid="auction-sticky-bar"
        >
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {price.label}
                    </span>
                    <span
                        className="truncate text-base font-bold tabular-nums text-gray-900 dark:text-gray-100"
                        data-testid="sticky-price"
                    >
                        {formatGameMoney(price.amount)} GM
                    </span>
                    {/* 남은 시간은 가격 바로 아래 — 둘이 한 덩어리로 읽혀야 판단이 된다. */}
                    <CountdownText endAt={auction.endAt} />
                </div>

                {phase === 'live' ? (
                    <Button
                        ref={triggerRef}
                        className="shrink-0"
                        data-testid="sticky-bid-trigger"
                        icon={<PiGavelDuotone />}
                        type="button"
                        variant="solid"
                        onClick={onBid}
                    >
                        입찰하기
                    </Button>
                ) : (
                    <span
                        className="shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        data-testid="sticky-phase-label"
                    >
                        {auctionPhaseLabelOf(phase)}
                    </span>
                )}
            </div>
        </div>
    )
}

export default AuctionStickyBar
