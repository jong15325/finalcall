import { useState } from 'react'
import {
    TbCalendarEvent,
    TbCheck,
    TbClock,
    TbInfoCircle,
    TbShieldCheck,
    TbX,
} from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import useDesktopLayout from '@/components/layout/useDesktopLayout'
import ItemFrame from '@/features/item/components/ItemFrame'
import '@/features/item/components/CardInfoDialog.css'

export const SELL_DIRECTION_VARIANTS = ['canvas', 'document', 'guided'] as const
export type SellDirectionVariant = (typeof SELL_DIRECTION_VARIANTS)[number]

const END_AT: Record<number, string> = {
    1: '2026-08-15 14:30:00',
    2: '2026-08-16 14:30:00',
    3: '2026-08-17 14:30:00',
    4: '2026-08-18 14:30:00',
    5: '2026-08-19 14:30:00',
    6: '2026-08-20 14:30:00',
    7: '2026-08-21 14:30:00',
}

const COPY = {
    canvas: [
        'A. 작업 캔버스형',
        '아이템을 기준점으로 고정하고 설정에 집중하는 편집 화면',
    ],
    document: [
        'B. 문서 편집형',
        '상품 문서를 위에서 아래로 읽으며 완성하는 익숙한 흐름',
    ],
    guided: [
        'C. 단계 안내형',
        '현재 결정만 크게 보여주고 다음 행동을 분명하게 안내하는 흐름',
    ],
} as const

export default function SellPageDirectionCandidate({
    variant,
}: {
    variant: SellDirectionVariant
}) {
    const desktop = useDesktopLayout()
    const [saleType, setSaleType] = useState<'auction' | 'fixed'>('auction')
    const [duration, setDuration] = useState(3)
    const [reviewOpen, setReviewOpen] = useState(false)
    const settings = (
        <Settings
            saleType={saleType}
            setSaleType={setSaleType}
            duration={duration}
            setDuration={setDuration}
            fillHeight={variant === 'canvas' && desktop}
        />
    )

    return (
        <article
            className="grid w-full min-w-0 max-w-full gap-5"
            data-sell-direction={variant}
        >
            <Toolbar variant={variant} />
            {variant === 'canvas' && (
                <>
                    <div
                        className="grid min-w-0 gap-5"
                        style={
                            desktop
                                ? {
                                      gridTemplateColumns:
                                          'minmax(0, 13fr) minmax(0, 7fr)',
                                  }
                                : undefined
                        }
                        data-direction-ratio={desktop ? '65:35' : 'stacked'}
                    >
                        <main
                            className="order-2 grid min-w-0 gap-5 lg:order-1"
                            data-direction-region="primary-settings"
                        >
                            {settings}
                            {!desktop && (
                                <MobileRegistrationAction
                                    saleType={saleType}
                                    onReview={() => setReviewOpen(true)}
                                />
                            )}
                        </main>
                        <aside
                            className="order-1 grid h-full min-w-0 lg:order-2"
                            data-direction-region="sell-side"
                        >
                            <VerticalItemPanel
                                saleType={saleType}
                                showAction={desktop}
                                onReview={() => setReviewOpen(true)}
                            />
                        </aside>
                    </div>
                    {reviewOpen && (
                        <SellReviewDialog
                            saleType={saleType}
                            duration={duration}
                            onClose={() => setReviewOpen(false)}
                        />
                    )}
                </>
            )}
            {variant === 'document' && (
                <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <main className="grid min-w-0 gap-5">
                        <ItemPanel />
                        {settings}
                    </main>
                    <aside className="min-w-0 lg:sticky lg:top-24">
                        <Summary saleType={saleType} duration={duration} />
                    </aside>
                </div>
            )}
            {variant === 'guided' && (
                <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <main className="grid min-w-0 gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <StepRail />
                        <div className="min-w-0">{settings}</div>
                    </main>
                    <aside className="grid min-w-0 gap-5 lg:sticky lg:top-24">
                        <ItemPanel compact />
                        <Summary saleType={saleType} duration={duration} />
                    </aside>
                </div>
            )}
        </article>
    )
}

