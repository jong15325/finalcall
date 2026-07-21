import { Link } from 'react-router'
import { paths } from '@/app/paths'
import InventorySlotGrid from '@/features/member/components/InventorySlotGrid'
import { useMyInventory } from '@/lib/queries/inventory'

/**
 * 인벤토리 `/me/inventory` (FC-076 — 목업 `.mycard-window` · design-brief B-9).
 *
 * ★ 실연동은 **계약이 준 것만**: `GET /me/inventory`(capacity·used·items). capacity·used 는 서버값이
 *   정본이라 클라가 파생하지 않는다. 슬롯 확장은 백엔드 미구현이라 그리드 안에서 **비활성 자리**로만.
 * ★ 슬롯 렌더·페이지네이션·확장 자리는 `InventorySlotGrid` 가 담당(순수 표시). 페이지는 훅 배선·상태만.
 */
export default function InventoryPage() {
    const inventoryQuery = useMyInventory()

    return (
        <div className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold text-gray-900">인벤토리</h1>
                <p className="mt-1 text-sm text-gray-500">
                    보유 아이템을 슬롯에서 관리하세요. 초과 아이템은{' '}
                    <Link
                        to={paths.tempStorage}
                        className="font-semibold text-navy underline underline-offset-2"
                    >
                        임시 보관함
                    </Link>
                    에서 이동할 수 있습니다.
                </p>
            </header>

            {inventoryQuery.isPending ? (
                <div
                    aria-hidden
                    className="mx-auto h-96 w-full max-w-[820px] animate-pulse rounded-2xl bg-gray-100"
                />
            ) : inventoryQuery.isError || !inventoryQuery.data ? (
                <p className="rounded-2xl border border-line bg-surface px-5 py-16 text-center text-sm text-gray-500">
                    인벤토리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
            ) : (
                <InventorySlotGrid
                    capacity={inventoryQuery.data.capacity}
                    used={inventoryQuery.data.used}
                    items={inventoryQuery.data.items}
                />
            )}
        </div>
    )
}
