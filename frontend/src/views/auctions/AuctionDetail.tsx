import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
    PiArrowLeftBold,
    PiMagnifyingGlassDuotone,
    PiPlugsDuotone,
} from 'react-icons/pi'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import LinkButton from '@/components/shared/LinkButton'
import SectionNotice from '@/components/shared/SectionNotice'
import Sheet from '@/components/shared/Sheet'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
} from '@/features/auction/lib/auctionPhase'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import { useNow } from '@/features/auction/lib/useNow'
import { useAuctionDetail } from '@/lib/queries/auctions'
import { hasErrorCode } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import { ROUTES } from '@/configs/routes.config'
import AuctionArtPanel from './components/AuctionArtPanel'
import AuctionBidBox from './components/AuctionBidBox'
import AuctionBidHistory from './components/AuctionBidHistory'
import AuctionSpecList from './components/AuctionSpecList'
import AuctionStickyBar from './components/AuctionStickyBar'

/**
 * 경매 상세 + 입찰 (FC-064) — 계약 §3.1 · §3.3 · §5.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **데스크톱은 안2(가로 2열 + 전폭 두 줄)이고 모바일은 다른 구조다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 데스크톱: `[아트 | 스펙]` → `[입찰 전폭]` → `[이력 전폭]`.
 *   근거는 **Steam 커뮤니티 마켓**이다 — "작은 아트 + 조밀한 스펙 + 거래 데이터" 라는
 *   우리와 동일한 조건에서 정확히 이 구조를 택했다. 좌우 분할(안1)은 50×93 아트로 우측
 *   높이를 채울 방법이 없어 기각됐다(과확대 아니면 억지 여백, 맞추면 sticky 여유가 0).
 *
 * 모바일: 본문은 세로로 흐르고 **가격·잔여시간·입찰 CTA 는 하단에 고정**된다
 *   (`AuctionStickyBar`). 입찰 폼은 바텀시트로 뜬다.
 *   ★ "좁아지면 1열로 접는다" 가 아니다 — 그렇게 하면 아트를 보는 동안 가격이 화면 밖으로
 *   나가 **"얼마·언제" 와 "무엇" 을 동시에 못 본다**(이 화면의 판단 조건 자체가 깨진다).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **모바일 우선으로 짰다** — FC-058 이 데스크톱 기준으로 짜서 320~1024 가 전부 깨졌다.
 * ══════════════════════════════════════════════════════════════════════════════
 *   · 루트 `max-w-full overflow-x-hidden` 가드
 *   · 격자는 **`grid-cols-1` 에서 시작**, `lg` 에서 처음 2열
 *   · 고정 폭은 큰 브레이크포인트에만(`lg:` 아트 열 · `xl:max-w-[1280px]`)
 *   · **`min-w-0`** — flex/grid 자식의 기본 `min-width:auto` 가 내용에 밀려 부모를 넓힌다.
 *     `overflow-x-hidden` 은 그 결과를 잘라 감출 뿐이고 원인을 없애는 건 이 한 줄이다.
 *   · `pb-28` — 바닥에 **두 겹**이 겹쳐 있다: 셸의 모바일 탭바(`h-16`)와 이 화면의
 *     입찰 바(약 84px). 셸이 이미 `pb-16` 을 주므로 여기서 112px 을 더해 176px 을 확보한다
 *     (필요분 약 148px). `lg` 에서는 둘 다 없으므로 `lg:pb-8` 로 되돌린다.
 *
 * ★★ **마감은 `endAt` 으로 판정한다**(`auctionPhaseOf`). 서버 `status` 는 마감 강등이 없어
 *    끝난 경매도 `ACTIVE` 로 내려온다 — 그대로 믿으면 종료 경매에 입찰 바가 뜬다.
 *
 * ★ **즉시구매 버튼이 없다.** 계약 §3.1 에 명세돼 있으나 백엔드에 매핑이 없다(404).
 */

