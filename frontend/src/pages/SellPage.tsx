import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { TbAlertTriangle, TbArchiveOff, TbLock, TbTag } from 'react-icons/tb'
import { auctionDetailPath, marketDetailPath, paths } from '@/app/paths'
import ItemFrame from '@/features/item/components/ItemFrame'
import SellFeeEstimate from '@/features/auction/components/SellFeeEstimate'
import SellConfirmDialog from '@/features/auction/components/SellConfirmDialog'
import ShopSellConfirmDialog from '@/features/shop/components/ShopSellConfirmDialog'
import { itemArt } from '@/features/item/lib/itemArt'
import { decodeTypeCode, itemTypeLabel } from '@/features/item/lib/itemCode'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { parseAmount, validateSellForm } from '@/features/auction/lib/sellForm'
import { useMyInventory } from '@/lib/queries/inventory'
import { useCreateAuction } from '@/lib/queries/auctions'
import { useCreateShop } from '@/lib/queries/shop'
import type { InventoryItem } from '@/lib/api/inventory'
import type { CreateAuctionRequest } from '@/lib/api/auctions'
import type {
    SellField,
    SellValidationError,
} from '@/features/auction/lib/sellForm'
import { useAppFooterVariant } from '@/components/layout/AppFooterContext'

/**
 * 판매/경매 등록 `/sell` (FC-073 — 목업 `auctionSell`(`.sell-grid`) · design-brief B-12).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **경매 축 마지막 화면. 실 API 연동(데모 데이터 없음).**
 * ══════════════════════════════════════════════════════════════════════════════
 *  - **FC-177 선점 모드**: 아이템은 인벤토리에서 고른 것을 `?item=<itemInstancePublicId>` URL
 *    쿼리로 받아 **선점**한다(리로드 생존·마켓 관례). 전체 아이템 picker 그리드는 제거됐다 —
 *    선점된 아이템만 **잠금 카드**로 상단 고정하고, 바꾸려면 인벤토리로 되돌아간다.
 *  - `?item` 없거나 무효(인벤토리에 없음)면 **빈 상태**("인벤토리에서 선택")로 유도한다.
 *  - 클라 검증(`validateSellForm`)은 선행 안내일 뿐 — 최종은 서버(`AUCTION_003`·`AUCTION_008`).
 *  - "경매 등록하기" → 검증 통과 시 **확인 다이얼로그**(BidDialog 배선 이식) → `POST /auctions`.
 *  - 수수료는 **예상**만(fee-policy-spec, 정산 시 서버 확정) — `SellFeeEstimate` 가 명시한다.
 *  - 성공 시 상세로 이동.
 * ★ 색은 브랜드 팔레트(§2.9) — 목업 Vuexy 잔재색 미사용. 금액은 `CodeAmount`(`G` 단위 텍스트 금지).
 * ★ 미구현(즉시구매 판매 방식)은 **DOM 비활성 자리**로만(§5) — 클릭해도 404 없음.
 */

/** 소프트클로즈 선택지(목업 옵션 + "사용 안 함"). 값은 초 단위 또는 null. */
const SOFT_CLOSE_WINDOW_OPTIONS: readonly { label: string; value: number }[] = [
    { label: '마감 60초 전', value: 60 },
    { label: '마감 120초 전', value: 120 },
]
const SOFT_CLOSE_EXTEND_OPTIONS: readonly { label: string; value: number }[] = [
    { label: '120초', value: 120 },
    { label: '300초', value: 300 },
]

/** 검증 필드 → 입력 요소 id(초점 되돌림용). */
const FIELD_INPUT_ID: Record<SellField, string> = {
    item: 'sellItemGroup',
    startPrice: 'sellStartPrice',
    buyNowPrice: 'sellBuyNowPrice',
    startAt: 'sellStartAt',
    endAt: 'sellEndAt',
    maxEndAt: 'sellMaxEndAt',
}

