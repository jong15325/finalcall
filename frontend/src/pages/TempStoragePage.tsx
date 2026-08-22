import { useState } from 'react'
import { Link } from 'react-router'
import { TbArchive, TbArrowUpRight, TbBackpack } from 'react-icons/tb'
import { paths } from '@/app/paths'
import TempStorageList from '@/features/member/components/TempStorageList'
import { relocateErrorMessage } from '@/features/member/lib/relocateErrors'
import { useInfiniteScroll } from '@/features/auction/lib/useInfiniteScroll'
import { useMyInventory } from '@/lib/queries/inventory'
import { useMyTempStorage, useRelocateItem } from '@/lib/queries/tempStorage'
import PageIntro from '@/components/common/PageIntro'

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
    // 스크롤 무한 누적(FC-087 · 목업 §17) — cursor 페이지를 감시점으로 이어 로드.
    const sentinelRef = useInfiniteScroll({
        hasNext: Boolean(tempQuery.hasNextPage),
        isFetching: tempQuery.isFetchingNextPage,
        onLoadMore: () => void tempQuery.fetchNextPage(),
    })

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
            <PageIntro
                icon={TbArchive}
                eyebrow="TEMP STORAGE"
                title="임시 보관함"
                description="인벤토리 용량을 초과해 보관된 아이템을 빈 슬롯으로 이동하세요."
                action={
                    <Link to={paths.inventory} data-market-sell-action>
                        <TbBackpack aria-hidden className="size-4" />
                        <span>인벤토리</span>
                        <TbArrowUpRight aria-hidden />
                    </Link>
                }
            />

            {/* 만실 안내 — 인벤토리에 여유가 없으면. 서버가 최종 판정(선제 차단 아님) */}
            {isFull && (
                <p className="rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-sm font-semibold text-warning">
                    인벤토리가 가득 찼습니다. 정규 슬롯을 비워야 이동할 수
                    있습니다.
                </p>
            )}

            {/* 이동 결과/실패 — code 매핑 문구 */}
            {relocate.isSuccess && (
                <p
                    role="status"
                    className="rounded-xl border border-success-soft bg-success-soft/50 px-4 py-3 text-sm font-semibold text-success-ink"
                >
                    {relocate.data.slotNo}번 슬롯으로 이동했습니다.
                </p>
            )}
            {relocate.isError && (
                <p
                    role="alert"
                    className="rounded-xl border border-danger-soft bg-danger-soft/50 px-4 py-3 text-sm font-semibold text-danger-ink"
                >
                    {relocateErrorMessage(relocate.error)}
                </p>
            )}

            {tempQuery.isPending ? (
                <div aria-hidden className="flex flex-col gap-3">
                    {[0, 1, 2].map((key) => (
                        <div
                            key={key}
                            className="h-28 w-full animate-pulse rounded-2xl bg-content-soft"
                        />
                    ))}
                </div>
            ) : tempQuery.isError ? (
                <p className="rounded-2xl border border-content-line bg-content-surface px-5 py-16 text-center text-sm text-content-subtle">
                    임시 보관함을 불러오지 못했습니다. 잠시 후 다시 시도해
                    주세요.
                </p>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-content-line bg-content-surface px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-content-fg">
                        임시 보관함이 비어 있습니다.
                    </p>
                    <p className="mt-1 text-sm text-content-subtle">
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

                    {/* 무한스크롤 감시점 — 목록 끝 문구는 두지 않는다(목업 §17) */}
                    <div ref={sentinelRef} aria-hidden className="h-px" />

                    {tempQuery.isFetchingNextPage && (
                        <p
                            role="status"
                            className="py-2 text-center text-xs text-content-subtle"
                        >
                            더 불러오는 중…
                        </p>
                    )}
                </>
            )}
        </div>
    )
}

