import { useEffect, useRef } from 'react'
import {
    PiFunnelXDuotone,
    PiPackageDuotone,
    PiPlugsDuotone,
} from 'react-icons/pi'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import LinkButton from '@/components/shared/LinkButton'
import AuctionGridCard from '@/features/auction/components/AuctionGridCard'
import SectionNotice from '@/components/shared/SectionNotice'
import { ROUTES } from '@/configs/routes.config'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 결과 격자 + 더 불러오기 (FC-059).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **카드를 새로 만들지 않았다 — `AuctionGridCard` 그대로다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 홈의 "새로 올라온 매물"과 **같은 컴포넌트, 같은 열 수 규칙**이다. 화면마다 카드를 따로
 * 만든 것이 *"영역별로 디자인이 틀어진다"* 는 지적의 원인이었다. 여기서 카드를 한 벌 더
 * 만들면 아웃라인·레벨 칩·가격 라벨이 두 곳에서 각자 진화한다.
 *
 * ★ 열 수만 다르다: 홈은 레일이 없어 `xl:4`, 여기는 좌측 레일이 폭을 240px 가져가므로
 *   `xl:3`. **카드 내부는 어느 쪽에서도 최소 216px 을 확보**해 2배 아트(100px)가
 *   preflight `max-width:100%` 에 걸려 비정수 축소되는 FC-058 파손이 재발하지 않는다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **"더 보기" 버튼이 폴백이 아니라 정식 경로다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 센티넬(IntersectionObserver)만 두면 **키보드·스크린리더 사용자는 2페이지 이후를 영영 볼
 * 수 없다** — 초점은 목록 끝에 도달해도 스크롤 이벤트를 만들지 않는다. 버튼은 언제나 있고,
 * 센티넬은 그 위에서 마우스 사용자에게 자동으로 눌러줄 뿐이다.
 */

interface AuctionResultsProps {
    auctions: AuctionSummary[]
    isPending: boolean
    isError: boolean
    /** 현재 페이지 이후가 더 있는가(계약 §1.3 `hasNext`) */
    hasNextPage: boolean
    isFetchingNextPage: boolean
    /** 필터가 하나라도 걸려 있는가 — 빈 결과의 원인과 해법이 달라진다 */
    hasFilters: boolean
    onLoadMore: () => void
    onRetry: () => void
    onResetFilters: () => void
}

const PAGE_SKELETON_COUNT = 8

const GRID_CLASS =
    'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'

const AuctionResults = ({
    auctions,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    hasFilters,
    onLoadMore,
    onRetry,
    onResetFilters,
}: AuctionResultsProps) => {
    const sentinelRef = useRef<HTMLDivElement>(null)

    /*
     * ★ 센티넬은 **보조 수단**이다. 세 가지를 지킨다:
     *   ① `IntersectionObserver` 가 없는 환경(구형·테스트 러너)에서 **조용히 아무 일도
     *      하지 않는다** — 버튼이 이미 있으므로 기능이 사라지지 않는다.
     *   ② 이미 불러오는 중이면 다시 부르지 않는다(스크롤 한 번에 두 페이지가 날아간다).
     *   ③ 마지막 페이지에 닿으면 옵저버를 아예 만들지 않는다.
     */
    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage) return
        if (typeof IntersectionObserver === 'undefined') return

        const target = sentinelRef.current
        if (!target) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
            },
            // 화면 아래 200px 여유 — 바닥에 닿기 전에 시작해 끊김이 덜하다.
            { rootMargin: '200px' },
        )
        observer.observe(target)
        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, onLoadMore])

    if (isPending) {
        return (
            <div className={GRID_CLASS} data-testid="auction-list-skeleton">
                {Array.from({ length: PAGE_SKELETON_COUNT }).map((_, index) => (
                    <Card key={index} bodyClass="flex flex-col gap-3">
                        <Skeleton height={186} className="w-full rounded-lg" />
                        <Skeleton height={16} width="80%" />
                        <Skeleton height={14} width="60%" />
                        <Skeleton height={14} width="45%" />
                    </Card>
                ))}
            </div>
        )
    }

    if (isError) {
        return (
            <SectionNotice
                data-testid="auction-list-error"
                description="잠시 후 다시 시도해 주세요. 필터는 그대로 남아 있습니다."
                icon={<PiPlugsDuotone />}
                title="경매 목록을 불러오지 못했습니다"
                onRetry={onRetry}
            />
        )
    }

    if (auctions.length === 0) {
        /*
         * ★★ **빈 결과는 필터를 되돌릴 수단을 준다.** 필터가 걸려 있을 때 "매물이 없습니다"
         *    만 띄우면 사용자는 사이트에 물건이 없다고 판단하고 떠난다 — 실제로는 자기가
         *    좁혀 놓은 것이다. 원인을 말하고 되돌릴 버튼을 붙인다.
         */
        return hasFilters ? (
            <SectionNotice
                action={
                    <Button
                        data-testid="empty-reset-filters"
                        size="sm"
                        type="button"
                        variant="solid"
                        onClick={onResetFilters}
                    >
                        필터 초기화
                    </Button>
                }
                data-testid="auction-list-empty-filtered"
                description="조건을 넓히면 더 많은 매물을 볼 수 있습니다. 마감된 경매는 상태를 직접 골라야 보입니다."
                icon={<PiFunnelXDuotone />}
                title="조건에 맞는 매물이 없습니다"
            />
        ) : (
            <SectionNotice
                action={
                    <LinkButton size="sm" to={ROUTES.sell} variant="solid">
                        판매 등록하기
                    </LinkButton>
                }
                data-testid="auction-list-empty"
                description="첫 매물을 올리면 이 자리에 표시됩니다."
                icon={<PiPackageDuotone />}
                title="진행 중인 경매가 없습니다"
            />
        )
    }

    return (
        <>
            <ul className={GRID_CLASS} data-testid="auction-list-grid">
                {auctions.map((auction) => (
                    <AuctionGridCard
                        key={auction.auctionPublicId}
                        auction={auction}
                    />
                ))}
            </ul>

            {hasNextPage && (
                <div className="flex flex-col items-center gap-2">
                    <div
                        ref={sentinelRef}
                        aria-hidden="true"
                        data-testid="auction-list-sentinel"
                    />
                    <Button
                        data-testid="auction-list-more"
                        loading={isFetchingNextPage}
                        size="sm"
                        type="button"
                        onClick={onLoadMore}
                    >
                        더 보기
                    </Button>
                </div>
            )}
        </>
    )
}

export default AuctionResults