/** 판매 방식(목업 §sell "판매 방식" select — 경매 / 고정가). */
type SellMethod = 'auction' | 'shop'

export default function SellPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const inventoryQuery = useMyInventory()
    const createMutation = useCreateAuction()
    const createShopMutation = useCreateShop()

    const [sellMethod, setSellMethod] = useState<SellMethod>('auction')

    const [startPrice, setStartPrice] = useState('')
    const [buyNowPrice, setBuyNowPrice] = useState('')
    const [startAt, setStartAt] = useState('')
    const [endAt, setEndAt] = useState('')
    const [maxEndAt, setMaxEndAt] = useState('')
    const [softCloseWindowSec, setSoftCloseWindowSec] = useState<number | null>(
        null,
    )
    const [softCloseExtendSec, setSoftCloseExtendSec] = useState<number | null>(
        null,
    )

    /** 고정가 판매가(입력 문자열). 서버는 기한을 자동 계산하므로 판매자 입력은 가격 하나뿐(§3.1). */
    const [shopPrice, setShopPrice] = useState('')
    const [shopPriceError, setShopPriceError] = useState<string | null>(null)

    const [errors, setErrors] = useState<SellValidationError[]>([])
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [shopConfirmOpen, setShopConfirmOpen] = useState(false)
    const [pendingRequest, setPendingRequest] =
        useState<CreateAuctionRequest | null>(null)
    const [pendingShopPrice, setPendingShopPrice] = useState<number | null>(null)

    const items = useMemo(
        () => inventoryQuery.data?.items ?? [],
        [inventoryQuery.data],
    )

    // ── 선점(FC-177) — `?item` 이 가리키는 인벤토리 아이템만 판매 대상으로 잠근다. ──────────
    const itemParam = searchParams.get('item')
    const preemptedItem = useMemo(
        () =>
            itemParam
                ? (items.find(
                      (item) => item.itemInstancePublicId === itemParam,
                  ) ?? null)
                : null,
        [items, itemParam],
    )
    useAppFooterVariant(
        !inventoryQuery.isPending &&
            (inventoryQuery.isError ||
                (inventoryQuery.isSuccess && preemptedItem === null))
            ? 'compact'
            : 'default',
    )
    const selectedId = preemptedItem?.itemInstancePublicId ?? null

    const parsedStartPrice = parseAmount(startPrice) ?? 0
    const parsedBuyNowPrice = pendingRequest?.buyNowPrice ?? null
    const parsedShopPrice = parseAmount(shopPrice) ?? 0

    const errorFor = (field: SellField): string | undefined =>
        errors.find((error) => error.field === field)?.message

    const selectedName = preemptedItem?.summary.displayName ?? ''

    const handleOpenConfirm = () => {
        const result = validateSellForm({
            itemInstancePublicId: selectedId,
            startPrice,
            buyNowPrice,
            startAt,
            endAt,
            softCloseWindowSec,
            softCloseExtendSec,
            maxEndAt,
        })

        if (!result.ok) {
            setErrors(result.errors)
            const first = result.errors[0]
            if (first) {
                document.getElementById(FIELD_INPUT_ID[first.field])?.focus()
            }
            return
        }

        setErrors([])
        setPendingRequest(result.request)
        createMutation.reset()
        setConfirmOpen(true)
    }

    const handleConfirm = () => {
        if (!pendingRequest) return
        createMutation.mutate(pendingRequest, {
            onSuccess: (response) => {
                setConfirmOpen(false)
                navigate(auctionDetailPath(response.auctionPublicId))
            },
        })
    }

    /** 고정가 등록 — 아이템 + 가격(>0)만 검증한다(기한은 서버 자동, §3.1). */
    const handleOpenShopConfirm = () => {
        if (!selectedId) {
            setErrors([{ field: 'item', message: '출품할 아이템을 선택해 주세요.' }])
            document.getElementById(FIELD_INPUT_ID.item)?.focus()
            return
        }
        const price = parseAmount(shopPrice)
        if (price === null) {
            setShopPriceError('판매가를 올바른 금액으로 입력해 주세요.')
            document.getElementById('sellShopPrice')?.focus()
            return
        }
        setErrors([])
        setShopPriceError(null)
        setPendingShopPrice(price)
        createShopMutation.reset()
        setShopConfirmOpen(true)
    }

    const handleShopConfirm = () => {
        if (!selectedId || pendingShopPrice === null) return
        createShopMutation.mutate(
            { itemInstancePublicId: selectedId, price: pendingShopPrice },
            {
                onSuccess: (response) => {
                    setShopConfirmOpen(false)
                    // 등록한 상품 상세로 이동(경매 등록 → 경매 상세와 대칭).
                    navigate(marketDetailPath(response.shopPublicId))
                },
            },
        )
    }

    /** 방식 전환 — 상대 방식의 검증 오류를 걷어낸다(아이템 선택은 공유라 유지). */
    const switchMethod = (method: SellMethod) => {
        setSellMethod(method)
        setErrors((current) =>
            current.filter((error) => error.field === 'item'),
        )
        setShopPriceError(null)
    }

    return (
        <div className="flex flex-col gap-5">
            <header>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <TbTag aria-hidden className="size-6 text-navy" />
                    아이템 판매
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    {sellMethod === 'auction'
                        ? '인벤토리 아이템의 가격과 경매 시간을 설정하세요.'
                        : '인벤토리 아이템을 고정가로 등록해 바로 판매하세요.'}
                </p>
            </header>

            {inventoryQuery.isPending && <SellSkeleton />}

            {inventoryQuery.isError && (
                <StateBlock
                    icon={TbAlertTriangle}
                    title="인벤토리를 불러오지 못했습니다"
                    description="잠시 후 다시 시도해 주세요."
                    action={
                        <button
                            type="button"
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            onClick={() => void inventoryQuery.refetch()}
                        >
                            다시 시도
                        </button>
                    }
                />
            )}

            {inventoryQuery.isSuccess && items.length === 0 && (
                <StateBlock
                    icon={TbArchiveOff}
                    title="출품할 아이템이 없습니다"
                    description="인벤토리에 아이템이 있어야 경매를 등록할 수 있습니다."
                    action={
                        <Link
                            to={paths.inventory}
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        >
                            인벤토리로 가기
                        </Link>
                    }
                />
            )}

            {/* 선점 실패(FC-177) — 아이템이 있는데 `?item` 이 없거나 인벤토리에 없는 경우 */}
            {inventoryQuery.isSuccess && items.length > 0 && !preemptedItem && (
                <StateBlock
                    icon={TbTag}
                    title="판매할 아이템을 선택하세요"
                    description="인벤토리에서 판매할 아이템을 눌러 상세에서 '판매하기'를 선택하세요."
                    action={
                        <Link
                            to={paths.inventory}
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        >
                            인벤토리로 가기
                        </Link>
                    }
                />
            )}

            {inventoryQuery.isSuccess && preemptedItem && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    {/* 좌: 폼 */}
                    <section className="rounded-2xl border border-line bg-surface p-5 lg:p-6">
                        {/* 1. 판매할 아이템 — 인벤토리에서 선점한 아이템만 잠금 카드로 고정(FC-177) */}
                        <h2 className="text-base font-bold text-gray-900">
                            1. 판매할 아이템
                        </h2>
                        <PreemptedItemCard item={preemptedItem} />

                        {/* 2. 판매 방식 — 목업 §sell "판매 방식"(경매/고정가) */}
                        <h2 className="mt-6 text-base font-bold text-gray-900">
                            2. 판매 방식
                        </h2>
                        <div
                            role="radiogroup"
                            aria-label="판매 방식"
                            className="mt-3 grid grid-cols-2 gap-2.5"
                        >
                            <MethodOption
                                label="경매"
                                description="입찰 경쟁으로 최고가에 판매"
                                checked={sellMethod === 'auction'}
                                onSelect={() => switchMethod('auction')}
                            />
                            <MethodOption
                                label="고정가"
                                description="정한 가격에 바로 판매"
                                checked={sellMethod === 'shop'}
                                onSelect={() => switchMethod('shop')}
                            />
                        </div>

                        {sellMethod === 'auction' ? (
                            <>
                                {/* 3. 가격 설정 */}
                                <h2 className="mt-6 text-base font-bold text-gray-900">
                                    3. 가격 설정
                                </h2>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <NumberField
                                        id="sellStartPrice"
                                        label="시작가"
                                        value={startPrice}
                                        error={errorFor('startPrice')}
                                        placeholder="예: 2,500,000"
                                        onChange={setStartPrice}
                                    />
                                    <NumberField
                                        optional
                                        id="sellBuyNowPrice"
                                        label="즉시구매 참고가"
                                        value={buyNowPrice}
                                        error={errorFor('buyNowPrice')}
                                        placeholder="시작가보다 높게"
                                        onChange={setBuyNowPrice}
                                    />
                                </div>

                                {/* 4. 경매 시간 */}
                                <h2 className="mt-6 text-base font-bold text-gray-900">
                                    4. 경매 시간
                                </h2>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <DateTimeField
                                        optional
                                        id="sellStartAt"
                                        label="시작 시각"
                                        value={startAt}
                                        error={errorFor('startAt')}
                                        onChange={setStartAt}
                                    />
                                    <DateTimeField
                                        id="sellEndAt"
                                        label="마감 시각"
                                        value={endAt}
                                        error={errorFor('endAt')}
                                        onChange={setEndAt}
                                    />
                                    <SelectField
                                        id="sellSoftWindow"
                                        label="마감 임박 연장 기준"
                                        options={SOFT_CLOSE_WINDOW_OPTIONS}
                                        value={softCloseWindowSec}
                                        onChange={setSoftCloseWindowSec}
                                    />
                                    <SelectField
                                        id="sellSoftExtend"
                                        label="1회 연장 시간"
                                        options={SOFT_CLOSE_EXTEND_OPTIONS}
                                        value={softCloseExtendSec}
                                        onChange={setSoftCloseExtendSec}
                                    />
                                    <DateTimeField
                                        id="sellMaxEndAt"
                                        label="최대 연장 시각"
                                        value={maxEndAt}
                                        error={errorFor('maxEndAt')}
                                        onChange={setMaxEndAt}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 3. 판매 가격 — 고정가는 가격 하나(기한은 서버 자동, §3.1) */}
                                <h2 className="mt-6 text-base font-bold text-gray-900">
                                    3. 판매 가격
                                </h2>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <NumberField
                                        id="sellShopPrice"
                                        label="판매가"
                                        value={shopPrice}
                                        error={shopPriceError ?? undefined}
                                        placeholder="예: 2,480,000"
                                        onChange={(value) => {
                                            setShopPrice(value)
                                            if (shopPriceError) {
                                                setShopPriceError(null)
                                            }
                                        }}
                                    />
                                </div>
                                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                                    판매 기한은 서버가 자동으로 정합니다. 판매되기
                                    전에는 언제든 취소할 수 있어요.
                                </p>
                            </>
                        )}
                    </section>

                    {/* 우: 등록 전 확인 aside */}
                    <aside>
                        <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5">
                            <h2 className="text-base font-bold text-gray-900">
                                등록 전 확인
                            </h2>
                            <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-xs leading-relaxed text-gray-500">
                                {sellMethod === 'auction' ? (
                                    <>
                                        <li>
                                            입찰이 시작되면 가격을 변경할 수
                                            없습니다.
                                        </li>
                                        <li>
                                            입찰이 없을 때만 취소할 수 있습니다.
                                        </li>
                                        <li>
                                            마감 직전 입찰 시 종료 시각이 연장될
                                            수 있습니다.
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li>등록 즉시 고정가로 노출됩니다.</li>
                                        <li>
                                            판매되기 전에는 언제든 취소할 수
                                            있습니다.
                                        </li>
                                        <li>
                                            기한이 지나면 임시 보관함으로
                                            돌아갑니다.
                                        </li>
                                    </>
                                )}
                            </ul>

                            <SellFeeEstimate
                                startPrice={
                                    sellMethod === 'auction'
                                        ? parsedStartPrice
                                        : parsedShopPrice
                                }
                            />

                            {(sellMethod === 'auction'
                                ? errors.length > 0
                                : shopPriceError !== null ||
                                  errors.some(
                                      (error) => error.field === 'item',
                                  )) && (
                                <p
                                    role="alert"
                                    className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger"
                                >
                                    입력을 다시 확인해 주세요.
                                </p>
                            )}

                            <button
                                type="button"
                                className="mt-4 w-full rounded-lg bg-orange px-5 py-3 text-sm font-bold text-white hover:bg-orange-deep"
                                onClick={
                                    sellMethod === 'auction'
                                        ? handleOpenConfirm
                                        : handleOpenShopConfirm
                                }
                            >
                                {sellMethod === 'auction'
                                    ? '경매 등록하기'
                                    : '고정가 등록하기'}
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            <SellConfirmDialog
                open={confirmOpen}
                itemName={selectedName}
                startPrice={parsedStartPrice}
                buyNowPrice={parsedBuyNowPrice}
                endAtLabel={formatLocalLabel(endAt)}
                maxEndAtLabel={formatLocalLabel(maxEndAt)}
                isSubmitting={createMutation.isPending}
                submitError={createMutation.error}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
            />

            <ShopSellConfirmDialog
                open={shopConfirmOpen}
                itemName={selectedName}
                price={pendingShopPrice ?? parsedShopPrice}
                isSubmitting={createShopMutation.isPending}
                submitError={createShopMutation.error}
                onClose={() => setShopConfirmOpen(false)}
                onConfirm={handleShopConfirm}
            />
        </div>
    )
}

