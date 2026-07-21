import { useMemo } from 'react'
import {
    TbAlertTriangle,
    TbBuildingStore,
    TbFlame,
    TbSpeakerphone,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import AuctionPreviewCard from '@/features/auction/components/AuctionPreviewCard'
import { auctionPhaseOf } from '@/features/auction/lib/auctionPhase'
import { useNow } from '@/features/auction/lib/useNow'
import HomeBanner from '@/features/home/components/HomeBanner'
import HomeSection from '@/features/home/components/HomeSection'
import { useAuctionList } from '@/lib/queries/auctions'
import type { AuctionListQuery, AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 `/` (FC-070 — design-brief B-1 · 목업 `#home`).
 *
 * 섹션(목업 `#home` DOM 순서, `market.js home()` + `market-brief.js` 오버라이드):
 * 배너 캐러셀(3슬라이드) → 오늘의 경매 마감 임박(실연동) → 오늘의 추천 마켓 아이템(준비 중) →
 * 공지사항(연동 예정).
 *
 * ★★ **홈 프리뷰는 `preview` 캐시 키를 쓴다**(`useAuctionList`, FC-059). 경매 목록 화면의 `browse`
 *    무효화 반경 밖이라 필터를 만질 때마다 홈이 깜빡이지 않는다(design-brief B-1 함정).
 * ★ **섹션별 상태 격리** — 각 섹션이 자기 로딩/빈/에러를 낸다(전체화면 블러 금지, §5).
 * ★ **마감 임박 = `endAt` 오름차 정렬 + 클라 마감 제외**. 마감 강등 워커가 없어 `endAt` 지난 경매도
 *   `status: ACTIVE` 로 내려오므로(rebuild-contract-map 주의 3), 정렬 상위에 낀 **이미 끝난 경매를
 *   클라가 걸러**(`auctionPhaseOf`) 진짜 임박한 것만 6장 보인다. 그래서 6장보다 넉넉히 받는다.
 * ★ **추천 마켓·공지는 자리보류.** 고정가 마켓(`/shops`)·공지(`/notices`)는 홈에서 **호출하지 않는다**
 *   (FC-048 사고 방지, §5). 헤드·캡션은 목업대로 유지하고 데이터만 **비활성 skeleton 자리**로 둔다 —
 *   가짜 제목·날짜를 실제처럼 렌더하지 않는다(정직성, FC-070-073 리뷰 M-1 · FC-080 통일).
 */

/** 마감 임박 프리뷰 — endAt 오름차, 클라 필터 여유분 포함(6장 표시) */
const PREVIEW_QUERY: AuctionListQuery = { sort: 'endAt,asc', size: 12 }
const PREVIEW_COUNT = 6
/** 추천 마켓 자리보류 골격 칸 수(목업 6) */
const MARKET_PLACEHOLDER_COUNT = 6
/** 공지 자리보류 골격 줄 수(목업 목록 높이) */
const NOTICE_PLACEHOLDER_COUNT = 5

export default function HomePage() {
    const now = useNow()

    return (
        <div className="flex flex-col gap-8">
            <HomeBanner />

            <ClosingSoonSection now={now} />
            <RecommendMarketSection />
            <NoticeSection />
        </div>
    )
}

/* ── 오늘의 경매 마감 임박 (실연동) ────────────────────────────────────────── */

function ClosingSoonSection({ now }: { now: number }) {
    const { data, isPending, isError, refetch } = useAuctionList(PREVIEW_QUERY)

    const auctions = useMemo(() => {
        const all: AuctionSummary[] = data?.content ?? []
        return all
            .filter(
                (auction) =>
                    auctionPhaseOf(
                        {
                            status: auction.status,
                            startAt: auction.startAt,
                            endAt: auction.endAt,
                        },
                        now,
                    ) !== 'ended',
            )
            .slice(0, PREVIEW_COUNT)
    }, [data, now])

    const isEmpty = !isPending && auctions.length === 0

    return (
        <HomeSection
            icon={TbFlame}
            title="오늘의 경매 마감 임박"
            description="현재 참여할 수 있는 경매 아이템입니다."
            seeAllHref={paths.auctions}
        >
            {isPending && <PreviewGridSkeleton count={PREVIEW_COUNT} />}

            {!isPending && isError && auctions.length === 0 && (
                <StateBlock
                    icon={TbAlertTriangle}
                    title="마감 임박 경매를 불러오지 못했어요"
                    description="잠시 후 다시 시도해 주세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            onClick={() => void refetch()}
                        >
                            다시 시도
                        </button>
                    }
                />
            )}

            {isEmpty && !isError && (
                <StateBlock
                    icon={TbFlame}
                    title="지금 마감 임박한 경매가 없어요"
                    description="전체 경매에서 원하는 아이템을 찾아보세요."
                />
            )}

            {auctions.length > 0 && (
                <div className="grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6">
                    {auctions.map((auction) => (
                        <AuctionPreviewCard
                            key={auction.auctionPublicId}
                            auction={auction}
                            now={now}
                        />
                    ))}
                </div>
            )}
        </HomeSection>
    )
}

/* ── 오늘의 추천 마켓 아이템 (준비 중 자리보류) ─────────────────────────────
 *
 * ★ 고정가 마켓은 백엔드 미구현(`ShopController` 없음, §5). **엔드포인트를 호출하지 않는다**
 *   (FC-048 사고). 목업 헤드·캡션은 그대로 두고 `home-recommend-card` 6칸 골격만 비활성으로 남긴다.
 */
function RecommendMarketSection() {
    return (
        <HomeSection
            icon={TbBuildingStore}
            title="오늘의 추천 마켓 아이템"
            description="아이템마켓에서 거래 중인 추천 아이템입니다."
            seeAllHref={paths.market}
        >
            <ul
                aria-label="추천 마켓 준비 중"
                className="grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6"
            >
                {Array.from({ length: MARKET_PLACEHOLDER_COUNT }).map(
                    (_, index) => (
                        <li
                            key={index}
                            aria-disabled="true"
                            className="home-recommend-card flex flex-col overflow-hidden rounded-xl border border-dashed border-line bg-surface"
                        >
                            <div className="grid aspect-square place-items-center bg-gray-50 text-gray-300">
                                <TbBuildingStore
                                    aria-hidden
                                    className="size-6"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 p-3">
                                <span className="h-3 w-3/4 rounded bg-gray-100" />
                                <span className="h-3 w-1/2 rounded bg-gray-100" />
                            </div>
                        </li>
                    ),
                )}
            </ul>
            <p className="mt-2 text-center text-xs text-gray-400">
                고정가 마켓은 준비 중이에요.
            </p>
        </HomeSection>
    )
}

/* ── 공지사항 (연동 예정 자리보류) ──────────────────────────────────────────
 *
 * ★ 공지(`NoticeController`)는 스켈레톤 참조구현이라 **product 계약(`/api/v1`) 밖 `/notices`** 에
 *   있고, dev 프록시(`/api`)·클라이언트 base(`/api/v1`)·`api-contract` 어디에도 실려 있지 않다.
 *   억지로 붙이면 전송로가 둘로 갈리므로(FC-056 위배) **연동을 보류**한다.
 * ★ FC-070-073 리뷰 M-1: 과거 정적 5제목·날짜를 실제처럼 렌더해 마켓 자리(빈 skeleton)와 어긋났다.
 *   → 추천 마켓과 **같은 방식의 비활성 skeleton**으로 통일한다(가짜 제목·날짜 제거, 실 호출 없음).
 */
function NoticeSection() {
    return (
        <HomeSection
            icon={TbSpeakerphone}
            title="공지사항"
            seeAllHref={paths.community}
            seeAllLabel="더 보기"
        >
            <ul
                aria-label="공지 연동 준비 중"
                className="divide-y divide-line overflow-hidden rounded-xl border border-dashed border-line bg-surface"
            >
                {Array.from({ length: NOTICE_PLACEHOLDER_COUNT }).map(
                    (_, index) => (
                        <li
                            key={index}
                            aria-disabled="true"
                            className="flex items-center gap-3 px-4 py-3"
                        >
                            <span className="h-4 w-10 shrink-0 rounded-full bg-gray-100" />
                            <span className="h-3 min-w-0 flex-1 rounded bg-gray-100" />
                            <span className="h-3 w-10 shrink-0 rounded bg-gray-100" />
                        </li>
                    ),
                )}
            </ul>
            <p className="mt-2 text-center text-xs text-gray-400">
                공지 연동은 준비 중이에요.
            </p>
        </HomeSection>
    )
}

/* ── 공통 표시 조각 ────────────────────────────────────────────────────────── */

/** 마감 임박 그리드 스켈레톤(섹션 영역만 — 전체 블러 금지, §5). */
function PreviewGridSkeleton({ count }: { count: number }) {
    return (
        <div
            aria-hidden
            className="grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6"
        >
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
                >
                    <div className="aspect-square animate-pulse bg-gray-100" />
                    <div className="flex flex-col gap-2 p-3">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                        <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function StateBlock({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Icon aria-hidden className="size-6" />
            </span>
            <h3 className="mt-3 text-base font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {action && <div className="mt-4">{action}</div>}
        </section>
    )
}
