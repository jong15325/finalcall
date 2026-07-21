import { useState } from 'react'
import { Link } from 'react-router'
import { TbBackpack } from 'react-icons/tb'
import { paths } from '@/app/paths'
import TempStorageList from '@/features/member/components/TempStorageList'
import { relocateErrorMessage } from '@/features/member/lib/relocateErrors'
import { useMyInventory } from '@/lib/queries/inventory'
import { useMyTempStorage, useRelocateItem } from '@/lib/queries/tempStorage'

/**
 * 임시 보관함 `/me/temp-storage` (FC-076 — 목업 `.storage-list` · design-brief B-10).
 *
 * ★ 실연동은 계약이 준 것만: `GET /me/temp-storage`(cursor) · `POST …/relocate`(자동 배정).
 * ★ **만실 안내** — 인벤토리(`GET /me/inventory`)로 여유를 파악해 배너로 안내한다. 단, **최종 판정은
 *   서버**다(경합·지연) → 버튼을 선제 비활성하지 않고, 만실 이동 시 `INV_001` 문구로 정확히 알린다.
 * ★ 이동 결과/실패는 페이지 상단 상태 영역에서 낸다(성공 `role="status"`·실패 `role="alert"`).
 *   서버 원문 대신 code 매핑(`relocateErrors`). 성공 시 훅이 임시보관·인벤토리를 함께 무효화한다.
 */
export default function TempStoragePage() {
    const tempQuery = useMyTempStorage()
    const inventoryQuery = useMyInventory()
    const relocate = useRelocateItem()

    /** 마지막으로 이동을 시도한 항목 ID — 진행 중 행 표시·결과 문구 귀속용. */
    const [activeId, setActiveId] = useState<string | null>(null)

    const items = tempQuery.data?.pages.flatMap((page) => page.content) ?? []

    const inventory = inventoryQuery.data
    const isFull =
        inventory !== undefined && inventory.used >= inventory.capacity

    const handleRelocate = (itemInstancePublicId: string) => {
        setActiveId(itemInstancePublicId)
        relocate.mutate({ itemInstancePublicId })
    }

    const pendingId = relocate.isPending ? activeId : null

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        임시 보관함
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        인벤토리 초과 아이템을 빈 슬롯으로 이동하세요.
                    </p>
                </div>
                <Link
                    to={paths.inventory}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100"
                >
                    <TbBackpack aria-hidden className="size-4" />
                    인벤토리
                </Link>
            </header>

            {/* 만실 안내 — 인벤토리에 여유가 없으면. 서버가 최종 판정(선제 차단 아님) */}
            {isFull && (
                <p className="rounded-xl border border-warning-subtle bg-warning-subtle/40 px-4 py-3 text-sm font-semibold text-warning">
                    인벤토리가 가득 찼습니다. 정규 슬롯을 비워야 이동할 수
                    있습니다.
                </p>
            )}

            {/* 이동 결과/실패 — code 매핑 문구 */}
            {relocate.isSuccess && (
                <p
                    role="status"
                    className="rounded-xl border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm font-semibold text-success"
                >
                    {relocate.data.slotNo}번 슬롯으로 이동했습니다.
                </p>
            )}
            {relocate.isError && (
                <p
                    role="alert"
                    className="rounded-xl border border-danger-subtle bg-danger-subtle/50 px-4 py-3 text-sm font-semibold text-danger"
                >
                    {relocateErrorMessage(relocate.error)}
                </p>
            )}

            {tempQuery.isPending ? (
                <div aria-hidden className="flex flex-col gap-3">
                    {[0, 1, 2].map((key) => (
                        <div
                            key={key}
                            className="h-28 w-full animate-pulse rounded-2xl bg-gray-100"
                        />
                    ))}
                </div>
            ) : tempQuery.isError ? (
                <p className="rounded-2xl border border-line bg-surface px-5 py-16 text-center text-sm text-gray-500">
                    임시 보관함을 불러오지 못했습니다. 잠시 후 다시 시도해
                    주세요.
                </p>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-700">
                        임시 보관함이 비어 있습니다.
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        인벤토리가 가득 차 초과된 아이템이 여기에 보관됩니다.
                    </p>
                </div>
            ) : (
                <>
                    <TempStorageList
                        items={items}
                        pendingId={pendingId}
                        onRelocate={handleRelocate}
                    />
                    {tempQuery.hasNextPage && (
                        <button
                            type="button"
                            disabled={tempQuery.isFetchingNextPage}
                            className="mx-auto rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                            onClick={() => void tempQuery.fetchNextPage()}
                        >
                            {tempQuery.isFetchingNextPage
                                ? '불러오는 중…'
                                : '더 보기'}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