/** 판매 방식 선택 타일(라디오) — 선택은 DOM 속성(`aria-checked`)으로 전달(WCAG 4.1.2). */
function MethodOption({
    label,
    description,
    checked,
    onSelect,
}: {
    label: string
    description: string
    checked: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            className={`flex flex-col items-start gap-0.5 rounded-xl border p-3.5 text-left transition-colors ${
                checked
                    ? 'border-orange bg-orange-subtle ring-1 ring-orange'
                    : 'border-line bg-surface hover:border-navy/40'
            }`}
            onClick={onSelect}
        >
            <span className="text-sm font-bold text-gray-900">{label}</span>
            <span className="text-xs text-gray-500">{description}</span>
        </button>
    )
}

/**
 * 선점 아이템 잠금 카드 (FC-177 — 목업 `.picked`).
 *
 * ★ 인벤토리에서 선택해 넘어온 아이템만 노출한다(전체 picker 그리드 대체). 여기서 바꿀 수 없고,
 *   "인벤토리에서 다시 선택"으로 인벤토리에 돌아가 다른 아이템을 고른다(선점 = URL 쿼리 정본).
 */
function PreemptedItemCard({ item }: { item: InventoryItem }) {
    const axes = decodeTypeCode(item.summary.typeCode)
    const art = itemArt(
        {
            subGroup: axes.subGroup,
            kind: axes.kind,
            element: axes.element,
            level: item.summary.level,
        },
        'l',
        1,
    )
    const hasSkill =
        item.summary.skill1Code !== null || item.summary.skill2Code !== null

    return (
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-orange bg-orange-subtle p-3">
            <span
                className="item-sprite-stage flex h-[134px] w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={
                    art?.src
                        ? ({
                              '--item-sprite': `url("${art.src}")`,
                          } as CSSProperties)
                        : undefined
                }
            >
                <ItemFrame
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.summary.displayName}
                    visual={{ goldforceExpireAt: item.summary.goldforceExpireAt }}
                    hasSkill={hasSkill}
                    size="frame"
                />
            </span>
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-gray-900">
                    {item.summary.displayName}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold text-navy">
                        {elementBadgeLabelOf(axes.element)}
                    </span>
                    <span className="rounded-md bg-navy px-2 py-1 text-[11px] font-bold text-white">
                        {itemTypeLabel(axes.subGroup, axes.kind)} · Lv.
                        {item.summary.level}
                    </span>
                </div>
                <Link
                    to={paths.inventory}
                    className="mt-2 inline-block text-xs font-bold text-orange-deep underline underline-offset-2 hover:text-orange"
                >
                    인벤토리에서 다시 선택
                </Link>
            </div>
            <span className="ml-auto hidden shrink-0 items-center gap-1 self-start rounded-full border border-orange bg-surface px-2.5 py-1 text-[11px] font-bold text-orange-deep sm:inline-flex">
                <TbLock aria-hidden className="size-3" />
                선점됨
            </span>
        </div>
    )
}

