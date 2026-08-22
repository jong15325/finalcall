import { useMemo } from 'react'
import { Link } from 'react-router'
import { TbBuildingStore, TbFlame, TbPin, TbSpeakerphone } from 'react-icons/tb'
import { boardPath, boardPostPath, paths } from '@/app/paths'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import AuctionCard from '@/features/auction/components/AuctionCard'
import { auctionPhaseOf } from '@/features/auction/lib/auctionPhase'
import { useNow } from '@/features/auction/lib/useNow'
import { formatPostTime } from '@/features/board/lib/postView'
import HomeBanner from '@/features/home/components/HomeBanner'
import HomeSection, {
    HomeSectionHeading,
} from '@/features/home/components/HomeSection'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import { useAuctionList } from '@/lib/queries/auctions'
import { usePostList } from '@/lib/queries/boards'
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
 * ★ **추천 마켓은 자리보류**(고정가 마켓 `/shops` 미호출, FC-048). **공지는 FC-204 에서 실연동** —
 *   공지 게시판(`/boards/notice`)이 흡수돼(FC-201) `GET /boards/notice/posts` 로 서빙되므로 홈이
 *   실제 공지를 3~5줄 보여준다(더 이상 자리보류 아님).
 */

/** 마감 임박 프리뷰 — endAt 오름차, 클라 필터 여유분 포함(6장 표시) */
const PREVIEW_QUERY: AuctionListQuery = { sort: 'endAt,asc', size: 12 }
const PREVIEW_COUNT = 6
/** 추천 마켓 자리보류 골격 칸 수(목업 6) */
const MARKET_PLACEHOLDER_COUNT = 6
/** 공지 게시판 slug(FC-201 흡수) + 홈 미리보기 줄 수 */
const NOTICE_SLUG = 'notice'
const NOTICE_PREVIEW_COUNT = 5

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
    const listState: ListFrameState = isPending
        ? { kind: 'loading', count: PREVIEW_COUNT }
        : isError && auctions.length === 0
          ? {
                kind: 'error',
                message: '잠시 후 다시 시도해 주세요.',
                onRetry: () => void refetch(),
            }
          : isEmpty
            ? {
                  kind: 'empty',
                  title: '지금 마감 임박한 경매가 없어요',
                  description: '전체 경매에서 원하는 아이템을 찾아보세요.',
              }
            : { kind: 'ready' }

    return (
        <section data-home-auction-list>
            <ListFrame
                heading={
                    <HomeSectionHeading
                        icon={TbFlame}
                        title="오늘의 경매 마감 임박"
                        description="현재 참여할 수 있는 경매 아이템입니다."
                        seeAllHref={paths.auctions}
                    />
                }
                state={listState}
                layout="catalog"
                label="마감 임박 경매 목록"
                renderSkeleton={() => <ItemListSkeleton layout="preview" />}
            >
                {auctions.map((auction) => (
                    <AuctionCard
                        key={auction.auctionPublicId}
                        auction={auction}
                        now={now}
                    />
                ))}
            </ListFrame>
        </section>
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
                            className="home-recommend-card flex flex-col overflow-hidden rounded-xl border border-dashed border-content-line bg-content-surface"
                        >
                            <div className="grid aspect-square place-items-center bg-content-soft text-content-line">
                                <TbBuildingStore
                                    aria-hidden
                                    className="size-6"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 p-3">
                                <span className="h-3 w-3/4 rounded bg-content-soft" />
                                <span className="h-3 w-1/2 rounded bg-content-soft" />
                            </div>
                        </li>
                    ),
                )}
            </ul>
            <p className="mt-2 text-center text-xs text-content-subtle">
                고정가 마켓은 준비 중이에요.
            </p>
        </HomeSection>
    )
}

/* ── 공지사항 (실연동 — FC-204) ─────────────────────────────────────────────
 *
 * ★ 공지 게시판(slug=`notice`, FC-201 흡수)을 `GET /boards/notice/posts`(커서) 로 받아 최신 공지
 *   3~5줄을 보여준다. 목록 화면과 **같은 쿼리 키**(`usePostList('notice')`)라 캐시를 공유한다 —
 *   홈에서 로드한 첫 페이지를 공지 목록 화면이 재사용한다.
 * ★ 항목 클릭 → `/boards/notice/:postId`, "더 보기" → `/boards/notice`. 서버 정렬(고정 우선·최신순)을
 *   그대로 쓰고, 홈은 첫 페이지 앞에서 몇 줄만 자른다. 로딩/빈/에러는 섹션 안에서 낸다(§5 상태 격리).
 */
function NoticeSection() {
    const { data, isPending, isError } = usePostList(NOTICE_SLUG)
    const notices = (data?.pages[0]?.content ?? []).slice(
        0,
        NOTICE_PREVIEW_COUNT,
    )

    return (
        <HomeSection
            icon={TbSpeakerphone}
            title="공지사항"
            seeAllHref={boardPath(NOTICE_SLUG)}
            seeAllLabel="더 보기"
        >
            {isPending && (
                <ul
                    aria-hidden
                    className="divide-y divide-content-line overflow-hidden rounded-xl border border-content-line bg-content-surface"
                >
                    {Array.from({ length: NOTICE_PREVIEW_COUNT }).map(
                        (_, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <span className="h-3 min-w-0 flex-1 animate-pulse rounded bg-content-soft" />
                                <span className="h-3 w-10 shrink-0 animate-pulse rounded bg-content-soft" />
                            </li>
                        ),
                    )}
                </ul>
            )}

            {!isPending && isError && (
                <p className="rounded-xl border border-dashed border-content-line bg-content-surface px-4 py-6 text-center text-sm text-content-subtle">
                    공지를 불러오지 못했어요.
                </p>
            )}

            {!isPending && !isError && notices.length === 0 && (
                <p className="rounded-xl border border-dashed border-content-line bg-content-surface px-4 py-6 text-center text-sm text-content-subtle">
                    등록된 공지가 없어요.
                </p>
            )}

            {notices.length > 0 && (
                <ul className="divide-y divide-content-line overflow-hidden rounded-xl border border-content-line bg-content-surface">
                    {notices.map((notice) => (
                        <li key={notice.postPublicId}>
                            <Link
                                to={boardPostPath(
                                    NOTICE_SLUG,
                                    notice.postPublicId,
                                )}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-content-soft"
                            >
                                {notice.isPinned && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-highlight-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-highlight-deep">
                                        <TbPin aria-hidden className="size-3" />
                                        고정
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-fg">
                                    {notice.title}
                                </span>
                                <span className="shrink-0 text-xs text-content-subtle">
                                    {formatPostTime(notice.createdAt)}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </HomeSection>
    )
}