function Toolbar({ variant }: { variant: SellDirectionVariant }) {
    return (
        <header
            className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-content-line bg-content-surface p-5 px-6 shadow-sm"
            data-direction-region="toolbar"
        >
            <div>
                <span className="text-xs font-bold text-control-action-hover">
                    NEW DIRECTION
                </span>
                <h2 className="mt-1 text-xl font-bold text-content-fg">
                    {COPY[variant][0]}
                </h2>
                <p className="mt-1 text-sm leading-6 text-content-muted">
                    {COPY[variant][1]}
                </p>
            </div>
            {variant !== 'canvas' && (
                <div className="flex flex-wrap gap-2">
                    <button
                        className="min-h-11 rounded-lg border border-content-line px-4 text-sm font-bold text-content-fg hover:border-control-action"
                        type="button"
                    >
                        임시 저장
                    </button>
                    <button
                        className="min-h-11 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink shadow-sm hover:bg-control-action-hover"
                        type="button"
                    >
                        등록 검토
                    </button>
                </div>
            )}
        </header>
    )
}

function ItemPanel({ compact = false }: { compact?: boolean }) {
    return (
        <section
            className="shop-cardinfo min-w-0 shadow-lg"
            style={{ maxWidth: 'none', maxHeight: 'none', overflow: 'visible' }}
            data-direction-region="item"
            aria-labelledby={`direction-item-${compact}`}
        >
            <div className="ci-title">
                <span className="app-modal-title-icon">
                    <TbShieldCheck aria-hidden />
                </span>
                <div>
                    <h3 id={`direction-item-${compact}`}>
                        판매 아이템 <small>ITEM DETAILS</small>
                    </h3>
                </div>
                <button
                    className="ml-auto min-h-11 rounded-lg border border-content-line px-3 text-xs font-bold text-control-action-hover"
                    type="button"
                >
                    다시 선택
                </button>
            </div>
            <div className="ci-scroll">
                <div className={`ci-head ${compact ? 'items-start' : ''}`}>
                    <div className="ci-thumb">
                        <ItemFrame
                            fill
                            hasSkill
                            showGoldforceDays
                            imageUrl="/art/items/level1/l/earth/armor.png"
                            spriteUrl="/art/items/level1/l/earth/armor.png"
                            name="태산의 수호자 갑옷"
                            visual={{
                                goldforceExpireAt: '2026-09-30T00:00:00Z',
                            }}
                            size="stage"
                            scale={2}
                            now={Date.parse('2026-08-14T05:30:00Z')}
                        />
                    </div>
                    <dl className="ci-attrs">
                        <ItemDetail label="명칭" value="태산의 수호자 갑옷" />
                        <ItemDetail label="타입" value="대지 · 방어구" />
                        <ItemDetail
                            label="채널 제한"
                            value="전설 · 전체 채널"
                        />
                        <ItemDetail
                            label="속성"
                            value="방어력 +128 · 체력 +340"
                        />
                        <ItemDetail label="남은 골드 포스" value="47일" />
                        <ItemDetail
                            label="보관함"
                            value="12 / 40 · 판매 가능"
                        />
                    </dl>
                </div>
                <div className="ci-panel">
                    <h3>특수 스킬</h3>
                    <ul className="skill-list">
                        <li>
                            <span className="n">1</span>
                            <span>
                                대지의 가호 · 피해 감소{' '}
                                <b className="pct">12%</b>
                            </span>
                        </li>
                        <li>
                            <span className="n">2</span>
                            <span>불굴 · 체력 20% 이하 방어력 증가</span>
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    )
}

