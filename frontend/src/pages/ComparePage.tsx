import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { TbAlertTriangle, TbColumns3, TbX } from 'react-icons/tb'
import { auctionDetailPath, marketDetailPath, paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import { useAppFooterVariant } from '@/components/layout/AppFooterContext'
import Countdown from '@/features/auction/components/Countdown'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
} from '@/features/auction/lib/auctionPhase'
import {
    compareSkillLabel,
    comparePriceOf,
} from '@/features/auction/lib/compareView'
import { useNow } from '@/features/auction/lib/useNow'
import ItemFrame from '@/features/item/components/ItemFrame'
import { elementLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import { goldforceRemainingDays } from '@/features/item/components/frame'
import { useCompareAuctions } from '@/lib/queries/auctions'
import { useCompareShops } from '@/lib/queries/shop'
import { shopStatusLabelOf } from '@/features/shop/lib/shopStatus'
import { MAX_COMPARE_ITEMS } from '@/store/compareSession'
import { useCompareStore } from '@/store/compareStore'
import type { AuctionItemBlock } from '@/lib/api/auctions'
import type { CompareReference } from '@/store/compareSession'

/**
 * 아이템 비교 `/compare` (FC-079 → FC-094 에서 경매·고정가 혼합 비교, 목업 §11).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **선택 참조(스토어)만 갖고 표시 데이터는 다시 받는다 — 출처별로 갈라 되받는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `AUCTION` 은 `GET /auctions/{id}`, `MARKET` 은 `GET /shops/{id}` 로 각각 상세 캐시를 재사용해
 * 가져온다(스냅샷 세션 저장 금지, 신선도). 컬럼은 **원래 선택 순서**를 유지한다.
 *
 * ★ **행 우선순위**(티켓): ①가격(의미 표기) ②스킬1 ③스킬2 ④거래상태 ⑤골드포스 ⑥속성/종류.
 *   **스킬 = 코드 중립 표기**(`스킬 #{code}` §2.5). 스킬·골드포스·속성/종류는 두 출처 공통(item 블록).
 * ★ **가격 의미를 반드시 표기** — 경매="현재 최고가"(입찰 없으면 "시작가"), 고정가="고정가".
 *   저렴 오해를 막도록 경매는 남은시간·상태를 동반한다(고정가는 마감 압박이 없어 상태만).
 * ★ **모바일 비교표 = 내부 가로 스크롤**. 카운트다운은 단일 타이머(`useNow`).
 */

/** 라벨 열 폭·데이터 열 최소폭(px) — min-width 로 모바일 내부 가로 스크롤을 만든다. */
const LABEL_COL_PX = 140
const DATA_COL_PX = 200

/**
 * 정규화된 비교 컬럼 — 두 출처를 한 형태로 담는다. `state` 는 조회 진행/실패/완료.
 * `ready` 면 `item` 이 채워지고, 나머지 필드가 출처별로 파생된다.
 */
interface CompareColumn {
    listingId: string
    source: CompareReference['source']
    state: 'loading' | 'error' | 'ready'
    /** ready 일 때만 — 공통 item 블록(스킬·골드포스·속성/종류의 단일 출처) */
    item?: AuctionItemBlock
    /** 헤더 배지 문구 */
    sourceLabel: string
    /** 가격 셀 */
    price?: { amount: number; meaning: string }
    /** 거래 상태 라벨 */
    statusLabel?: string
    /** 카운트다운 대상 마감 시각 — 경매만(고정가는 마감 압박이 없어 null) */
    countdownEndAt?: string | null
    /** 거래하기 링크 */
    tradeHref?: string
    tradeLabel: string
}

export default function ComparePage() {
    const now = useNow()
    const items = useCompareStore((state) => state.items)
    const remove = useCompareStore((state) => state.remove)
    const clear = useCompareStore((state) => state.clear)

    const auctionRefs = items.filter((item) => item.source === 'AUCTION')
    const shopRefs = items.filter((item) => item.source === 'MARKET')

    const auctionResults = useCompareAuctions(
        auctionRefs.map((ref) => ref.listingId),
    )
    const shopResults = useCompareShops(shopRefs.map((ref) => ref.listingId))

    // listingId → 조회 결과(출처별). 스토어가 listingId 를 dedup 하므로 충돌 없음.
    const auctionByListing = new Map(
        auctionRefs.map((ref, index) => [ref.listingId, auctionResults[index]]),
    )
    const shopByListing = new Map(
        shopRefs.map((ref, index) => [ref.listingId, shopResults[index]]),
    )

    const columns: CompareColumn[] = items.map((ref) => {
        if (ref.source === 'AUCTION') {
            const query = auctionByListing.get(ref.listingId)
            if (!query || query.isPending) {
                return {
                    listingId: ref.listingId,
                    source: 'AUCTION',
                    state: 'loading',
                    sourceLabel: '실시간 경매',
                    tradeLabel: '경매 보기',
                }
            }
            if (query.isError || !query.data) {
                return {
                    listingId: ref.listingId,
                    source: 'AUCTION',
                    state: 'error',
                    sourceLabel: '실시간 경매',
                    tradeLabel: '경매 보기',
                }
            }
            const auction = query.data
            const price = comparePriceOf(auction)
            const phase = auctionPhaseOf(
                {
                    status: auction.status,
                    startAt: auction.startAt,
                    endAt: auction.endAt,
                },
                now,
            )
            return {
                listingId: ref.listingId,
                source: 'AUCTION',
                state: 'ready',
                item: auction.item,
                sourceLabel: '실시간 경매',
                price: { amount: price.amount, meaning: price.meaning },
                statusLabel: auctionPhaseLabelOf(phase),
                countdownEndAt: auction.endAt,
                tradeHref: auctionDetailPath(auction.auctionPublicId),
                tradeLabel: '경매 보기',
            }
        }

        const query = shopByListing.get(ref.listingId)
        if (!query || query.isPending) {
            return {
                listingId: ref.listingId,
                source: 'MARKET',
                state: 'loading',
                sourceLabel: '고정가 마켓',
                tradeLabel: '마켓에서 보기',
            }
        }
        if (query.isError || !query.data) {
            return {
                listingId: ref.listingId,
                source: 'MARKET',
                state: 'error',
                sourceLabel: '고정가 마켓',
                tradeLabel: '마켓에서 보기',
            }
        }
        const shop = query.data
        return {
            listingId: ref.listingId,
            source: 'MARKET',
            state: 'ready',
            item: shop.item,
            sourceLabel: '고정가 마켓',
            price: { amount: shop.price, meaning: '고정가' },
            statusLabel: shopStatusLabelOf(shop.status),
            countdownEndAt: null,
            tradeHref: marketDetailPath(shop.shopPublicId),
            tradeLabel: '상품 보기',
        }
    })

    useAppFooterVariant(columns.length === 0 ? 'compact' : 'default')

    if (columns.length === 0) return <CompareEmpty />

    const count = columns.length
    const gridStyle = {
        gridTemplateColumns: `${LABEL_COL_PX}px repeat(${count}, minmax(180px, 1fr))`,
        minWidth: `${LABEL_COL_PX + count * DATA_COL_PX}px`,
    }

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <TbColumns3 aria-hidden className="size-6 text-navy" />
                        아이템 비교
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        가격과 스킬 1·2를 가장 먼저 확인하고 거래 방식을
                        비교하세요.
                    </p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                    onClick={clear}
                >
                    <TbX aria-hidden className="size-4" />
                    전체 해제
                </button>
            </header>

            <section className="overflow-hidden rounded-2xl border border-line bg-surface">
                {/* 내부 가로 스크롤 — 모바일에서 표가 넘치면 여기서만 스크롤한다 */}
                <div className="overflow-x-auto [overscroll-behavior-inline:contain]">
                    <div style={gridStyle}>
                        {/* 상품 헤더 행 */}
                        <div
                            style={gridStyle}
                            className="sticky top-0 z-[3] grid bg-surface"
                        >
                            <div className="sticky left-0 z-[4] flex flex-col justify-end gap-2 border-b border-r border-line bg-surface-sunken p-4">
                                <span className="w-fit rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy-700">
                                    최대 {MAX_COMPARE_ITEMS}개
                                </span>
                                <strong className="text-xs text-gray-900">
                                    비교 항목
                                </strong>
                            </div>
                            {columns.map((column) => (
                                <CompareProduct
                                    key={column.listingId}
                                    column={column}
                                    now={now}
                                    onRemove={() => remove(column.listingId)}
                                />
                            ))}
                        </div>

                        {/* ① 가격 — 의미 표기(경매/고정가) */}
                        <CompareRow
                            priority
                            label="가격"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) =>
                                column.price ? (
                                    <>
                                        <CodeAmount
                                            value={column.price.amount}
                                            mode="full"
                                            className="text-lg font-bold text-orange-deep"
                                        />
                                        <small className="text-[10px] text-gray-500">
                                            {column.price.meaning}
                                        </small>
                                    </>
                                ) : null
                            }
                        />

                        {/* ② 스킬 1 — 스킬명(없으면 코드 폴백) */}
                        <CompareRow
                            priority
                            label="스킬 1"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) =>
                                column.item ? (
                                    <SkillCell
                                        code={column.item.skill1}
                                        name={column.item.skill1Name}
                                    />
                                ) : null
                            }
                        />

                        {/* ③ 스킬 2 — 스킬명(없으면 코드 폴백) */}
                        <CompareRow
                            priority
                            label="스킬 2"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) =>
                                column.item ? (
                                    <SkillCell
                                        code={column.item.skill2}
                                        name={column.item.skill2Name}
                                    />
                                ) : null
                            }
                        />

                        {/* ④ 거래 상태 (+경매는 남은시간) */}
                        <CompareRow
                            label="거래 상태"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) => (
                                <>
                                    <strong className="text-[13px] text-gray-900">
                                        {column.statusLabel ?? '-'}
                                    </strong>
                                    {column.countdownEndAt && (
                                        <Countdown
                                            endAt={column.countdownEndAt}
                                            now={now}
                                            className="!text-[11px]"
                                        />
                                    )}
                                </>
                            )}
                        />

                        {/* ⑤ 골드포스 잔여 */}
                        <CompareRow
                            label="골드포스"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) => {
                                if (!column.item) return null
                                const days = goldforceRemainingDays(
                                    column.item.goldforceExpireAt,
                                    now,
                                )
                                if (days === null) {
                                    return (
                                        <span className="text-xs text-gray-400">
                                            미적용
                                        </span>
                                    )
                                }
                                return (
                                    <>
                                        <strong className="text-[13px] text-gray-900">
                                            {days}일
                                        </strong>
                                        <small className="text-[10px] text-gray-500">
                                            잔여 기간
                                        </small>
                                    </>
                                )
                            }}
                        />

                        {/* ⑥ 속성 / 종류 */}
                        <CompareRow
                            label="속성 · 종류"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) =>
                                column.item ? (
                                    <>
                                        <strong className="text-[13px] text-gray-900">
                                            {elementLabelOf(
                                                column.item.element,
                                            )}
                                        </strong>
                                        <small className="text-[10px] text-gray-500">
                                            {itemTypeLabel(
                                                column.item.subGroup,
                                                column.item.kind,
                                            )}
                                        </small>
                                    </>
                                ) : null
                            }
                        />

                        {/* 거래하기 — 경매는 상세, 고정가는 마켓 목록으로(상세 화면 없음, §9) */}
                        <CompareRow
                            label="거래하기"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(column) =>
                                column.tradeHref ? (
                                    <Link
                                        to={column.tradeHref}
                                        className="w-fit rounded-lg border border-navy px-3 py-1.5 text-xs font-bold text-navy hover:bg-navy hover:text-white"
                                    >
                                        {column.tradeLabel}
                                    </Link>
                                ) : null
                            }
                        />
                    </div>
                </div>
            </section>
        </div>
    )
}

