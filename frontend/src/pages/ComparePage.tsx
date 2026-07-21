import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { TbAlertTriangle, TbColumns3, TbX } from 'react-icons/tb'
import { auctionDetailPath, paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
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
import { MAX_COMPARE_ITEMS } from '@/store/compareSession'
import { useCompareStore } from '@/store/compareStore'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 아이템 비교 `/compare` (FC-079 — 목업 `comparePage` 1:1, 색만 브랜드 §2.9).
 *
 * ★ **선택 참조(스토어)만 갖고 표시 데이터는 다시 받는다** — `useCompareAuctions` 가
 *   `GET /auctions/{id}` 를 상세 캐시 재사용으로 가져온다(스냅샷 세션 저장 금지, 신선도).
 * ★ **경매 아이템만 비교 대상**(§1 라우트 6). 목업의 마켓·경매 혼합 비교 중 마켓 경로는
 *   고정가 미구현이라 자리보류 — 빈 상태에서 "아이템 마켓" 은 `disabled` 안내로만 둔다.
 * ★ **행 우선순위**(티켓): ①가격(현재 최고가 의미 표기) ②스킬1 ③스킬2 ④거래상태(+남은시간)
 *   ⑤골드포스 잔여 ⑥속성/종류. **스킬 = 코드 중립 표기**(`스킬 #{code}`, 이름 없음 §2.5).
 * ★ **가격 의미를 반드시 표기**(경매="현재 최고가", 입찰 없으면 "시작가")하고 남은시간·상태를
 *   동반해 저렴 오해를 막는다. 마감은 클라 판정(`now>=endAt`).
 * ★ **모바일 비교표 = 내부 가로 스크롤**(`overflow-x-auto` + min-width). 카운트다운은 단일 타이머.
 */

/** 라벨 열 폭·데이터 열 최소폭(px) — min-width 로 모바일 내부 가로 스크롤을 만든다. */
const LABEL_COL_PX = 140
const DATA_COL_PX = 200

interface CompareColumn {
    listingId: string
    state: 'loading' | 'error' | 'ready'
    auction?: AuctionDetail
}

export default function ComparePage() {
    const now = useNow()
    const items = useCompareStore((state) => state.items)
    const remove = useCompareStore((state) => state.remove)
    const clear = useCompareStore((state) => state.clear)

    const ids = items.map((item) => item.listingId)
    const results = useCompareAuctions(ids)

    const columns: CompareColumn[] = items.map((item, index) => {
        const query = results[index]
        if (query?.isPending) {
            return { listingId: item.listingId, state: 'loading' }
        }
        if (!query || query.isError || !query.data) {
            return { listingId: item.listingId, state: 'error' }
        }
        return {
            listingId: item.listingId,
            state: 'ready',
            auction: query.data,
        }
    })

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
                {/* 내부 가로 스크롤 — 모바일에서 표가 넘치면 여기서만 스크롤한다(§ 모바일) */}
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

                        {/* ① 가격 — 현재 최고가 의미 표기 */}
                        <CompareRow
                            priority
                            label="가격"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => {
                                const price = comparePriceOf(auction)
                                return (
                                    <>
                                        <CodeAmount
                                            value={price.amount}
                                            mode="full"
                                            className="text-lg font-bold text-orange-deep"
                                        />
                                        <small className="text-[10px] text-gray-500">
                                            {price.meaning}
                                        </small>
                                    </>
                                )
                            }}
                        />

                        {/* ② 스킬 1 — 코드 중립 표기 */}
                        <CompareRow
                            priority
                            label="스킬 1"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => (
                                <SkillCell code={auction.item.skill1} />
                            )}
                        />

                        {/* ③ 스킬 2 — 코드 중립 표기 */}
                        <CompareRow
                            priority
                            label="스킬 2"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => (
                                <SkillCell code={auction.item.skill2} />
                            )}
                        />

                        {/* ④ 거래 상태 (+남은시간) */}
                        <CompareRow
                            label="거래 상태"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => {
                                const phase = auctionPhaseOf(
                                    {
                                        status: auction.status,
                                        startAt: auction.startAt,
                                        endAt: auction.endAt,
                                    },
                                    now,
                                )
                                return (
                                    <>
                                        <strong className="text-[13px] text-gray-900">
                                            {auctionPhaseLabelOf(phase)}
                                        </strong>
                                        <Countdown
                                            endAt={auction.endAt}
                                            now={now}
                                            className="!text-[11px]"
                                        />
                                    </>
                                )
                            }}
                        />

                        {/* ⑤ 골드포스 잔여 */}
                        <CompareRow
                            label="골드포스"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => {
                                const days = goldforceRemainingDays(
                                    auction.item.goldforceExpireAt,
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
                            render={(auction) => (
                                <>
                                    <strong className="text-[13px] text-gray-900">
                                        {elementLabelOf(auction.item.element)}
                                    </strong>
                                    <small className="text-[10px] text-gray-500">
                                        {itemTypeLabel(
                                            auction.item.subGroup,
                                            auction.item.kind,
                                        )}
                                    </small>
                                </>
                            )}
                        />

                        {/* 거래하기 — 경매 상세로 이동(즉시구매 버튼은 404라 만들지 않는다, §5) */}
                        <CompareRow
                            label="거래하기"
                            gridStyle={gridStyle}
                            columns={columns}
                            render={(auction) => (
                                <Link
                                    to={auctionDetailPath(
                                        auction.auctionPublicId,
                                    )}
                                    className="w-fit rounded-lg border border-navy px-3 py-1.5 text-xs font-bold text-navy hover:bg-navy hover:text-white"
                                >
                                    경매 보기
                                </Link>
                            )}
                        />
                    </div>
                </div>
            </section>

            <p className="text-xs text-gray-400">
                고정가 마켓 아이템 비교는 준비 중입니다. 지금은 실시간 경매
                아이템만 비교할 수 있어요.
            </p>
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

    if (column.state !== 'ready' || !column.auction) {
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

    const { item } = column.auction
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
            <span className="mt-3 inline-block rounded-full bg-orange-subtle px-2 py-0.5 text-[10px] font-bold text-orange-deep">
                실시간 경매
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
    render: (auction: AuctionDetail) => ReactNode
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
            {columns.map((column) => (
                <div
                    key={column.listingId}
                    className={`flex min-h-[76px] flex-col justify-center gap-0.5 border-b border-r border-line px-4 py-3 ${priorityBg}`}
                >
                    {column.state === 'ready' && column.auction ? (
                        render(column.auction)
                    ) : (
                        <span className="text-xs text-gray-300">-</span>
                    )}
                </div>
            ))}
        </div>
    )
}

/** 스킬 셀 — 코드 중립 표기(`스킬 #{code}`) 또는 "없음"(§2.5). */
function SkillCell({ code }: { code: number | null }) {
    const label = compareSkillLabel(code)
    const empty = label === '없음'
    return (
        <strong
            className={`text-[13px] ${empty ? 'font-medium text-gray-400' : 'text-gray-900'}`}
        >
            {label}
        </strong>
    )
}

/** 빈 상태 — 경매로 유도, 마켓은 준비 중 안내(자리보류). */
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
                실시간 경매에서 카드의 &lsquo;비교&rsquo; 버튼으로 아이템을
                담으면 여기에서 나란히 비교할 수 있어요.
            </p>
            <div className="mt-6 flex items-center gap-2">
                <Link
                    to={paths.auctions}
                    className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep"
                >
                    실시간 경매
                </Link>
                <button
                    disabled
                    type="button"
                    aria-disabled="true"
                    title="아이템 마켓 · 준비 중"
                    className="cursor-not-allowed rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-gray-400"
                >
                    아이템 마켓 (준비 중)
                </button>
            </div>
        </section>
    )
}
