import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { TbAlertTriangle, TbArchiveOff, TbTag } from 'react-icons/tb'
import { auctionDetailPath, marketDetailPath, paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import { codeTierClass } from '@/components/common/codeTier'
import CardInfoContent from '@/features/item/components/CardInfoContent'
import '@/features/item/components/CardInfoDialog.css'
import SellConfirmDialog from '@/features/auction/components/SellConfirmDialog'
import ShopSellConfirmDialog from '@/features/shop/components/ShopSellConfirmDialog'
import { decodeTypeCode } from '@/features/item/lib/itemCode'
import { parseAmount, validateSellForm } from '@/features/auction/lib/sellForm'
import { computeSellerFee } from '@/features/auction/lib/sellerFee'
import { useMyInventory } from '@/lib/queries/inventory'
import { useCreateAuction } from '@/lib/queries/auctions'
import { useCreateShop } from '@/lib/queries/shop'
import type { CreateAuctionRequest } from '@/lib/api/auctions'
import type {
    SellField,
    SellValidationError,
} from '@/features/auction/lib/sellForm'

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
    const [buyNowEnabled, setBuyNowEnabled] = useState(false)
    const [durationDays, setDurationDays] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(
        3,
    )
    /** 고정가 판매가(입력 문자열). 서버는 기한을 자동 계산하므로 판매자 입력은 가격 하나뿐(§3.1). */
    const [shopPrice, setShopPrice] = useState('')
    const [shopPriceError, setShopPriceError] = useState<string | null>(null)

    const [errors, setErrors] = useState<SellValidationError[]>([])
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [shopConfirmOpen, setShopConfirmOpen] = useState(false)
    const [pendingRequest, setPendingRequest] =
        useState<CreateAuctionRequest | null>(null)
    const [pendingShopPrice, setPendingShopPrice] = useState<number | null>(
        null,
    )
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
    const selectedId = preemptedItem?.itemInstancePublicId ?? null

    const liveStartPrice = parseAmount(startPrice)
    const parsedLiveBuyNowPrice = buyNowEnabled
        ? parseAmount(buyNowPrice)
        : null
    const liveBuyNowPrice =
        parsedLiveBuyNowPrice !== null &&
        liveStartPrice !== null &&
        parsedLiveBuyNowPrice > liveStartPrice
            ? parsedLiveBuyNowPrice
            : null
    const liveShopPrice = parseAmount(shopPrice)
    const parsedStartPrice = liveStartPrice ?? 0
    const parsedBuyNowPrice = pendingRequest?.buyNowPrice ?? null
    const parsedShopPrice = parseAmount(shopPrice) ?? 0
    const errorFor = (field: SellField): string | undefined =>
        errors.find((error) => error.field === field)?.message

    const selectedName = preemptedItem?.summary.displayName ?? ''

    const handleOpenConfirm = () => {
        const capturedNow = Math.floor(Date.now() / 1000) * 1000
        const end = new Date(capturedNow + durationDays * 24 * 60 * 60 * 1000)
        const localEnd = toLocalDateTimeValue(end)
        const result = validateSellForm(
            {
                itemInstancePublicId: selectedId,
                startPrice,
                buyNowPrice: buyNowEnabled ? buyNowPrice : '',
                startAt: '',
                endAt: localEnd,
                softCloseWindowSec: null,
                softCloseExtendSec: null,
                maxEndAt: localEnd,
            },
            capturedNow,
        )

        if (buyNowEnabled && buyNowPrice.trim() === '') {
            const buyNowError: SellValidationError = {
                field: 'buyNowPrice',
                message: '즉시구매가를 입력해 주세요.',
            }
            setErrors([buyNowError, ...(result.ok ? [] : result.errors)])
            document.getElementById(FIELD_INPUT_ID.buyNowPrice)?.focus()
            return
        }

        if (!result.ok) {
            const visibleErrors = result.errors.map((error) =>
                error.field === 'buyNowPrice'
                    ? {
                          ...error,
                          message: error.message.replace(
                              '즉시구매 참고가',
                              '즉시구매가',
                          ),
                      }
                    : error,
            )
            setErrors(visibleErrors)
            const first = visibleErrors[0]
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
            setErrors([
                { field: 'item', message: '출품할 아이템을 선택해 주세요.' },
            ])
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

    const selectMethod = (method: SellMethod, target: HTMLButtonElement) => {
        switchMethod(method)
        target.focus()
    }

    return (
        <div className="flex flex-col gap-5">
            <header>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-content-fg">
                    <TbTag
                        aria-hidden
                        className="size-6 text-brand-structure"
                    />
                    아이템 판매
                </h1>
                <p className="mt-1 text-sm text-content-subtle">
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
                            className="rounded-lg bg-control-action px-4 py-2 text-sm font-bold text-control-action-ink hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
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
                            className="rounded-lg bg-control-action px-4 py-2 text-sm font-bold text-control-action-ink hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
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
                            className="rounded-lg bg-control-action px-4 py-2 text-sm font-bold text-control-action-ink hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
                        >
                            인벤토리로 가기
                        </Link>
                    }
                />
            )}

            {inventoryQuery.isSuccess && preemptedItem && (
                <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,65fr)_minmax(280px,35fr)] lg:items-stretch">
                    {/* 좌: 폼 */}
                    <section className="order-2 min-w-0 rounded-2xl border border-content-line bg-content-surface p-5 lg:order-1 lg:p-6">
                        <h2 className="text-base font-bold text-content-fg">
                            판매 조건 설정
                        </h2>
                        <div
                            role="radiogroup"
                            aria-label="판매 방식"
                            className="mt-3 grid grid-cols-2 gap-2.5"
                        >
                            <MethodOption
                                id="sell-method-auction"
                                label="경매"
                                description="입찰 경쟁으로 최고가에 판매"
                                method="auction"
                                checked={sellMethod === 'auction'}
                                onSelect={selectMethod}
                            />
                            <MethodOption
                                id="sell-method-shop"
                                label="고정가"
                                description="정한 가격에 바로 판매"
                                method="shop"
                                checked={sellMethod === 'shop'}
                                onSelect={selectMethod}
                            />
                        </div>

                        {sellMethod === 'auction' ? (
                            <>
                                <h2 className="mt-6 text-lg font-bold text-content-fg">
                                    가격 설정
                                </h2>
                                <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-4">
                                    <NumberField
                                        primary
                                        id="sellStartPrice"
                                        label="시작가"
                                        value={startPrice}
                                        error={errorFor('startPrice')}
                                        placeholder="예: 2,500,000"
                                        onChange={setStartPrice}
                                    />
                                    <NumberField
                                        primary
                                        id="sellBuyNowPrice"
                                        label="즉시구매가 입력"
                                        displayLabel="즉시구매가"
                                        value={buyNowPrice}
                                        error={errorFor('buyNowPrice')}
                                        placeholder="금액 입력"
                                        disabled={!buyNowEnabled}
                                        activationControl={
                                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-content-muted">
                                                <input
                                                    type="checkbox"
                                                    aria-label="즉시구매가 사용"
                                                    checked={buyNowEnabled}
                                                    className="size-4 shrink-0 accent-control-action focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
                                                    onChange={(event) => {
                                                        const enabled =
                                                            event.target.checked
                                                        setBuyNowEnabled(
                                                            enabled,
                                                        )
                                                        if (!enabled) {
                                                            setErrors(
                                                                (current) =>
                                                                    current.filter(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.field !==
                                                                            'buyNowPrice',
                                                                    ),
                                                            )
                                                        }
                                                    }}
                                                />
                                                사용
                                            </label>
                                        }
                                        onChange={setBuyNowPrice}
                                    />
                                </div>

                                <h2 className="mt-6 text-base font-bold text-content-fg">
                                    경매 시간
                                </h2>
                                <div className="mt-3 grid min-w-0 gap-3">
                                    <p className="text-sm text-content-muted">
                                        <strong className="text-content-fg">
                                            즉시 시작
                                        </strong>
                                        {' · '}등록이 완료되는 즉시 경매가
                                        시작됩니다.
                                    </p>
                                    <div
                                        className="grid grid-cols-4 gap-2 sm:grid-cols-7"
                                        aria-label="경매 기간"
                                    >
                                        {([1, 2, 3, 4, 5, 6, 7] as const).map(
                                            (days) => (
                                                <button
                                                    key={days}
                                                    type="button"
                                                    aria-pressed={
                                                        durationDays === days
                                                    }
                                                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2 ${durationDays === days ? 'border-control-action bg-content-soft text-control-action-hover' : 'border-content-line text-content-fg hover:border-control-action'}`}
                                                    onClick={() =>
                                                        setDurationDays(days)
                                                    }
                                                >
                                                    {days}일{' '}
                                                    <span className="block text-xs font-normal text-content-muted">
                                                        {days * 24}시간
                                                    </span>
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 3. 판매 가격 — 고정가는 가격 하나(기한은 서버 자동, §3.1) */}
                                <h2 className="mt-6 text-lg font-bold text-content-fg">
                                    판매 가격
                                </h2>
                                <div className="mt-3 min-w-0">
                                    <NumberField
                                        primary
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
                                <ul className="mt-4 grid gap-1.5 text-xs leading-relaxed text-content-subtle">
                                    <li>등록 즉시 판매 목록에 노출됩니다.</li>
                                    <li>판매 기간은 서버가 정합니다.</li>
                                </ul>
                            </>
                        )}
                        <SellSettlementSummary
                            method={sellMethod}
                            primaryPrice={
                                sellMethod === 'auction'
                                    ? liveStartPrice
                                    : liveShopPrice
                            }
                            buyNowPrice={liveBuyNowPrice}
                        />
                        <div className="mt-6 border-t border-content-line pt-5">
                            {(sellMethod === 'auction'
                                ? errors.length > 0
                                : shopPriceError !== null ||
                                  errors.some(
                                      (error) => error.field === 'item',
                                  )) && (
                                <p
                                    role="alert"
                                    className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-ink"
                                >
                                    입력을 다시 확인해 주세요.
                                </p>
                            )}

                            <button
                                type="button"
                                className="mt-4 w-full rounded-lg bg-control-action px-5 py-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover lg:hidden"
                                onClick={
                                    sellMethod === 'auction'
                                        ? handleOpenConfirm
                                        : handleOpenShopConfirm
                                }
                            >
                                판매 등록
                            </button>
                        </div>
                    </section>

                    <aside
                        className="shop-cardinfo order-1 flex min-w-0 flex-col overflow-hidden shadow-sm lg:order-2"
                        style={{ maxWidth: 'none', maxHeight: 'none' }}
                        aria-labelledby="sellCardInfoTitle"
                    >
                        <div className="ci-title">
                            <h2 id="sellCardInfoTitle">
                                카드정보 <small>CARD INFO</small>
                            </h2>
                            <Link
                                to={paths.inventory}
                                className="ml-auto rounded-lg border border-content-line px-3 py-2 text-xs font-bold text-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus"
                            >
                                다시 선택
                            </Link>
                        </div>
                        <div className="ci-scroll min-h-0 flex-1">
                            <CardInfoContent
                                {...decodeTypeCode(
                                    preemptedItem.summary.typeCode,
                                )}
                                level={preemptedItem.summary.level}
                                goldforceExpireAt={
                                    preemptedItem.summary.goldforceExpireAt
                                }
                                name={preemptedItem.summary.displayName}
                                skill1={preemptedItem.summary.skill1Code}
                                skill2={preemptedItem.summary.skill2Code}
                                skillPercent={
                                    preemptedItem.summary.skillPercent
                                }
                                skill1Name={preemptedItem.summary.skill1Name}
                                skill2Name={preemptedItem.summary.skill2Name}
                            />
                        </div>
                        <div className="hidden border-t border-content-line bg-content-surface p-5 lg:block">
                            <button
                                type="button"
                                className="w-full rounded-lg bg-control-action px-5 py-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                                onClick={
                                    sellMethod === 'auction'
                                        ? handleOpenConfirm
                                        : handleOpenShopConfirm
                                }
                            >
                                판매 등록
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
                endAtLabel={formatKstDateTime(
                    pendingRequest
                        ? Date.parse(pendingRequest.endAt)
                        : Date.now(),
                )}
                maxEndAtLabel={formatKstDateTime(
                    pendingRequest
                        ? Date.parse(pendingRequest.maxEndAt)
                        : Date.now(),
                )}
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

interface SellSettlementSummaryProps {
    method: SellMethod
    primaryPrice: number | null
    buyNowPrice: number | null
}

function SellSettlementSummary({
    method,
    primaryPrice,
    buyNowPrice,
}: SellSettlementSummaryProps) {
    const primaryEstimate = primaryPrice ? computeSellerFee(primaryPrice) : null
    const buyNowEstimate = buyNowPrice ? computeSellerFee(buyNowPrice) : null

    return (
        <section
            aria-labelledby="sell-settlement-summary-title"
            className="mt-6 border-t border-content-line pt-5"
        >
            <h2
                id="sell-settlement-summary-title"
                className="text-sm font-bold text-content-fg"
            >
                예상 정산 요약
            </h2>
            {primaryEstimate ? (
                <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-content-muted">
                        {method === 'auction'
                            ? '시작가 기준 예상 수수료'
                            : '예상 수수료'}
                    </dt>
                    <dd className="text-right font-semibold text-content-fg">
                        <CodeAmount value={primaryEstimate.fee} mode="full" />
                    </dd>
                    <dt className="text-content-muted">
                        {method === 'auction'
                            ? '시작가 기준 예상 정산액'
                            : '예상 정산액'}
                    </dt>
                    <dd className="text-right font-semibold text-content-fg">
                        <CodeAmount
                            value={primaryEstimate.settle}
                            mode="full"
                        />
                    </dd>
                    {method === 'auction' && buyNowEstimate && (
                        <>
                            <dt className="text-content-muted">
                                즉시구매가 기준 예상 정산액
                            </dt>
                            <dd className="text-right font-semibold text-content-fg">
                                <CodeAmount
                                    value={buyNowEstimate.settle}
                                    mode="full"
                                />
                            </dd>
                        </>
                    )}
                </dl>
            ) : (
                <p className="mt-2 text-sm text-content-muted">
                    {method === 'auction'
                        ? '시작가를 입력하면 예상 정산액을 확인할 수 있습니다.'
                        : '판매가를 입력하면 예상 정산액을 확인할 수 있습니다.'}
                </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-content-subtle">
                {method === 'auction'
                    ? '실제 수수료와 정산액은 최종 낙찰가를 기준으로 서버에서 확정됩니다.'
                    : '실제 수수료와 정산액은 판매가를 기준으로 서버에서 확정됩니다. 판매되지 않으면 임시 보관함으로 자동 회수됩니다.'}
            </p>
        </section>
    )
}

/** 판매 방식 선택 타일(라디오) — 선택은 DOM 속성(`aria-checked`)으로 전달(WCAG 4.1.2). */
function MethodOption({
    id,
    label,
    description,
    method,
    checked,
    onSelect,
}: {
    id: string
    label: string
    description: string
    method: SellMethod
    checked: boolean
    onSelect: (method: SellMethod, target: HTMLButtonElement) => void
}) {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        let next: SellMethod | null = null
        const current: SellMethod = id.endsWith('auction') ? 'auction' : 'shop'
        if (event.key === 'Home') next = 'auction'
        if (event.key === 'End') next = 'shop'
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
            next = current === 'auction' ? 'shop' : 'auction'
        }
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
            next = current === 'auction' ? 'shop' : 'auction'
        }
        if (!next) return
        event.preventDefault()
        const target = document.getElementById(
            `sell-method-${next}`,
        ) as HTMLButtonElement | null
        if (target) onSelect(next, target)
    }

    return (
        <button
            id={id}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`flex flex-col items-start gap-0.5 rounded-xl border p-3.5 text-left transition-colors ${
                checked
                    ? 'border-control-action bg-control-action-soft ring-1 ring-control-action'
                    : 'border-content-line bg-content-surface hover:border-brand-structure/40'
            }`}
            tabIndex={checked ? 0 : -1}
            onClick={(event) => onSelect(method, event.currentTarget)}
            onKeyDown={handleKeyDown}
        >
            <span className="text-sm font-bold text-content-fg">{label}</span>
            <span className="text-xs text-content-subtle">{description}</span>
        </button>
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
    description,
    primary = false,
    labelClassName = '',
    displayLabel,
    disabled = false,
    activationControl,
}: {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    error?: string
    optional?: boolean
    placeholder?: string
    description?: string
    primary?: boolean
    labelClassName?: string
    displayLabel?: string
    disabled?: boolean
    activationControl?: React.ReactNode
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const pendingCaret = useRef<number | null>(null)
    const descriptionId = description ? `${id}-description` : undefined
    const errorId = error ? `${id}-error` : undefined
    useLayoutEffect(() => {
        if (pendingCaret.current === null) return
        inputRef.current?.setSelectionRange(
            pendingCaret.current,
            pendingCaret.current,
        )
        pendingCaret.current = null
    }, [value])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value
        const digitsBeforeCaret = raw
            .slice(0, event.target.selectionStart ?? raw.length)
            .replace(/[^0-9]/g, '').length
        const formatted = formatAmountInput(raw)
        pendingCaret.current = caretAfterDigits(formatted, digitsBeforeCaret)
        onChange(formatted)
    }

    return (
        <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <label
                    htmlFor={id}
                    className={`min-w-0 text-sm font-semibold text-content-fg ${labelClassName}`}
                >
                    {displayLabel ?? label}
                    {optional && (
                        <span className="ml-1 text-xs font-normal text-content-subtle">
                            (선택)
                        </span>
                    )}
                </label>
                {activationControl}
            </div>
            {description && (
                <p
                    id={descriptionId}
                    className="mt-1 text-xs text-content-muted"
                >
                    {description}
                </p>
            )}
            <div
                className={`relative min-w-0 ${labelClassName === 'sr-only' ? '' : 'mt-2'}`}
            >
                <input
                    ref={inputRef}
                    id={id}
                    disabled={disabled}
                    aria-label={displayLabel ? label : undefined}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={placeholder}
                    className={`w-full min-w-0 rounded-xl border bg-content-surface py-3 pl-3 pr-12 font-bold tabular-nums transition-colors hover:border-control-action disabled:cursor-not-allowed disabled:border-content-line disabled:bg-content-soft disabled:opacity-70 disabled:hover:border-content-line focus:outline-none focus:ring-2 sm:pl-4 sm:pr-16 ${amountTierClass(value)} ${primary ? 'text-lg sm:text-3xl' : 'text-xl sm:text-2xl'} ${
                        error
                            ? 'border-danger focus:ring-danger/30'
                            : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                    }`}
                    aria-invalid={error !== undefined || undefined}
                    aria-describedby={
                        [descriptionId, errorId].filter(Boolean).join(' ') ||
                        undefined
                    }
                    value={value}
                    onChange={handleChange}
                />
                <span
                    className={`pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold ${amountTierClass(value)}`}
                >
                    코드
                </span>
            </div>
            <FieldError id={errorId} message={error} />
        </div>
    )
}

function amountTierClass(value: string): string {
    const amount = parseAmount(value)
    return amount === null ? 'text-content-fg' : codeTierClass(amount)
}

function FieldError({ id, message }: { id?: string; message?: string }) {
    if (!message) return null
    return (
        <p id={id} role="alert" className="mt-1.5 text-xs text-danger-ink">
            {message}
        </p>
    )
}

function formatAmountInput(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
    if (digits === '') return ''
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function caretAfterDigits(value: string, digitCount: number): number {
    if (digitCount === 0) return 0
    let seen = 0
    for (let index = 0; index < value.length; index += 1) {
        if (/\d/.test(value[index])) seen += 1
        if (seen === digitCount) return index + 1
    }
    return value.length
}

function toLocalDateTimeValue(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offset).toISOString().slice(0, 19)
}

function formatKstDateTime(value: number): string {
    const parts = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(value)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((entry) => entry.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`
}

function SellSkeleton() {
    return (
        <div
            aria-hidden
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
            <div className="h-[520px] animate-pulse rounded-2xl bg-content-soft" />
            <div className="h-80 animate-pulse rounded-2xl bg-content-soft" />
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
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-content-line bg-content-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-content-soft text-content-subtle">
                <Icon aria-hidden className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-content-fg">{title}</h2>
            <p className="mt-1 text-sm text-content-subtle">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