/** 상품 헤더 셀 — 아트·출처 배지·이름·제거. 로딩/에러도 자리를 지킨다. */
function CompareProduct({
    column,
    now,
    onRemove,
}: {
    column: CompareColumn
    now: number
    onRemove: () => void
}) {
    const removeButton = (
        <button
            type="button"
            aria-label="비교에서 제거"
            className="absolute right-2.5 top-2.5 z-[3] grid size-7 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            onClick={onRemove}
        >
            <TbX aria-hidden className="size-4" />
        </button>
    )

    if (column.state !== 'ready' || !column.item) {
        return (
            <div className="relative min-w-0 border-b border-r border-line p-4 text-center">
                {removeButton}
                <div className="mx-auto grid h-[156px] place-items-center rounded-xl bg-navy-900/90 text-gray-500">
                    {column.state === 'loading' ? (
                        <span
                            role="status"
                            className="animate-pulse text-xs text-gray-300"
                        >
                            불러오는 중…
                        </span>
                    ) : (
                        <span className="flex flex-col items-center gap-1 text-xs text-gray-300">
                            <TbAlertTriangle aria-hidden className="size-6" />
                            불러오지 못함
                        </span>
                    )}
                </div>
            </div>
        )
    }

    const { item } = column
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        1,
    )
    const hasSkill = item.skill1 !== null || item.skill2 !== null
    const badgeClass =
        column.source === 'MARKET'
            ? 'bg-navy/10 text-navy-700'
            : 'bg-orange-subtle text-orange-deep'

    return (
        <div className="relative min-w-0 border-b border-r border-line p-4 text-center">
            {removeButton}
            <div className="relative block h-[158px] overflow-hidden rounded-xl">
                <ItemFrame
                    fill
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.nameSnapshot}
                    visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                    hasSkill={hasSkill}
                    size="stage"
                    now={now}
                />
            </div>
            <span
                className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}
            >
                {column.sourceLabel}
            </span>
            <h2 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-gray-900">
                {item.nameSnapshot}
            </h2>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">
                {item.specSnapshot}
            </p>
        </div>
    )
}

