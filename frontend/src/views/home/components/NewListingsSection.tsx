import {
    PiPackageDuotone,
    PiPlugsDuotone,
    PiSparkleDuotone,
} from 'react-icons/pi'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import LinkButton from '@/components/shared/LinkButton'
import AuctionGridCard from '@/features/auction/components/AuctionGridCard'
import { useAuctionList } from '@/lib/queries/auctions'
import { ROUTES } from '@/configs/routes.config'
import HomeSection from './HomeSection'
import SectionNotice from '@/components/shared/SectionNotice'

/**
 * 새 매물 섹션 (FC-058 → 재작업).
 *
 * ★ **격자다** — 위 섹션이 캐러셀이었으므로 다른 구조를 쓴다.
 *   여기서 하는 일은 "훑기"가 아니라 **"고르기"** 라 아트가 크고 나란히 비교된다.
 *
 * ★★ **모바일 우선 격자**(참고 대시보드 `EcommerceDashboard` 관례):
 *    `grid-cols-1 sm:2 lg:3 xl:4`. 종전 `grid-cols-2` 기본이 파손의 원인이었다 —
 *    320px 에서 열폭이 136px 이라 아트 가용폭이 54px 이고, 100px 짜리 아트가
 *    preflight `max-width:100%` 에 걸려 **1.08배로 축소**됐다(비정수 = 픽셀아트 뭉갬).
 *    1열로 시작하면 320px 에서도 가용폭 210px 라 2배 아트가 여유롭게 들어간다.
 *
 * ★ 쿼리: `GET /auctions?sort=createdAt,desc&size=8` (계약 §3.1, 구현 확인됨).
 *   **`status` 필터를 걸지 않는다** — "최근 올라온 것"이 질문이고, 갓 등록된 예약 경매
 *   (SCHEDULED)도 새 매물이다. 마감 임박 섹션과 필터가 다른 것은 의도다.
 *
 * ★★ **`/shops`(고정가)를 쓰지 않는다** — 계약 §3.2 에 있으나 **백엔드에 `ShopController` 가
 *    없다.** FC-048 이 계약만 보고 넣었다가 홈에 에러 배너가 떴다. **계약에 있어도 구현이 없다.**
 */

const NEW_LISTING_SIZE = 8

const NewListingsSection = () => {
    const { data, isPending, isError, refetch } = useAuctionList({
        sort: 'createdAt,desc',
        size: NEW_LISTING_SIZE,
    })

    const auctions = data?.content ?? []

    return (
        <HomeSection
            title="새로 올라온 매물"
            description="가장 최근에 등록된 순서입니다."
            icon={<PiSparkleDuotone />}
            moreTo={ROUTES.auctions}
            moreLabel="경매 전체"
        >
            {isPending && <NewListingsSkeleton />}

            {isError && (
                <SectionNotice
                    data-testid="new-listings-error"
                    icon={<PiPlugsDuotone />}
                    title="새 매물을 불러오지 못했습니다"
                    description="잠시 후 다시 시도해 주세요. 위 섹션은 그대로 볼 수 있습니다."
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
                    data-testid="new-listings-empty"
                    icon={<PiPackageDuotone />}
                    title="아직 등록된 매물이 없습니다"
                    description="첫 매물을 올리면 이 자리에 표시됩니다."
                    action={
                        <LinkButton variant="solid" size="sm" to={ROUTES.sell}>
                            판매 등록하기
                        </LinkButton>
                    }
                />
            )}

            {!isPending && !isError && auctions.length > 0 && (
                <ul
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    data-testid="new-listings-grid"
                >
                    {auctions.map((auction) => (
                        <AuctionGridCard
                            key={auction.auctionPublicId}
                            auction={auction}
                        />
                    ))}
                </ul>
            )}
        </HomeSection>
    )
}

/** 격자와 같은 열 수·같은 카드 높이 — 로딩 종료 시 아래 내용이 밀려 올라가지 않는다. */
const NewListingsSkeleton = () => (
    <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="new-listings-skeleton"
    >
        {Array.from({ length: NEW_LISTING_SIZE }).map((_, index) => (
            <Card key={index} bodyClass="flex flex-col gap-3">
                <Skeleton height={186} className="w-full rounded-lg" />
                <Skeleton height={16} width="80%" />
                <Skeleton height={14} width="60%" />
                <Skeleton height={14} width="45%" />
            </Card>
        ))}
    </div>
)

export default NewListingsSection