function VerticalItemPanel({
    saleType,
    onReview,
    showAction,
}: {
    saleType: 'auction' | 'fixed'
    onReview: () => void
    showAction: boolean
}) {
    const price = saleType === 'auction' ? 120000 : 240000
    return (
        <section
            className="shop-cardinfo min-w-0 shadow-lg"
            style={{ maxWidth: 'none', maxHeight: 'none', overflow: 'visible' }}
            data-direction-region="item"
            aria-labelledby="canvas-item-title"
        >
            <div className="ci-title">
                <span className="app-modal-title-icon">
                    <TbShieldCheck aria-hidden />
                </span>
                <h2 id="canvas-item-title">
                    카드정보 <small>ITEM DETAILS</small>
                </h2>
                <button
                    className="ml-auto min-h-11 rounded-lg border border-content-line px-3 text-xs font-bold text-control-action-hover hover:border-control-action"
                    type="button"
                >
                    다시 선택
                </button>
            </div>
            <div className="ci-scroll">
                <div className="ci-head">
                    <div className="ci-thumb">
                        <ItemFrame
                            fill
                            hasSkill
                            showGoldforceDays
                            imageUrl="/art/items/level1/l/earth/armor.png"
                            spriteUrl="/art/items/level1/l/earth/armor.png"
                            name="태산의 수호자 갑옷"
                            visual={{
                                goldforceExpireAt: '2026-09-30T00:00:00Z',
                            }}
                            size="stage"
                            scale={2}
                            now={Date.parse('2026-08-14T05:30:00Z')}
                        />
                    </div>
                    <dl className="ci-attrs">
                        <ModalRow
                            label="타입"
                            value="대지 · 방어구"
                            valueClass="el-earth"
                        />
                        <ModalRow label="명칭" value="태산의 수호자 갑옷" />
                        <ModalRow label="채널제한" value="전설 · 전체 채널" />
                        <ModalRow
                            label="속성"
                            value="방어력 +128 · 체력 +340"
                        />
                        <ModalRow label="남은 골드 포스" value="47일" />
                    </dl>
                </div>
                <div className="ci-panel">
                    <h3>특수 스킬</h3>
                    <ul className="skill-list">
                        <li>
                            <span className="n">1</span>
                            <span>
                                대지의 가호 · 피해 감소{' '}
                                <b className="pct">12%</b>
                            </span>
                        </li>
                        <li>
                            <span className="n">2</span>
                            <span>불굴 · 체력 20% 이하 방어력 증가</span>
                        </li>
                    </ul>
                </div>
            </div>
            {showAction && (
                <div className="ci-foot">
                    <div className="ci-price">
                        <span className="lbl">
                            {saleType === 'auction'
                                ? '경매 시작가'
                                : '고정 판매가'}
                        </span>
                        <span className="amt">
                            <CodeAmount value={price} mode="full" />
                        </span>
                    </div>
                    <button className="ci-buy" type="button" onClick={onReview}>
                        판매 등록 검토
                    </button>
                </div>
            )}
        </section>
    )
}

function MobileRegistrationAction({
    saleType,
    onReview,
}: {
    saleType: 'auction' | 'fixed'
    onReview: () => void
}) {
    const price = saleType === 'auction' ? 120000 : 240000
    return (
        <section
            className="flex items-center gap-4 rounded-2xl border border-content-line bg-content-surface p-5 shadow-sm"
            aria-label="모바일 판매 등록"
        >
            <div className="min-w-0">
                <span className="text-xs font-bold text-content-muted">
                    {saleType === 'auction' ? '경매 시작가' : '고정 판매가'}
                </span>
                <CodeAmount
                    value={price}
                    mode="full"
                    className="mt-1 tabular-nums"
                />
            </div>
            <button
                className="ml-auto min-h-11 shrink-0 rounded-xl bg-control-action px-5 text-sm font-bold text-control-action-ink shadow-sm hover:bg-control-action-hover"
                type="button"
                onClick={onReview}
            >
                판매 등록 검토
            </button>
        </section>
    )
}

function ModalRow({
    label,
    value,
    valueClass = '',
}: {
    label: string
    value: string
    valueClass?: string
}) {
    return (
        <div className="ci-row">
            <dt className="k">{label}</dt>
            <dd className={`v ${valueClass}`.trim()}>{value}</dd>
        </div>
    )
}