/** 금액 입력(정수). `inputMode=numeric`, `noValidate` 폼이 아니므로 브라우저 검증 비의존. */
function NumberField({
    id,
    label,
    value,
    onChange,
    error,
    optional,
    placeholder,
}: {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    error?: string
    optional?: boolean
    placeholder?: string
}) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-semibold text-gray-700">
                {label}
                {optional && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                        (선택)
                    </span>
                )}
            </label>
            <input
                id={id}
                inputMode="numeric"
                autoComplete="off"
                placeholder={placeholder}
                className={`mt-1.5 w-full rounded-lg border bg-surface px-3 py-2.5 text-sm font-semibold tabular-nums text-gray-900 focus:outline-none focus:ring-2 ${
                    error
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-line focus:border-orange focus:ring-orange/30'
                }`}
                aria-invalid={error !== undefined || undefined}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            <FieldError message={error} />
        </div>
    )
}

/** 시각 입력(datetime-local). 값은 로컬 문자열 — 전송 시 sellForm 이 UTC ISO 로 변환. */
function DateTimeField({
    id,
    label,
    value,
    onChange,
    error,
    optional,
}: {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    error?: string
    optional?: boolean
}) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-semibold text-gray-700">
                {label}
                {optional && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                        (선택)
                    </span>
                )}
            </label>
            <input
                id={id}
                type="datetime-local"
                className={`mt-1.5 w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                    error
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-line focus:border-orange focus:ring-orange/30'
                }`}
                aria-invalid={error !== undefined || undefined}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            <FieldError message={error} />
        </div>
    )
}

