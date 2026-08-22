import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TbArchive, TbArrowUpRight, TbLayoutGrid } from 'react-icons/tb'
import { paths } from '@/app/paths'
import ListFrame from '@/components/common/ListFrame'
import type { ListFrameState } from '@/components/common/ListFrame'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import InventorySlotGrid from '@/features/member/components/InventorySlotGrid'
import InventoryCardInfoDialog from '@/features/member/components/InventoryCardInfoDialog'
import DeliveredBanner from '@/features/delivery/components/DeliveredBanner'
import { isArrived } from '@/features/delivery/lib/deliveryView'
import { useMyInventory } from '@/lib/queries/inventory'
import { useDeliveryLookup } from '@/lib/queries/deliveries'
import type { InventoryItem } from '@/lib/api/inventory'
import PageIntro from '@/components/common/PageIntro'

/**
 * 인벤토리 `/me/inventory` (FC-076 → FC-177 개편 → FC-178 마켓 카드 이식).
 *
 * ★ **FC-177**: 마켓(`MarketPage`) 셸과 동형으로 개편한다 — 헤더(제목·부제·우측 "임시 보관함"
 *   액션) + 툴바(전체 아이템 칩·용량 배지) + 전체폭 슬롯 그리드.
 * ★ **FC-178**: 목록 카드를 **마켓 카드**로, 클릭 시 **카드정보 모달**(`InventoryCardInfoDialog`)로
 *   바꾼다 — 마켓과 완전 동형이되 CTA 만 '판매 등록'(`/sell?item=<id>`)이다.
 * ★ 실연동은 **계약이 준 것만**: `GET /me/inventory`(capacity·used·items). capacity·used 는
 *   서버값이 정본이라 클라가 파생하지 않는다.
 * ★ 슬롯 렌더는 `InventorySlotGrid`(순수 표시 + 클릭 콜백), 모달·판매 이동은 이 페이지가 소유한다.
 */
export default function InventoryPage() {
    const navigate = useNavigate()
    const inventoryQuery = useMyInventory()
    // 배송 상태 교차 조회(계약 §4.6). 실패해도 인벤은 그대로 뜬다(배지만 빠짐, best-effort).
    const deliveryQuery = useDeliveryLookup()
    const deliveries = deliveryQuery.data
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [slotPage, setSlotPage] = useState(1)
    const slotsPerPage = 24
    // 게임 도착(APPLIED) 배송 — 상단 배너로 세션 1회 알린다. APPLIED 아이템은 IN_GAME 으로 빠져
    // 인벤 목록엔 없으므로 배송 lookup 에서 직접 뽑는다.
    const arrived = useMemo(
        () =>
            deliveries
                ? [...deliveries.values()].filter((d) => isArrived(d.status))
                : [],
        [deliveries],
    )

    // 판매하기 → 판매 페이지가 이 아이템을 선점하도록 URL 쿼리로 넘긴다(리로드 생존, 마켓 관례).
    const goToSell = (item: InventoryItem) => {
        setSelectedItem(null)
        navigate(`${paths.sell}?item=${item.itemInstancePublicId}`)
    }

    const listState: ListFrameState = inventoryQuery.isPending
        ? { kind: 'loading', count: 12 }
        : inventoryQuery.isError || !inventoryQuery.data
          ? {
                kind: 'error',
                message:
                    '인벤토리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
                onRetry: () => void inventoryQuery.refetch(),
            }
          : { kind: 'ready' }

    return (
        <div>
            <ListFrame
                state={listState}
                layout="inventory"
                as="ul"
                label="인벤토리 슬롯"
                heading={
                    <>
                        <PageIntro
                            icon={TbLayoutGrid}
                            eyebrow="MY INVENTORY"
                            title="인벤토리"
                            description="보유 아이템의 핵심 스킬을 확인하고 판매할 아이템을 선택하세요."
                            action={
                                <Link
                                    to={paths.tempStorage}
                                    data-market-sell-action
                                >
                                    <TbArchive aria-hidden className="size-4" />
                                    <span>임시 보관함</span>
                                    <TbArrowUpRight aria-hidden />
                                </Link>
                            }
                        />
                        <DeliveredBanner arrived={arrived} />
                    </>
                }
                resultBar={
                    inventoryQuery.data ? (
                        <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-brand-structure/5 px-3 py-1.5 text-xs font-bold text-brand-structure">
                                전체 아이템
                            </span>
                            <span className="rounded-full border border-content-line bg-content-soft px-3 py-1.5 text-xs font-bold text-brand-structure">
                                {inventoryQuery.data.used} /{' '}
                                {inventoryQuery.data.capacity} 사용
                            </span>
                            <span className="ml-auto text-xs text-content-subtle">
                                {inventoryQuery.data.used === 0
                                    ? '보유한 아이템이 없습니다.'
                                    : '카드를 눌러 카드정보를 확인하세요.'}
                            </span>
                        </div>
                    ) : undefined
                }
                renderSkeleton={() => <ItemListSkeleton layout="inventory" />}
            >
                {inventoryQuery.data && (
                    <InventorySlotGrid
                        capacity={inventoryQuery.data.capacity}
                        used={inventoryQuery.data.used}
                        items={inventoryQuery.data.items}
                        deliveries={deliveries}
                        page={slotPage}
                        pageSize={slotsPerPage}
                        onItemClick={setSelectedItem}
                    />
                )}
            </ListFrame>

            {inventoryQuery.data &&
                Math.ceil(
                    Math.max(
                        inventoryQuery.data.capacity,
                        inventoryQuery.data.used,
                    ) / slotsPerPage,
                ) > 1 && (
                    <nav
                        className="inventory-page-tabs"
                        aria-label="인벤토리 슬롯 페이지"
                    >
                        {Array.from(
                            {
                                length: Math.ceil(
                                    Math.max(
                                        inventoryQuery.data.capacity,
                                        inventoryQuery.data.used,
                                    ) / slotsPerPage,
                                ),
                            },
                            (_, index) => index + 1,
                        ).map((page) => (
                            <button
                                key={page}
                                type="button"
                                className="inventory-page-tab"
                                aria-current={
                                    slotPage === page ? 'page' : undefined
                                }
                                aria-label={`인벤토리 탭 ${page}`}
                                onClick={() => setSlotPage(page)}
                            >
                                <span>탭 {page}</span>
                                <small>
                                    {(page - 1) * slotsPerPage + 1}–
                                    {Math.min(
                                        page * slotsPerPage,
                                        inventoryQuery.data.capacity,
                                    )}
                                </small>
                            </button>
                        ))}
                    </nav>
                )}

            {selectedItem && (
                <InventoryCardInfoDialog
                    item={selectedItem}
                    deliveryStatus={
                        deliveries?.get(selectedItem.itemInstancePublicId)
                            ?.status
                    }
                    onSell={goToSell}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    )
}