const AuctionDetail = () => {
    const { auctionPublicId = '' } = useParams()
    const now = useNow()

    const [bidSheetOpen, setBidSheetOpen] = useState(false)
    const bidTriggerRef = useRef<HTMLButtonElement>(null)

    const {
        data: auction,
        isPending,
        isError,
        error,
        refetch,
    } = useAuctionDetail(auctionPublicId)

    const rootClass =
        'mx-auto flex w-full max-w-full flex-col gap-4 overflow-x-hidden px-4 pb-28 pt-6 sm:px-6 lg:gap-6 lg:pb-8 lg:pt-8 xl:max-w-[1280px]'

    if (isPending) {
        /*
         * ★ 데이터와 무관한 부분(뒤로 가기)은 즉시 렌더한다 — 화면 전체를 회색으로 덮으면
         *   느린 회선에서 사용자가 갈 곳을 잃는다(FC-058 이 정한 로딩 태도).
         */
        return (
            <div className={rootClass} data-testid="auction-detail-skeleton">
                <BackLink />
                <Skeleton height={28} width="60%" />
                <Card bodyClass="flex flex-col gap-6 lg:flex-row">
                    <Skeleton height={260} className="w-full lg:w-72" />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <Skeleton height={16} width="90%" />
                        <Skeleton height={16} width="70%" />
                        <Skeleton height={16} width="80%" />
                        <Skeleton height={16} width="50%" />
                    </div>
                </Card>
            </div>
        )
    }

    if (isError) {
        /*
         * ★ **404 와 그 밖의 실패를 가른다.** `AUCTION_004` 는 다시 시도해도 영원히 없는
         *   경매다 — "다시 시도" 버튼을 주면 사용자를 무의미한 반복에 묶는다.
         */
        const notFound = hasErrorCode(error, ERROR_CODES.AUCTION_004)
        return (
            <div className={rootClass}>
                <BackLink />
                {notFound ? (
                    <SectionNotice
                        action={
                            <LinkButton
                                size="sm"
                                to={ROUTES.auctions}
                                variant="solid"
                            >
                                경매 목록으로
                            </LinkButton>
                        }
                        data-testid="auction-detail-not-found"
                        description="이미 삭제되었거나 주소가 잘못되었습니다."
                        icon={<PiMagnifyingGlassDuotone />}
                        title="경매를 찾을 수 없습니다"
                    />
                ) : (
                    <SectionNotice
                        data-testid="auction-detail-error"
                        description="잠시 후 다시 시도해 주세요."
                        icon={<PiPlugsDuotone />}
                        title="경매 정보를 불러오지 못했습니다"
                        onRetry={() => void refetch()}
                    />
                )}
            </div>
        )
    }

    const phase = auctionPhaseOf(auction, now)
    const { item } = auction

    return (
        <>
            <div className={rootClass}>
                <BackLink />

                <header className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-xl font-bold break-words text-gray-900 sm:text-2xl lg:text-3xl dark:text-gray-100">
                        {item.nameSnapshot}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
                        {auctionPhaseLabelOf(phase)}
                    </p>
                </header>

                {/*
                 * 행1 — 아트 | 스펙. `lg` 에서 처음 2열이 되고, 아트 열은 그때만 고정 폭이다.
                 * `minmax(0,…)` 이 두 열 모두에 필요하다 — 격자 열의 기본 최소 크기가
                 * `auto` 라 긴 스펙 문장이 열을 밀어 넓힌다(min-w-0 과 같은 문제의 격자판).
                 */}
                <Card bodyClass="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
                    <AuctionArtPanel auction={auction} />
                    <AuctionSpecList auction={auction} />
                </Card>

                {/*
                 * 행2 — 입찰 전폭.
                 * ★ **진행 중일 때 모바일에서는 숨긴다** — 같은 정보를 고정 하단 바와 시트가
                 *   이미 상시 노출하므로 본문에 또 두면 같은 말이 두 번 있게 된다.
                 *   반대로 **마감·시작 전에는 모바일에서도 보여준다** — 그때 하단 바에는
                 *   상태 글자만 남아 "왜 입찰할 수 없는가" 를 말할 자리가 본문밖에 없다.
                 */}
                <Card
                    bodyClass="flex flex-col gap-4"
                    className={phase === 'live' ? 'hidden lg:block' : undefined}
                    header={{ content: '입찰' }}
                >
                    <AuctionBidBox
                        auction={auction}
                        idPrefix="panel"
                        phase={phase}
                    />
                </Card>

                {/* 행3 — 입찰 이력 전폭. */}
                <Card header={{ content: '입찰 이력' }}>
                    <AuctionBidHistory auctionPublicId={auctionPublicId} />
                </Card>
            </div>

            <AuctionStickyBar
                auction={auction}
                phase={phase}
                triggerRef={bidTriggerRef}
                onBid={() => setBidSheetOpen(true)}
            />

            {/*
             * ★ 시트는 **열릴 때만 마운트**된다(`Sheet` 가 닫히면 null 을 낸다). 덕분에 안의
             *   `AuctionBidBox` 가 매번 새 입력 상태로 시작해 이전 시도의 에러가 남지 않는다.
             */}
            <Sheet
                closeLabel="입찰 닫기"
                data-testid="bid-sheet"
                hiddenAbove="lg"
                open={bidSheetOpen}
                title="입찰하기"
                triggerRef={bidTriggerRef}
                onClose={() => setBidSheetOpen(false)}
            >
                <AuctionBidBox
                    auction={auction}
                    idPrefix="sheet"
                    phase={phase}
                />
            </Sheet>
        </>
    )
}

const BackLink = () => (
    <LinkButton
        className="self-start"
        icon={<PiArrowLeftBold />}
        size="sm"
        to={ROUTES.auctions}
    >
        경매 목록
    </LinkButton>
)

export default AuctionDetail