function SellReviewDialog({
    saleType,
    duration,
    onClose,
}: {
    saleType: 'auction' | 'fixed'
    duration: number
    onClose: () => void
}) {
    const desktop = useDesktopLayout()
    const price = saleType === 'auction' ? 120000 : 240000
    const fee = saleType === 'auction' ? 6000 : 12000
    const [canConfirm, setCanConfirm] = useState(desktop)
    return (
        <div
            className="app-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <section
                className="shop-cardinfo"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sell-review-title"
            >
                <div className="ci-title">
                    <span className="app-modal-title-icon">
                        <TbShieldCheck aria-hidden />
                    </span>
                    <h2 id="sell-review-title">
                        판매 등록 확인 <small>FINAL REVIEW</small>
                    </h2>
                    <button
                        className="app-modal-close"
                        type="button"
                        aria-label="닫기"
                        onClick={onClose}
                    >
                        <TbX aria-hidden />
                    </button>
                </div>
                <div
                    data-review-scroll
                    className="ci-scroll"
                    onScroll={(event) => {
                        const target = event.currentTarget
                        if (
                            target.scrollTop + target.clientHeight >=
                            target.scrollHeight - 4
                        )
                            setCanConfirm(true)
                    }}
                >
                    <div className="ci-head">
                        <div className="ci-thumb">
                            <ItemFrame
                                fill
                                hasSkill
                                showGoldforceDays
                                imageUrl="/art/items/level1/l/earth/armor.png"
                                spriteUrl="/art/items/level1/l/earth/armor.png"
                                name="태산의 수호자 갑옷"
                                visual={{
                                    goldforceExpireAt: '2026-09-30T00:00:00Z',
                                }}
                                size="stage"
                                scale={2}
                                now={Date.parse('2026-08-14T05:30:00Z')}
                            />
                        </div>
                        <dl className="ci-attrs">
                            <ModalRow
                                label="타입"
                                value="대지 · 방어구"
                                valueClass="el-earth"
                            />
                            <ModalRow label="명칭" value="태산의 수호자 갑옷" />
                            <ModalRow
                                label="채널제한"
                                value="전설 · 전체 채널"
                            />
                            <ModalRow
                                label="속성"
                                value="방어력 +128 · 체력 +340"
                            />
                            <ModalRow label="남은 골드 포스" value="47일" />
                        </dl>
                    </div>
                    <div className="ci-panel">
                        <h3>특수 스킬</h3>
                        <ul className="skill-list">
                            <li>
                                <span className="n">1</span>
                                <span>
                                    대지의 가호 · 피해 감소{' '}
                                    <b className="pct">12%</b>
                                </span>
                            </li>
                            <li>
                                <span className="n">2</span>
                                <span>불굴 · 체력 20% 이하 방어력 증가</span>
                            </li>
                        </ul>
                    </div>
                    <section
                        className="mt-4 overflow-hidden rounded-xl border border-content-line"
                        aria-label="최종 판매 조건"
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-content-line bg-content-soft p-4">
                            <div>
                                <span className="text-xs font-bold text-content-muted">
                                    판매 방식
                                </span>
                                <strong className="mt-1 block text-base text-content-fg">
                                    {saleType === 'auction'
                                        ? '경매 판매'
                                        : '고정가 판매'}
                                </strong>
                            </div>
                            <span className="rounded-lg bg-content-surface px-3 py-2 text-xs font-bold text-control-action-hover shadow-sm">
                                {saleType === 'auction'
                                    ? '등록 즉시 시작'
                                    : '즉시 구매 가능'}
                            </span>
                        </div>
                        {saleType === 'auction' && (
                            <div className="grid gap-3 border-b border-content-line p-4 sm:grid-cols-2">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-content-soft text-control-action-hover">
                                        <TbClock aria-hidden />
                                    </span>
                                    <div>
                                        <span className="text-xs font-bold text-content-muted">
                                            경매 기간
                                        </span>
                                        <strong className="block text-sm text-content-fg">
                                            {duration}일 · {duration * 24}시간
                                        </strong>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-content-soft text-control-action-hover">
                                        <TbCalendarEvent aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <span className="text-xs font-bold text-content-muted">
                                            종료 시각
                                        </span>
                                        <strong className="block break-words text-sm tabular-nums text-content-fg">
                                            {END_AT[duration]}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="grid gap-3 p-4 sm:grid-cols-3">
                            <ReviewMetric label="등록 가격" value={price} />
                            <ReviewMetric
                                muted
                                label="예상 수수료"
                                value={fee}
                            />
                            <ReviewMetric
                                emphasized
                                label="예상 수령액"
                                value={price - fee}
                            />
                        </div>
                    </section>
                    <p className="mt-4 text-center text-xs leading-5 text-content-muted">
                        등록 후 입찰이 시작되면 판매 조건을 변경할 수 없습니다.
                    </p>
                </div>
                <div className="ci-foot">
                    <button
                        className="min-h-11 rounded-xl border border-content-line bg-content-surface px-5 text-sm font-bold text-content-fg hover:border-control-action"
                        type="button"
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <div className="ci-price">
                        <span className="lbl">
                            {canConfirm
                                ? '내용 확인 완료'
                                : '아래까지 확인해 주세요'}
                        </span>
                        <span className="amt">
                            <CodeAmount value={price - fee} mode="full" />
                        </span>
                    </div>
                    <button
                        className="ci-buy"
                        type="button"
                        disabled={!canConfirm}
                    >
                        {saleType === 'auction'
                            ? '경매 등록 확정'
                            : '고정가 등록 확정'}
                    </button>
                </div>
            </section>
        </div>
    )
}

function ReviewMetric({
    label,
    value,
    muted = false,
    emphasized = false,
}: {
    label: string
    value: number
    muted?: boolean
    emphasized?: boolean
}) {
    return (
        <div
            className={`rounded-lg p-3 ${emphasized ? 'bg-content-soft' : 'bg-content-surface'}`}
        >
            <span className="text-xs font-bold text-content-muted">
                {label}
            </span>
            <strong
                className={`mt-1 block text-sm tabular-nums ${muted ? 'text-content-muted' : emphasized ? 'text-control-action-hover' : 'text-content-fg'}`}
            >
                {value.toLocaleString('ko-KR')} 코드
            </strong>
        </div>
    )
}

function Settings(props: {
    saleType: 'auction' | 'fixed'
    setSaleType: (v: 'auction' | 'fixed') => void
    duration: number
    setDuration: (v: number) => void
    fillHeight?: boolean
}) {
    const {
        saleType,
        setSaleType,
        duration,
        setDuration,
        fillHeight = false,
    } = props
    return (
        <section
            className={`min-w-0 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm ${fillHeight ? 'h-full' : ''}`}
            data-direction-region="settings"
        >
            <div className="border-b border-content-line p-5 px-6">
                <span className="text-xs font-bold text-control-action-hover">
                    판매 조건
                </span>
                <h3 className="mt-1 text-lg font-bold text-content-fg">
                    어떻게 판매할까요?
                </h3>
                <p className="mt-1 text-sm text-content-muted">
                    필수 결정만 먼저 보여주고 세부 설정은 필요할 때 엽니다.
                </p>
            </div>
            <div
                className="flex border-b border-content-line"
                role="tablist"
                aria-label="판매 방식"
            >
                <Tab
                    active={saleType === 'auction'}
                    onClick={() => setSaleType('auction')}
                >
                    경매
                </Tab>
                <Tab
                    active={saleType === 'fixed'}
                    onClick={() => setSaleType('fixed')}
                >
                    고정가
                </Tab>
            </div>
            <div
                className="grid gap-5 p-5 px-6"
                style={fillHeight ? { minHeight: 500 } : undefined}
            >
                <label className="grid gap-2 text-sm font-bold text-content-fg">
                    {saleType === 'auction' ? '시작가' : '판매가'}
                    <div className="flex items-center rounded-xl border border-content-line bg-content-surface focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action/30">
                        <input
                            className="min-h-11 min-w-0 flex-1 bg-transparent px-4 text-base font-bold tabular-nums outline-none"
                            defaultValue={
                                saleType === 'auction' ? '120,000' : '240,000'
                            }
                            inputMode="numeric"
                        />
                        <span className="px-4 text-sm font-bold text-content-muted">
                            코드
                        </span>
                    </div>
                </label>
                {saleType === 'auction' ? (
                    <>
                        <div className="flex items-start gap-3 rounded-xl bg-content-soft p-4">
                            <TbClock
                                aria-hidden
                                className="mt-1 shrink-0 text-control-action-hover"
                            />
                            <div>
                                <strong className="text-sm text-content-fg">
                                    등록 즉시 시작
                                </strong>
                                <p className="mt-1 text-xs leading-5 text-content-muted">
                                    등록 완료 시점부터 선택한 기간이 정확히
                                    흐릅니다.
                                </p>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <span className="text-sm font-bold text-content-fg">
                                        경매 기간
                                    </span>
                                    <p className="mt-1 text-xs text-content-muted">
                                        1일부터 7일까지 선택
                                    </p>
                                </div>
                                <strong className="text-lg tabular-nums text-control-action-hover">
                                    {duration}일
                                </strong>
                            </div>
                            <div
                                className="mt-3 grid gap-2"
                                style={{
                                    gridTemplateColumns:
                                        'repeat(7, minmax(0, 1fr))',
                                }}
                            >
                                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        aria-label={`경매 기간 ${day}일`}
                                        aria-pressed={duration === day}
                                        className={durationButtonClass(
                                            duration === day,
                                        )}
                                        onClick={() => setDuration(day)}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between text-xs font-semibold text-content-muted">
                                <span>24시간</span>
                                <span>168시간</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-xl border border-content-line bg-content-soft p-4">
                            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-content-surface text-control-action-hover shadow-sm">
                                <TbCalendarEvent aria-hidden />
                            </span>
                            <div className="min-w-0">
                                <span className="text-xs font-bold text-content-muted">
                                    정확한 종료 시각
                                </span>
                                <strong className="mt-1 block break-words text-lg font-bold tabular-nums text-content-fg">
                                    {END_AT[duration]}
                                </strong>
                                <small className="mt-1 block text-xs text-content-muted">
                                    YYYY-MM-DD HH:mm:ss
                                </small>
                            </div>
                        </div>
                    </>
                ) : (
                    <FixedPriceGuidance />
                )}
            </div>
        </section>
    )
}

function FixedPriceGuidance() {
    return (
        <div className="grid gap-4" data-direction-region="fixed-guidance">
            <div className="flex gap-3 rounded-xl bg-content-soft p-4">
                <TbInfoCircle
                    aria-hidden
                    className="shrink-0 text-control-action-hover"
                />
                <p className="text-sm leading-6 text-content-muted">
                    <strong className="block text-content-fg">
                        판매 기한은 서버가 자동 설정합니다.
                    </strong>
                    기본 7일이며 등록 결과에서 정확한 종료 시각을 확인할 수
                    있습니다.
                </p>
            </div>
            <div className="rounded-xl border border-content-line p-4">
                <span className="text-xs font-bold text-content-muted">
                    고정가 판매 흐름
                </span>
                <ol className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                        '등록 즉시 마켓 노출',
                        '구매 시 바로 거래 확정',
                        '미판매 시 보관함 반환',
                    ].map((label, index) => (
                        <li
                            key={label}
                            className="flex items-start gap-2 text-xs font-semibold leading-5 text-content-fg"
                        >
                            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-content-soft text-control-action-hover">
                                {index + 1}
                            </span>
                            {label}
                        </li>
                    ))}
                </ol>
            </div>
            <div className="grid gap-3 rounded-xl bg-content-soft p-4 sm:grid-cols-2">
                <div>
                    <span className="text-xs font-bold text-content-muted">
                        구매자에게 표시
                    </span>
                    <strong className="mt-1 block text-sm text-content-fg">
                        240,000 코드 · 즉시 구매
                    </strong>
                </div>
                <div>
                    <span className="text-xs font-bold text-content-muted">
                        판매 중 변경
                    </span>
                    <strong className="mt-1 block text-sm text-content-fg">
                        가격 변경 없이 취소 후 재등록
                    </strong>
                </div>
            </div>
        </div>
    )
}

