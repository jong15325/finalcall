import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import LinkButton from '@/components/shared/LinkButton'
import AuctionFeatureCard from '@/features/auction/components/AuctionFeatureCard'
import AuctionRowItem from '@/features/auction/components/AuctionRowItem'
import { useAuctionList } from '@/lib/queries/auctions'
import { ROUTES } from '@/configs/routes.config'
import HomeSection from './HomeSection'
import SectionNotice from './SectionNotice'

/**
 * 마감 임박 섹션 — 홈 최상단 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **스크롤 0px 에 실제 카운트다운.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 홈은 마케팅 랜딩이 아니라 **거래소 첫 화면**이다. "실시간 경매"라고 카피로 주장하는 대신
 * 지금 가장 먼저 끝나는 경매의 남은 시간을 **데이터로** 보여준다.
 *
 * ★ **한 섹션 안에서 구조가 둘이다** — 1건은 피처드(가로 큰 카드), 나머지는 행목록.
 *   같은 카드 5개를 늘어놓으면 "가장 급한 것"이 사라진다. 마감 순서는 **크기 차이**로 읽힌다.
 *
 * ★ 쿼리: `GET /auctions?status=ACTIVE&sort=endAt,asc&size=5` (계약 §3.1, 구현 확인됨).
 *   `status=ACTIVE` 를 빼면 이미 끝난 경매가 맨 앞에 온다 — 마감 임박의 정의가 무너진다.
 */

const CLOSING_SOON_SIZE = 5

const ClosingSoonSection = () => {
    const { data, isPending, isError, refetch } = useAuctionList({
        status: 'ACTIVE',
        sort: 'endAt,asc',
        size: CLOSING_SOON_SIZE,
    })

    const auctions = data?.content ?? []
    const [featured, ...rest] = auctions

    return (
        <HomeSection
            title="마감 임박"
            description="가장 먼저 끝나는 경매부터 보여줍니다."
            moreTo={ROUTES.auctions}
            moreLabel="경매 전체"
        >
            {isPending && <ClosingSoonSkeleton />}

            {isError && (
                <SectionNotice
                    data-testid="closing-soon-error"
                    title="마감 임박 목록을 불러오지 못했습니다"
                    description="잠시 후 다시 시도해 주세요. 다른 섹션은 그대로 볼 수 있습니다."
                    action={
                        <LinkButton size="sm" to={ROUTES.auctions}>
                            경매 전체 보기
                        </LinkButton>
                    }
                    onRetry={() => void refetch()}
                />
            )}

            {!isPending && !isError && auctions.length === 0 && (
                <SectionNotice
                    data-testid="closing-soon-empty"
                    title="지금 진행 중인 경매가 없습니다"
                    description="가지고 있는 아이템을 올리면 이 자리에 표시됩니다."
                    action={
                        <LinkButton variant="solid" size="sm" to={ROUTES.sell}>
                            판매 등록하기
                        </LinkButton>
                    }
                />
            )}

            {!isPending && !isError && featured && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                        <AuctionFeatureCard auction={featured} />
                    </div>

                    {rest.length > 0 && (
                        <Card
                            className="lg:col-span-2"
                            bodyClass="flex flex-col gap-1"
                        >
                            <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                다음 마감
                            </h3>
                            <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-600">
                                {rest.map((auction) => (
                                    <AuctionRowItem
                                        key={auction.auctionPublicId}
                                        auction={auction}
                                    />
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            )}
        </HomeSection>
    )
}

/** 최종 배치와 **같은 골격**의 스켈레톤 — 로딩이 끝날 때 레이아웃이 튀지 않는다. */
const ClosingSoonSkeleton = () => (
    <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-5"
        data-testid="closing-soon-skeleton"
    >
        <Card className="lg:col-span-3" bodyClass="flex gap-5">
            <Skeleton
                height={279}
                width={150}
                className="shrink-0 rounded-lg"
            />
            <div className="flex flex-1 flex-col gap-3">
                <Skeleton height={24} width="70%" />
                <Skeleton height={20} width="50%" />
                <Skeleton height={36} width="40%" />
                <Skeleton height={20} width="60%" />
            </div>
        </Card>
        <Card className="lg:col-span-2" bodyClass="flex flex-col gap-4">
            {Array.from({ length: CLOSING_SOON_SIZE - 1 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                    <Skeleton
                        height={93}
                        width={50}
                        className="shrink-0 rounded-lg"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton height={16} width="80%" />
                        <Skeleton height={14} width="55%" />
                    </div>
                </div>
            ))}
        </Card>
    </div>
)

export default ClosingSoonSection
