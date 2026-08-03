import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TbArchive, TbLayoutGrid } from 'react-icons/tb'
import { paths } from '@/app/paths'
import InventorySlotGrid from '@/features/member/components/InventorySlotGrid'
import InventoryCardInfoDialog from '@/features/member/components/InventoryCardInfoDialog'
import { useMyInventory } from '@/lib/queries/inventory'
import type { InventoryItem } from '@/lib/api/inventory'

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
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)

    // 판매하기 → 판매 페이지가 이 아이템을 선점하도록 URL 쿼리로 넘긴다(리로드 생존, 마켓 관례).
    const goToSell = (item: InventoryItem) => {
        setSelectedItem(null)
        navigate(`${paths.sell}?item=${item.itemInstancePublicId}`)
    }

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <TbLayoutGrid
                            aria-hidden
                            className="size-6 text-navy"
                        />
                        인벤토리
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        아이템 마켓과 같은 카드 목록입니다. 카드를 눌러
                        카드정보를 보고 바로 판매 등록하세요.
                    </p>
                </div>
                <Link
                    to={paths.tempStorage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-bold text-navy hover:border-navy"
                >
                    <TbArchive aria-hidden className="size-4" />
                    임시 보관함
                </Link>
            </header>

            {inventoryQuery.isPending ? (
                <InventoryGridSkeleton />
            ) : inventoryQuery.isError || !inventoryQuery.data ? (
                <p className="rounded-2xl border border-line bg-surface px-5 py-16 text-center text-sm text-gray-500">
                    인벤토리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-navy">
                            전체 아이템
                        </span>
                        <span className="rounded-full border border-line bg-surface-sunken px-3 py-1.5 text-xs font-bold text-navy">
                            {inventoryQuery.data.used} /{' '}
                            {inventoryQuery.data.capacity} 사용
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                            {inventoryQuery.data.used === 0
                                ? '보유한 아이템이 없습니다.'
                                : '카드를 눌러 카드정보를 확인하세요.'}
                        </span>
                    </div>

                    <InventorySlotGrid
                        capacity={inventoryQuery.data.capacity}
                        used={inventoryQuery.data.used}
                        items={inventoryQuery.data.items}
                        onItemClick={setSelectedItem}
                    />
                </>
            )}

            {selectedItem && (
                <InventoryCardInfoDialog
                    item={selectedItem}
                    onSell={goToSell}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    )
}

/** 그리드 영역만 스켈레톤(전체 블러 금지) — 2/3/6 그리드. */
function InventoryGridSkeleton() {
    return (
        <div
            aria-hidden
            className="grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6"
        >
            {Array.from({ length: 12 }).map((_, index) => (
                <div
                    key={index}
                    className="h-[168px] animate-pulse rounded-xl bg-gray-100"
                />
            ))}
        </div>
    )
}