function Summary({
    saleType,
    duration,
    horizontal = false,
}: {
    saleType: 'auction' | 'fixed'
    duration: number
    horizontal?: boolean
}) {
    const desktop = useDesktopLayout()
    const price = saleType === 'auction' ? 120000 : 240000
    const fee = saleType === 'auction' ? 6000 : 12000
    const horizontalStyle =
        horizontal && desktop
            ? { gridTemplateColumns: 'minmax(220px, .7fr) minmax(0, 1.3fr)' }
            : undefined
    return (
        <section
            className={`min-w-0 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm ${horizontal ? 'grid' : ''}`}
            style={horizontalStyle}
            data-direction-region="summary"
            aria-label="판매 등록"
        >
            <div className="border-b border-content-line p-5 px-6">
                <span className="text-xs font-bold text-control-action-hover">
                    FINAL REVIEW
                </span>
                <h3 className="mt-1 text-lg font-bold text-content-fg">
                    판매 등록 준비가 끝났어요
                </h3>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                    가격과 예상 수령액을 확인한 뒤 등록하세요.
                </p>
            </div>
            <div className="grid gap-4 p-5 px-6">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-content-soft p-4">
                        <span className="text-xs font-bold text-content-muted">
                            등록 가격
                        </span>
                        <CodeAmount
                            value={price}
                            mode="full"
                            className="mt-2 tabular-nums"
                        />
                    </div>
                    <div className="rounded-xl bg-content-soft p-4">
                        <span className="text-xs font-bold text-content-muted">
                            수수료 차감 후
                        </span>
                        <CodeAmount
                            value={price - fee}
                            mode="full"
                            className="mt-2 tabular-nums"
                        />
                    </div>
                </div>
                <dl className="grid gap-2 text-xs">
                    <ItemDetail
                        label="판매 방식"
                        value={
                            saleType === 'auction'
                                ? '경매 · 등록 즉시 시작'
                                : '고정가 · 즉시 구매'
                        }
                    />
                    <ItemDetail
                        label="예상 수수료"
                        value={`${fee.toLocaleString('ko-KR')} 코드`}
                    />
                    {saleType === 'auction' && (
                        <ItemDetail
                            label="종료 시각"
                            value={END_AT[duration]}
                        />
                    )}
                </dl>
                <PrimarySaleButton saleType={saleType} />
                <p className="text-center text-xs leading-5 text-content-muted">
                    등록 전 아이템과 판매 조건을 한 번 더 확인해 주세요.
                </p>
            </div>
        </section>
    )
}

