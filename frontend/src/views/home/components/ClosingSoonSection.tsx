import {
    PiHourglassHighDuotone,
    PiPackageDuotone,
    PiPlugsDuotone,
} from 'react-icons/pi'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import LinkButton from '@/components/shared/LinkButton'
import AuctionFeatureCard from '@/features/auction/components/AuctionFeatureCard'
import SnapCarousel from '@/features/auction/components/SnapCarousel'
import { useAuctionList } from '@/lib/queries/auctions'
import { ROUTES } from '@/configs/routes.config'
import HomeSection from './HomeSection'
import SectionNotice from './SectionNotice'

/**
 * 마감 임박 섹션 — 홈 최상단 (FC-058 → 재작업 2차).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **하나의 영역이다** (사용자 지시: *"다음 마감과 합쳐서 슬라이드... 하나의 영역인 거지"*).
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 구조(피처드 큰 카드 1 + 행목록 4)는 **한 섹션에 두 덩어리**였다. 지금은
 * **모든 마감 임박 매물이 같은 카드로 같은 캐러셀 안에서** 흐른다. "다음 마감"이라는 별도
 * 목록이 없다 — 다음 마감은 **오른쪽으로 넘기면 나온다.**
 *
 * 급한 순서는 **슬라이드 순서**가 표현한다(왼쪽이 가장 급함). 크기 차이로 순서를 말하던
 * 종전 판단은 이 지시로 대체됐다.
 *
 * ★ **몇 장 보이나 — 반응형은 CSS 가 정한다**(`SnapCarousel` 슬라이드 폭):
 *   | 화면 | 한 번에 | 조작 |
 *   |---|---|---|
 *   | ~1023 | **1장 + 24px peek** | 스와이프(모바일) · sm 이상은 화살표도 |
 *   | ≥1024 | **2장** | 화살표 · 드래그 |
 *   | ≥1280 | **3장** | 〃 |
 *   넘기는 단위는 **보이는 장수만큼**이라 "보이는 것이 통째로 교체"된다.
 *
 * ★★ **`sm`(640)에서 2분할하지 않는다.** 처음엔 640부터 2장을 보였는데, 그러면 카드 내부
 *    폭이 **320px 화면일 때와 같아져**(둘 다 248px) 정보열이 다시 무너졌다.
 *    분할은 **1024부터**가 실측상 안전선이다.
 *
 * ★ 쿼리: `GET /auctions?status=ACTIVE&sort=endAt,asc&size=8` (계약 §3.1, 구현 확인됨).
 *   `status=ACTIVE` 를 빼면 이미 끝난 경매가 맨 앞에 온다 — 마감 임박의 정의가 무너진다.
 *   8건 = 데스크톱에서 3페이지(3·3·2)라 넘길 맛이 있으면서 첫 화면 요청이 가볍다.
 */

const CLOSING_SOON_SIZE = 8

const ClosingSoonSection = () => {
    const { data, isPending, isError, refetch } = useAuctionList({
        status: 'ACTIVE',
        sort: 'endAt,asc',
        size: CLOSING_SOON_SIZE,
    })

    const auctions = data?.content ?? []

    return (
        <HomeSection
            title="마감 임박"
            description="가장 먼저 끝나는 경매부터 순서대로 넘겨 보세요."
            icon={<PiHourglassHighDuotone />}
            moreTo={ROUTES.auctions}
            moreLabel="경매 전체"
        >
            {isPending && <ClosingSoonSkeleton />}

            {isError && (
                <SectionNotice
                    data-testid="closing-soon-error"
                    icon={<PiPlugsDuotone />}
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
                    icon={<PiPackageDuotone />}
                    title="지금 진행 중인 경매가 없습니다"
                    description="가지고 있는 아이템을 올리면 이 자리에 표시됩니다."
                    action={
                        <LinkButton variant="solid" size="sm" to={ROUTES.sell}>
                            판매 등록하기
                        </LinkButton>
                    }
                />
            )}

            {!isPending && !isError && auctions.length > 0 && (
                <SnapCarousel label="마감 임박 매물">
                    {auctions.map((auction) => (
                        <AuctionFeatureCard
                            key={auction.auctionPublicId}
                            auction={auction}
                        />
                    ))}
                </SnapCarousel>
            )}
        </HomeSection>
    )
}

/**
 * 캐러셀과 **같은 골격**의 스켈레톤 — 로딩이 끝날 때 레이아웃이 튀지 않는다.
 * 데스크톱 한 화면분(3장)만 그린다. 넘겨야 보이는 것을 미리 그릴 이유가 없다.
 */
const ClosingSoonSkeleton = () => (
    <div
        className="flex gap-4 overflow-hidden"
        data-testid="closing-soon-skeleton"
    >
        {Array.from({ length: 3 }).map((_, index) => (
            <Card
                key={index}
                className={classNamesForSkeletonSlide(index)}
                bodyClass="flex items-center gap-3 sm:gap-4"
            >
                {/* 아트 자리 — 좁은 화면은 1배(50×93), 그 위는 2배(100×186)로 실제와 같다. */}
                <Skeleton className="h-[93px] w-[50px] shrink-0 rounded-lg sm:h-[186px] sm:w-[100px]" />
                <div className="flex flex-1 flex-col gap-3">
                    <Skeleton height={18} width="45%" />
                    <Skeleton height={30} width="70%" />
                    <Skeleton height={16} width="85%" />
                    <Skeleton height={20} width="60%" />
                </div>
            </Card>
        ))}
    </div>
)

/**
 * 슬라이드와 **같은 반응형 폭**(peek 포함) — 로딩이 끝날 때 카드 폭이 튀지 않는다.
 * 2·3번째는 해당 브레이크포인트 전까지 감춘다. 안 감추면 좁은 화면에서 트랙 밖으로 밀려
 * 스켈레톤 단계에만 가로 넘침이 생긴다.
 */
function classNamesForSkeletonSlide(index: number): string {
    const base =
        'w-[calc(100%-1.5rem)] shrink-0 lg:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]'
    if (index === 1) return `${base} hidden lg:block`
    if (index === 2) return `${base} hidden xl:block`
    return base
}

export default ClosingSoonSection