/** 비교 행 — 라벨(고정 열) + 열별 셀. ready 아닌 열은 "-". */
function CompareRow({
    label,
    priority = false,
    gridStyle,
    columns,
    render,
}: {
    label: string
    priority?: boolean
    gridStyle: CSSProperties
    columns: CompareColumn[]
    render: (column: CompareColumn) => ReactNode
}) {
    const priorityBg = priority ? 'bg-orange-subtle/30' : ''
    return (
        <div style={gridStyle} className="grid">
            <strong
                className={`sticky left-0 z-[2] flex min-h-[76px] flex-col justify-center border-b border-r border-line px-4 py-3 text-xs ${
                    priority
                        ? 'bg-orange-subtle/40 text-orange-deep'
                        : 'bg-surface-sunken text-gray-700'
                }`}
            >
                {label}
            </strong>
            {columns.map((column) => {
                const cell = column.state === 'ready' ? render(column) : null
                return (
                    <div
                        key={column.listingId}
                        className={`flex min-h-[76px] flex-col justify-center gap-0.5 border-b border-r border-line px-4 py-3 ${priorityBg}`}
                    >
                        {cell ?? (
                            <span className="text-xs text-gray-300">-</span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/** 스킬 셀 — 스킬명(없으면 `스킬 #{code}` 폴백) 또는 "없음"(빈 슬롯). */
function SkillCell({
    code,
    name,
}: {
    code: number | null
    name?: string | null
}) {
    const label = compareSkillLabel(code, name)
    const empty = label === '없음'
    return (
        <strong
            className={`text-[13px] ${empty ? 'font-medium text-gray-400' : 'text-gray-900'}`}
        >
            {label}
        </strong>
    )
}

/** 빈 상태 — 경매·마켓 양쪽으로 유도. */
function CompareEmpty() {
    return (
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-navy text-gold-bright">
                <TbColumns3 aria-hidden className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
                비교할 아이템이 없습니다
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-500">
                실시간 경매나 아이템 마켓에서 카드의 &lsquo;비교&rsquo; 버튼으로
                아이템을 담으면 여기에서 나란히 비교할 수 있어요.
            </p>
            <div className="mt-6 flex items-center gap-2">
                <Link
                    to={paths.auctions}
                    className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep"
                >
                    실시간 경매
                </Link>
                <Link
                    to={paths.market}
                    className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
                >
                    아이템 마켓
                </Link>
            </div>
        </section>
    )
}