/** 소프트클로즈 선택(초|null). "사용 안 함" 이 기본. */
function SelectField({
    id,
    label,
    options,
    value,
    onChange,
}: {
    id: string
    label: string
    options: readonly { label: string; value: number }[]
    value: number | null
    onChange: (value: number | null) => void
}) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-semibold text-gray-700">
                {label}
            </label>
            <select
                id={id}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-gray-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30"
                value={value === null ? '' : String(value)}
                onChange={(event) =>
                    onChange(
                        event.target.value === ''
                            ? null
                            : Number(event.target.value),
                    )
                }
            >
                <option value="">사용 안 함</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return (
        <p role="alert" className="mt-1.5 text-xs text-danger">
            {message}
        </p>
    )
}

/** 로컬 datetime-local 값을 사람이 읽는 라벨로(확인 다이얼로그 표시용). */
function formatLocalLabel(local: string): string {
    if (!local) return ''
    const ms = new Date(local).getTime()
    if (!Number.isFinite(ms)) return local
    return new Date(ms).toLocaleString('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

function SellSkeleton() {
    return (
        <div
            aria-hidden
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
            <div className="h-[520px] animate-pulse rounded-2xl bg-gray-100" />
            <div className="h-80 animate-pulse rounded-2xl bg-gray-100" />
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
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Icon aria-hidden className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