function durationButtonClass(active: boolean) {
    if (active)
        return 'min-h-11 rounded-lg border border-control-action bg-control-action text-sm font-bold text-control-action-ink shadow-sm'
    return 'min-h-11 rounded-lg border border-content-line bg-content-surface text-sm font-bold text-content-fg hover:border-control-action hover:bg-content-soft'
}

function PrimarySaleButton({ saleType }: { saleType: 'auction' | 'fixed' }) {
    return (
        <button
            className="min-h-11 w-full rounded-xl bg-control-action px-5 py-3 text-sm font-bold text-control-action-ink shadow-sm hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
            type="button"
        >
            {saleType === 'auction' ? '경매 판매 등록' : '고정가 판매 등록'}
        </button>
    )
}

function StepRail() {
    return (
        <nav
            className="flex gap-2 sm:grid"
            aria-label="등록 단계"
            data-direction-region="steps"
        >
            {['아이템', '조건', '검토'].map((label, index) => (
                <span
                    key={label}
                    className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold ${index === 1 ? 'bg-control-action text-control-action-ink' : 'bg-content-soft text-content-muted'}`}
                >
                    <span>
                        {index === 0 ? <TbCheck aria-hidden /> : index + 1}
                    </span>
                    {label}
                </span>
            ))}
        </nav>
    )
}
function Tab({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: string
}) {
    return (
        <button
            className={`min-h-11 flex-1 border-b-2 px-5 text-sm font-bold ${active ? 'border-control-action text-control-action-hover' : 'border-transparent text-content-muted hover:text-content-fg'}`}
            role="tab"
            aria-selected={active}
            onClick={onClick}
        >
            {children}
        </button>
    )
}
function ItemDetail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid min-w-0 grid-cols-[minmax(5.5rem,.7fr)_minmax(0,1.3fr)] gap-3">
            <dt className="text-content-muted">{label}</dt>
            <dd className="min-w-0 break-words font-semibold text-content-fg">
                {value}
            </dd>
        </div>
    )
}
